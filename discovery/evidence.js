const {
  normalizeEvidenceRecord,
  normalizeEvidenceTimestamp,
  normalizeNullableNumber,
  recordMissingEvidence,
  validateEvidenceRecord,
} = require("./schema");

const HISTORICAL_MISSING_FIELDS = Object.freeze([
  ["market.averageVolume20", ["relativeVolume"], "Historical average volume is not available from current quote data."],
  ["market.averageDollarVolume20", ["relativeVolume"], "Historical average dollar volume is not available from current quote data."],
  ["market.relativeVolume", ["relativeVolume"], "Relative volume requires current volume and a sourced historical average."],
  ["market.high20", ["breakout"], "A sourced 20-session high is unavailable."],
  ["market.low20", ["reversal"], "A sourced 20-session low is unavailable."],
  ["market.high60", ["breakout"], "A sourced 60-session high is unavailable."],
  ["market.low60", ["reversal"], "A sourced 60-session low is unavailable."],
  ["market.return5", ["momentum", "reversal"], "A sourced five-session return is unavailable."],
  ["market.return20", ["momentum", "sectorLeaders", "reversal"], "A sourced 20-session return is unavailable."],
  ["market.volatility20", ["reversal"], "Sourced historical volatility is unavailable."],
  ["market.movingAverage5", ["momentum", "reversal"], "A sourced five-session moving average is unavailable."],
  ["market.movingAverage20", ["momentum", "breakout", "reversal"], "A sourced 20-session moving average is unavailable."],
  ["market.distanceFromHigh20Percent", ["breakout"], "Breakout distance requires sourced historical highs."],
  ["market.distanceFromLow20Percent", ["reversal"], "Reversal distance requires sourced historical lows."],
  ["catalysts.earnings.nextEarningsAt", ["earnings"], "No real sourced earnings provider is currently connected."],
  ["context.sectorReturn1", ["sectorLeaders"], "Sourced sector return evidence is unavailable."],
  ["context.sectorReturn5", ["sectorLeaders"], "Sourced sector return evidence is unavailable."],
  ["context.sectorReturn20", ["sectorLeaders"], "Sourced sector return evidence is unavailable."],
  ["context.sectorRelativeStrength", ["sectorLeaders"], "Sector-relative strength requires sourced sector returns."],
  ["context.marketRelativeStrength", ["momentum", "sectorLeaders"], "Market-relative strength requires sourced historical returns."],
  ["context.sectorBreadth", ["sectorLeaders"], "Sourced sector breadth is unavailable."],
]);

function canonicalTicker(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function parsePercent(value) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeNullableNumber(String(value).replace("%", "").trim());
}

function latestTimestamp(...values) {
  return values
    .flat()
    .map(normalizeEvidenceTimestamp)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;
}

function indexSymbolUniverse(universe = {}) {
  const metadata = universe.symbolUniverseMetadata || universe.snapshotMetadata || {};
  const universeSource = String(metadata.source || "");
  const emergency =
    metadata.emergencyFallbackActive === true ||
    metadata.refreshStatus === "emergency-preset-fallback" ||
    /fixture|generated synthetic|emergency preset/i.test(universeSource);
  const productionTrusted =
    !emergency &&
    (
      metadata.refreshStatus === "live" ||
      /Nasdaq Trader exchange listing files/i.test(universeSource)
    );
  const rows = Array.isArray(universe.symbols) ? universe.symbols : [];
  const indexed = new Map();

  [...rows]
    .sort((a, b) => canonicalTicker(a.canonicalTicker || a.ticker).localeCompare(canonicalTicker(b.canonicalTicker || b.ticker)))
    .forEach((row) => {
      const ticker = canonicalTicker(row.canonicalTicker || row.displayTicker || row.providerTicker || row.ticker);
      if (!ticker || indexed.has(ticker)) return;
      const source = String(row.source || universeSource || "Unknown symbol-universe source");
      indexed.set(ticker, {
        canonicalTicker: ticker,
        displayTicker: canonicalTicker(row.displayTicker || ticker),
        providerTicker: String(row.providerTicker || ticker).toUpperCase().slice(0, 20),
        name: row.name || row.companyName || row.company || ticker,
        exchange: row.exchange || row.listingExchange || null,
        securityType: row.securityType || row.type || null,
        sector: row.sector || null,
        industry: row.industry || null,
        source,
        active: row.active !== false,
        generatedFixture: emergency || /fixture|generated synthetic/i.test(source),
        productionEligible: row.productionEligible !== false && productionTrusted,
      });
    });

  return {
    byTicker: indexed,
    metadata: {
      source: universeSource || null,
      sourceTimestamp: normalizeEvidenceTimestamp(metadata.fetchedAt || metadata.generatedAt),
      refreshStatus: metadata.refreshStatus || null,
      emergencyFallbackActive: emergency,
      productionTrusted,
      eligibleSymbolCount: Number(metadata.eligibleSymbolCount || rows.length) || 0,
    },
  };
}

function quoteTimestamp(quote = {}) {
  return normalizeEvidenceTimestamp(
    quote.latestUnderlyingQuoteAt ||
    quote.marketUpdatedAt ||
    quote.quoteTimestamp,
  );
}

function quoteFetchedAt(quote = {}) {
  return normalizeEvidenceTimestamp(
    quote.providerFetchedAt ||
    quote.fetchedAt ||
    quote.marketUpdatedAt,
  );
}

function quoteCompleteness(quote = {}) {
  return [
    normalizeNullableNumber(quote.marketPrice ?? quote.price),
    normalizeNullableNumber(quote.marketVolume ?? quote.volume),
    parsePercent(quote.marketChangePercent ?? quote.changePercent),
    quoteTimestamp(quote),
  ].filter((value) => value !== null).length;
}

function compareQuoteEvidence(left, right) {
  const leftTime = Date.parse(quoteTimestamp(left) || quoteFetchedAt(left) || "") || 0;
  const rightTime = Date.parse(quoteTimestamp(right) || quoteFetchedAt(right) || "") || 0;
  if (leftTime !== rightTime) return rightTime - leftTime;
  const completenessDifference = quoteCompleteness(right) - quoteCompleteness(left);
  if (completenessDifference) return completenessDifference;
  return String(left.marketProvider || left.providerUsed || "").localeCompare(String(right.marketProvider || right.providerUsed || ""));
}

function indexQuotesByTicker(quotes = [], watchlist = []) {
  const candidates = [];
  for (const quote of Array.isArray(quotes) ? quotes : []) {
    candidates.push({ ...quote, _evidenceOrigin: "scan quote" });
  }
  for (const item of Array.isArray(watchlist) ? watchlist : []) {
    if (
      normalizeNullableNumber(item.marketPrice) !== null ||
      normalizeNullableNumber(item.marketVolume) !== null ||
      parsePercent(item.marketChangePercent) !== null ||
      quoteTimestamp(item)
    ) {
      candidates.push({ ...item, _evidenceOrigin: "saved watchlist quote" });
    }
  }

  const grouped = new Map();
  candidates.forEach((quote) => {
    const ticker = canonicalTicker(quote.ticker || quote.canonicalTicker);
    if (!ticker) return;
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push(quote);
  });

  const indexed = new Map();
  [...grouped.keys()].sort().forEach((ticker) => {
    const selected = [...grouped.get(ticker)].sort(compareQuoteEvidence)[0];
    indexed.set(ticker, selected);
  });
  return indexed;
}

function parseReportedRange(value) {
  const text = String(value || "");
  const amounts = [...text.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)/g)]
    .map((match) => normalizeNullableNumber(match[1].replace(/,/g, "")))
    .filter((amount) => amount !== null);
  if (!amounts.length) return { minimum: null, maximum: null };
  return {
    minimum: amounts[0],
    maximum: amounts.length > 1 ? amounts[1] : amounts[0],
  };
}

function congressTradeKey(trade = {}) {
  return [
    trade.representative || trade.member || trade.name,
    canonicalTicker(trade.ticker || trade.symbol),
    trade.transaction || trade.type,
    trade.transactionDate || trade.transaction_date,
    trade.disclosureDate || trade.disclosure_date || trade.reportedDate || trade.filingDate,
    trade.reportedRange || trade.amount || trade.range,
    trade.sourceURL || trade.sourceUrl || trade.source,
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function indexCongressionalEvidence(trades = []) {
  const deduplicated = new Map();
  (Array.isArray(trades) ? trades : [])
    .slice()
    .sort((a, b) => congressTradeKey(a).localeCompare(congressTradeKey(b)))
    .forEach((trade) => {
      const ticker = canonicalTicker(trade.ticker || trade.symbol);
      if (!ticker) return;
      const key = congressTradeKey(trade);
      if (!deduplicated.has(key)) deduplicated.set(key, trade);
    });

  const grouped = new Map();
  deduplicated.forEach((trade) => {
    const ticker = canonicalTicker(trade.ticker || trade.symbol);
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push(trade);
  });

  const indexed = new Map();
  [...grouped.keys()].sort().forEach((ticker) => {
    const rows = grouped.get(ticker);
    const buys = rows.filter((trade) => /^buy|purchase$/i.test(String(trade.transaction || trade.type || "")));
    const sells = rows.filter((trade) => /^sell|sale$/i.test(String(trade.transaction || trade.type || "")));
    const members = new Set(rows.map((trade) => trade.representative || trade.member || trade.name).filter(Boolean));
    const parties = new Set(rows.map((trade) => trade.party).filter(Boolean));
    const ranges = rows.map((trade) => parseReportedRange(trade.reportedRange || trade.amount || trade.range));
    const minimums = ranges.map((range) => range.minimum).filter((value) => value !== null);
    const maximums = ranges.map((range) => range.maximum).filter((value) => value !== null);
    const transactionDates = rows
      .map((trade) => normalizeEvidenceTimestamp(trade.transactionDate || trade.transaction_date))
      .filter(Boolean);
    const disclosureDates = rows
      .map((trade) => normalizeEvidenceTimestamp(trade.disclosureDate || trade.disclosure_date || trade.reportedDate || trade.filingDate))
      .filter(Boolean);
    const fetchedDates = rows.map((trade) => normalizeEvidenceTimestamp(trade.fetchedAt)).filter(Boolean);
    const sources = [...new Set(rows.map((trade) => trade.sourceURL || trade.sourceUrl || trade.source).filter(Boolean).map(String))].sort();
    const sourceTimestamp = latestTimestamp(disclosureDates, transactionDates);
    const fetchedAt = latestTimestamp(fetchedDates);
    const fields = [
      "catalysts.congressional.buyCount",
      "catalysts.congressional.sellCount",
      "catalysts.congressional.memberCount",
      parties.size ? "catalysts.congressional.bipartisan" : null,
      minimums.length ? "catalysts.congressional.transactionValueMinimum" : null,
      maximums.length ? "catalysts.congressional.transactionValueMaximum" : null,
      transactionDates.length ? "catalysts.congressional.latestTransactionAt" : null,
      disclosureDates.length ? "catalysts.congressional.latestDisclosureAt" : null,
    ].filter(Boolean);

    indexed.set(ticker, {
      evidence: {
        buyCount: buys.length,
        sellCount: sells.length,
        memberCount: members.size,
        bipartisan: parties.size ? parties.size > 1 : null,
        transactionValueMinimum: minimums.length ? Math.min(...minimums) : null,
        transactionValueMaximum: maximums.length ? Math.max(...maximums) : null,
        latestTransactionAt: latestTimestamp(transactionDates),
        latestDisclosureAt: latestTimestamp(disclosureDates),
        source: sources.join("; ") || "Saved congressional disclosure record",
        sourceTimestamp,
      },
      provenance: sourceTimestamp || fetchedAt
        ? {
            evidenceType: "congressional-disclosure",
            provider: "Saved normalized congressional disclosures",
            source: sources.join("; ") || "Saved congressional disclosure record",
            sourceTimestamp,
            fetchedAt,
            fields,
            fallback: false,
            limitations: [
              "Congressional disclosures are delayed reports and are not real-time trade activity.",
              transactionDates.length
                ? "Transaction dates and disclosure dates are retained separately."
                : "Saved records do not include a separate transaction date; only disclosure/report dates are available.",
              "Reported transaction ranges are disclosure ranges, not exact transaction amounts.",
            ],
          }
        : null,
    });
  });
  return indexed;
}

function policySignalKey(signal = {}) {
  return [
    canonicalTicker(signal.ticker),
    signal.sourceName || signal.source,
    signal.sourceUrl || signal.url,
    signal.direction,
    signal.foundAt || signal.updatedAt,
    (Array.isArray(signal.matchedTerms) ? [...signal.matchedTerms].sort() : []).join(","),
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function indexPolicyEvidence(policySignals = {}) {
  const updatedAt = normalizeEvidenceTimestamp(policySignals.updatedAt);
  const deduplicated = new Map();
  (Array.isArray(policySignals.signals) ? policySignals.signals : [])
    .filter((signal) => canonicalTicker(signal.ticker))
    .slice()
    .sort((a, b) => policySignalKey(a).localeCompare(policySignalKey(b)))
    .forEach((signal) => {
      const key = policySignalKey(signal);
      if (!deduplicated.has(key)) deduplicated.set(key, signal);
    });

  const grouped = new Map();
  deduplicated.forEach((signal) => {
    const ticker = canonicalTicker(signal.ticker);
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push(signal);
  });

  const indexed = new Map();
  [...grouped.keys()].sort().forEach((ticker) => {
    const rows = grouped.get(ticker);
    const positive = rows.filter((signal) => signal.direction === "positive");
    const negative = rows.filter((signal) => signal.direction === "negative");
    const sources = [...new Set(rows.map((signal) => signal.sourceName || signal.source || signal.sourceUrl).filter(Boolean).map(String))].sort();
    const timestamps = rows
      .map((signal) => normalizeEvidenceTimestamp(signal.foundAt || signal.updatedAt))
      .filter(Boolean);
    const sourceTimestamp = latestTimestamp(timestamps, updatedAt);
    const summaryRow = [...rows].sort((a, b) => {
      const timeDifference = (Date.parse(b.foundAt || b.updatedAt || "") || 0) - (Date.parse(a.foundAt || a.updatedAt || "") || 0);
      return timeDifference || policySignalKey(a).localeCompare(policySignalKey(b));
    })[0];
    const matchedTerms = [...new Set(
      rows.flatMap((signal) => Array.isArray(signal.matchedTerms) ? signal.matchedTerms : []).map(String),
    )].sort();
    const fields = [
      "catalysts.policy.signalCount",
      "catalysts.policy.positiveCount",
      "catalysts.policy.negativeCount",
      "catalysts.policy.independentSourceCount",
      summaryRow?.direction ? "catalysts.policy.strongestDirection" : null,
      summaryRow ? "catalysts.policy.strongestSummary" : null,
    ].filter(Boolean);

    indexed.set(ticker, {
      evidence: {
        signalCount: rows.length,
        positiveCount: positive.length,
        negativeCount: negative.length,
        independentSourceCount: sources.length,
        strongestScore: null,
        strongestDirection: summaryRow?.direction || null,
        strongestSummary: summaryRow
          ? `Keyword-derived ticker match from ${summaryRow.sourceName || summaryRow.source || "saved policy source"}${matchedTerms.length ? `; matched terms: ${matchedTerms.join(", ")}` : ""}.`
          : null,
        sourceTimestamp,
      },
      provenance: sourceTimestamp
        ? {
            evidenceType: "policy-keyword-signal",
            provider: "Saved PublicTradeIntel policy scanner output",
            source: sources.join("; ") || "Saved ticker-specific policy signals",
            sourceTimestamp,
            fetchedAt: updatedAt,
            fields,
            fallback: false,
            limitations: [
              "Signals are keyword-derived ticker associations and are not semantic or causal determinations.",
              "Legacy policy scores are excluded because they may include manually maintained pressScore or committeeScore boosts.",
              "Repeated saved signals are deterministically deduplicated before evidence counts are calculated.",
            ],
          }
        : null,
    });
  });
  return indexed;
}

function quoteMarketEvidence(quote = {}) {
  const price = normalizeNullableNumber(quote.marketPrice ?? quote.price);
  const previousClose = normalizeNullableNumber(quote.previousClose);
  const change = normalizeNullableNumber(quote.marketChange ?? quote.change);
  const changePercent = parsePercent(quote.marketChangePercent ?? quote.changePercent);
  const volume = normalizeNullableNumber(quote.marketVolume ?? quote.volume);
  return {
    price,
    previousClose,
    change,
    changePercent,
    volume,
    dollarVolume: price !== null && volume !== null ? price * volume : null,
    latestQuoteAt: quoteTimestamp(quote),
    latestBarAt: normalizeEvidenceTimestamp(quote.latestDailyBarAt || quote.latestUnderlyingQuoteAt || quote.marketUpdatedAt),
    providerFetchedAt: quoteFetchedAt(quote),
  };
}

function quoteProvenance(quote = {}, market = {}) {
  const fields = [
    market.price !== null ? "market.price" : null,
    market.previousClose !== null ? "market.previousClose" : null,
    market.change !== null ? "market.change" : null,
    market.changePercent !== null ? "market.changePercent" : null,
    market.volume !== null ? "market.volume" : null,
    market.dollarVolume !== null ? "market.dollarVolume" : null,
  ].filter(Boolean);
  const sourceTimestamp = market.latestQuoteAt || market.latestBarAt;
  const fetchedAt = market.providerFetchedAt;
  if (!fields.length || (!sourceTimestamp && !fetchedAt)) return null;
  const provider = String(quote.providerUsed || quote.marketProvider || "Saved quote source");
  return {
    evidenceType: "current-quote",
    provider,
    source: String(quote.marketProvider || quote._evidenceOrigin || provider),
    sourceTimestamp,
    fetchedAt,
    fields,
    fallback: quote.fallbackUsed === true || quote.fallbackDataUsed === true || /fallback|saved|cached/i.test(provider),
    stale: false,
    limitations: [
      "Current quote evidence does not provide historical bars, relative volume, moving averages, breakout levels, or reversal confirmation.",
    ],
  };
}

function addUnavailableEvidence(missingEvidence, record) {
  HISTORICAL_MISSING_FIELDS.forEach(([field, buckets, reason]) => {
    const pathValue = field.split(".").reduce((value, key) => value?.[key], record);
    if (pathValue === null || pathValue === undefined) {
      recordMissingEvidence(missingEvidence, field, buckets, reason);
    }
  });
  if (record.market.price === null) {
    recordMissingEvidence(missingEvidence, "market.price", ["momentum", "relativeVolume", "breakout", "reversal"], "No real current quote is available.");
  }
  if (record.market.volume === null) {
    recordMissingEvidence(missingEvidence, "market.volume", ["relativeVolume", "breakout"], "No real current volume is available.");
  }
  if ((record.market.price !== null || record.market.volume !== null) && !record.market.latestQuoteAt) {
    recordMissingEvidence(missingEvidence, "market.latestQuoteAt", ["momentum", "relativeVolume", "breakout", "reversal"], "Current quote evidence has no underlying source timestamp.");
  }
}

function buildEvidenceRecord({ identity, quote, congressional, policy }, options = {}) {
  const market = quote ? quoteMarketEvidence(quote) : {};
  const provenance = [
    quote ? quoteProvenance(quote, market) : null,
    congressional?.provenance || null,
    policy?.provenance || null,
  ].filter(Boolean);
  const raw = {
    identity,
    market,
    catalysts: {
      congressional: congressional?.evidence || {},
      policy: policy?.evidence || {},
      earnings: {},
    },
    context: {},
    provenance,
    missingEvidence: [],
  };
  addUnavailableEvidence(raw.missingEvidence, raw);
  return normalizeEvidenceRecord(raw, options);
}

function summarizeEvidenceCoverage(records, validationResults, sourceIndexes) {
  const recordList = [...records.values()];
  const countWith = (selector) => recordList.filter(selector).length;
  return {
    schemaVersion: "v3-evidence-build-diagnostics-1",
    status: "completed",
    recordCount: recordList.length,
    productionEligibleCount: countWith((record) => record.identity.productionEligible),
    productionIneligibleCount: countWith((record) => !record.identity.productionEligible),
    quoteEvidenceCount: countWith((record) => record.market.price !== null || record.market.volume !== null),
    congressionalEvidenceCount: countWith((record) => record.catalysts.congressional.memberCount !== null),
    policyEvidenceCount: countWith((record) => record.catalysts.policy.signalCount !== null),
    earningsEvidenceCount: 0,
    historicalBarEvidenceCount: 0,
    relativeVolumeEvidenceCount: 0,
    breakoutEvidenceCount: 0,
    sectorReturnEvidenceCount: 0,
    reversalEvidenceCount: 0,
    staleEvidenceCount: countWith((record) => record.dataQuality.stale),
    fallbackOnlyCount: countWith((record) => record.dataQuality.fallbackOnly),
    validRecordCount: validationResults.filter((result) => result.valid).length,
    invalidRecordCount: validationResults.filter((result) => !result.valid).length,
    productionUsableCount: countWith((record) => record.dataQuality.productionUsable),
    symbolUniverseSource: sourceIndexes.universe.metadata.source,
    symbolUniverseSourceTimestamp: sourceIndexes.universe.metadata.sourceTimestamp,
    sourceCounts: {
      symbolUniverse: sourceIndexes.universe.byTicker.size,
      quotes: sourceIndexes.quotes.size,
      congressionalTickers: sourceIndexes.congressional.size,
      policyTickers: sourceIndexes.policy.size,
    },
    limitations: [
      "Evidence construction is inert and does not select deep-analysis candidates.",
      "Historical bars, relative volume, moving averages, breakouts, earnings, sector returns, and reversals remain unavailable.",
      "Legacy synthetic attractiveness scores are excluded.",
      sourceIndexes.universe.metadata.productionTrusted
        ? "The active symbol universe has live Nasdaq Trader provenance."
        : "The active symbol universe lacks verified live Nasdaq Trader provenance; its records remain production-ineligible for v3 discovery.",
    ],
  };
}

function buildEvidenceRecords(input = {}, options = {}) {
  const universe = indexSymbolUniverse(input.universe || {});
  const quotes = indexQuotesByTicker(input.quotes, input.config?.stockIdeas);
  const congressional = indexCongressionalEvidence(input.config?.congressTrades);
  const policy = indexPolicyEvidence(input.policySignals);
  const tickers = new Set([
    ...universe.byTicker.keys(),
    ...quotes.keys(),
    ...congressional.keys(),
    ...policy.keys(),
  ]);
  const records = new Map();
  const validationResults = [];

  [...tickers].sort().forEach((ticker) => {
    const identity = universe.byTicker.get(ticker) || {
      canonicalTicker: ticker,
      displayTicker: ticker,
      providerTicker: ticker,
      name: input.config?.stockIdeas?.find((item) => canonicalTicker(item.ticker) === ticker)?.name || ticker,
      exchange: null,
      securityType: input.config?.stockIdeas?.find((item) => canonicalTicker(item.ticker) === ticker)?.type === "ETF" ? "ETF" : "Common Stock",
      source: "Saved application record outside current trusted symbol universe",
      active: true,
      productionEligible: false,
    };
    const record = buildEvidenceRecord({
      identity,
      quote: quotes.get(ticker),
      congressional: congressional.get(ticker),
      policy: policy.get(ticker),
    }, options);
    const validation = validateEvidenceRecord(record, options);
    records.set(ticker, validation.normalized);
    validationResults.push(validation);
  });

  const sourceIndexes = { universe, quotes, congressional, policy };
  return {
    records,
    diagnostics: summarizeEvidenceCoverage(records, validationResults, sourceIndexes),
    validationResults,
  };
}

module.exports = {
  buildEvidenceRecord,
  buildEvidenceRecords,
  indexCongressionalEvidence,
  indexPolicyEvidence,
  indexQuotesByTicker,
  indexSymbolUniverse,
  parseReportedRange,
  summarizeEvidenceCoverage,
};
