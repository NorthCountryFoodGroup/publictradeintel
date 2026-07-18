const {
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_CANDIDATE_POOL_DEFAULTS,
} = require("./constants");

function canonicalTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z.-]/g, "").slice(0, 12);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function stableObjects(values) {
  const byJson = new Map();
  values.filter(Boolean).forEach((value) => byJson.set(JSON.stringify(value), value));
  return [...byJson.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function compareMembership(left, right) {
  return (
    (finiteNumber(right.regimeAdjustedScore) ?? -Infinity) - (finiteNumber(left.regimeAdjustedScore) ?? -Infinity) ||
    (finiteNumber(right.rawScore) ?? -Infinity) - (finiteNumber(left.rawScore) ?? -Infinity) ||
    left.bucketId.localeCompare(right.bucketId)
  );
}

function deduplicateMemberships(results) {
  const byBucket = new Map();
  (Array.isArray(results) ? results : [])
    .filter((result) =>
      result &&
      DISCOVERY_BUCKET_DEFINITIONS[result.bucketId] &&
      result.qualified === true &&
      result.productionEligible === true &&
      finiteNumber(result.rawScore) !== null &&
      finiteNumber(result.regimeAdjustedScore) !== null)
    .forEach((result) => {
      const existing = byBucket.get(result.bucketId);
      if (!existing || compareMembership(result, existing) < 0) byBucket.set(result.bucketId, result);
    });
  return [...byBucket.values()].sort(compareMembership);
}

function pickStableIdentity(records, ticker) {
  const candidates = records
    .map((record) => record?.identity)
    .filter((identity) => identity && canonicalTicker(identity.canonicalTicker || identity.ticker) === ticker)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return candidates[0] || { canonicalTicker: ticker, productionEligible: false };
}

function productionEligible(identity, records, memberships) {
  if (!identity || identity.productionEligible !== true || identity.active === false ||
      identity.generatedFixture === true || identity.supportedSecurityType === false) return false;
  if (records.some((record) => record?.dataQuality?.fallbackOnly === true)) return false;
  return memberships.length > 0;
}

function mergeTickerEntries(ticker, entries, settings, evaluatedAt) {
  const records = entries.map((entry) => entry.evidenceRecord || entry.record).filter(Boolean);
  const identity = pickStableIdentity(records, ticker);
  const allBucketResults = entries
    .flatMap((entry) => entry.bucketResults || [])
    .filter((result) => result && DISCOVERY_BUCKET_DEFINITIONS[result.bucketId]);
  const memberships = deduplicateMemberships(allBucketResults);
  const eligible = productionEligible(identity, records, memberships);
  if (!eligible) return null;

  const strongest = memberships[0];
  const breadthContribution = Math.min(
    settings.maximumBreadthContribution,
    Math.max(0, memberships.length - 1) * settings.perAdditionalBucketContribution,
  );
  const watchlist = entries.some((entry) => entry.watchlist === true);
  const watchlistContribution = watchlist && settings.watchlistOverrideEnabled
    ? settings.watchlistPriorityContribution
    : 0;
  const strongestAdjustedScore = strongest.regimeAdjustedScore;
  const poolPriority = Number((strongestAdjustedScore + breadthContribution + watchlistContribution).toFixed(6));
  const knownSectors = stableUnique(records.map((record) => record.identity?.sector).filter(Boolean));
  const sector = knownSectors[0] || "unknown";
  const provenance = stableObjects([
    ...records.flatMap((record) => record.provenance || []),
    ...allBucketResults.flatMap((result) => result.provenance || []),
  ]);
  const missingEvidence = stableObjects(allBucketResults.flatMap((result) => result.missingEvidence || []));
  const limitations = stableUnique([
    ...allBucketResults.flatMap((result) => result.limitations || []),
    ...(knownSectors.length > 1 ? [`Conflicting sourced sectors were present; deterministic sector ${sector} was used.`] : []),
    ...(sector === "unknown" ? ["Sector evidence is unavailable; sector was not fabricated."] : []),
  ]);

  return {
    canonicalTicker: ticker,
    identity: { ...identity, canonicalTicker: ticker },
    qualifiedBucketMemberships: memberships,
    strongestBucket: strongest.bucketId,
    strongestRawScore: strongest.rawScore,
    strongestAdjustedScore,
    poolPriority,
    poolPriorityComponents: {
      strongestAdjustedScore,
      additionalQualifiedBucketCount: Math.max(0, memberships.length - 1),
      breadthContribution,
      watchlistContribution,
    },
    watchlist,
    sector,
    provenance,
    missingEvidence,
    limitations,
    explanation: `Qualified through ${memberships.length} independent bucket(s); pool priority preserves strongest adjusted bucket score ${strongestAdjustedScore} plus bounded breadth ${breadthContribution} and watchlist ${watchlistContribution}.`,
    selectedForDeepAnalysis: false,
    selectionReasons: [],
    exclusionReasons: [],
    evaluatedAt,
  };
}

function compareCandidates(left, right) {
  return (
    right.poolPriority - left.poolPriority ||
    right.strongestAdjustedScore - left.strongestAdjustedScore ||
    right.qualifiedBucketMemberships.length - left.qualifiedBucketMemberships.length ||
    right.strongestRawScore - left.strongestRawScore ||
    left.canonicalTicker.localeCompare(right.canonicalTicker)
  );
}

function sectorAllowed(candidate, selected, limit, maximumPercent) {
  if (candidate.sector === "unknown") return true;
  const maximum = Math.max(1, Math.floor(limit * maximumPercent / 100));
  return selected.filter((item) => item.sector === candidate.sector).length < maximum;
}

function selectDiversified(candidates, settings) {
  const limit = Math.max(0, Math.floor(settings.deepAnalysisLimit));
  const selected = [];
  const selectedTickers = new Set();
  const orderedBuckets = Object.keys(DISCOVERY_BUCKET_DEFINITIONS);

  function trySelect(candidate, reason) {
    if (!candidate || selected.length >= limit || selectedTickers.has(candidate.canonicalTicker)) return false;
    if (!sectorAllowed(candidate, selected, limit, settings.maximumSectorConcentrationPercent)) return false;
    selected.push(candidate);
    selectedTickers.add(candidate.canonicalTicker);
    candidate.selectedForDeepAnalysis = true;
    candidate.selectionReasons.push(reason);
    return true;
  }

  orderedBuckets.forEach((bucketId) => {
    const representative = candidates
      .filter((candidate) => candidate.qualifiedBucketMemberships.some((membership) => membership.bucketId === bucketId))
      .find((candidate) => !selectedTickers.has(candidate.canonicalTicker) &&
        sectorAllowed(candidate, selected, limit, settings.maximumSectorConcentrationPercent));
    trySelect(representative, `Selected as deterministic representation for ${DISCOVERY_BUCKET_DEFINITIONS[bucketId].label}.`);
  });

  candidates.forEach((candidate) => {
    trySelect(candidate, "Selected during deterministic reallocation of unused diversified capacity.");
  });

  candidates.filter((candidate) => !candidate.selectedForDeepAnalysis).forEach((candidate) => {
    if (selected.length >= limit) candidate.exclusionReasons.push("Deep-analysis candidate limit was reached.");
    else if (!sectorAllowed(candidate, selected, limit, settings.maximumSectorConcentrationPercent)) {
      candidate.exclusionReasons.push(`Configured ${settings.maximumSectorConcentrationPercent}% sector concentration limit was reached for ${candidate.sector}.`);
    } else candidate.exclusionReasons.push("Not selected after deterministic bucket-diversity and priority ordering.");
  });
  return selected;
}

function buildCandidatePool(input = {}, options = {}) {
  const settings = {
    ...DISCOVERY_CANDIDATE_POOL_DEFAULTS,
    ...(input.settings || {}),
    ...(options.settings || {}),
  };
  const evaluatedAt = options.evaluatedAt || input.evaluatedAt || new Date(0).toISOString();
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const grouped = new Map();
  let invalidInputEntryCount = 0;
  entries.forEach((entry) => {
    try {
      const record = entry?.evidenceRecord || entry?.record;
      const ticker = canonicalTicker(record?.identity?.canonicalTicker || record?.identity?.ticker);
      if (!ticker) {
        invalidInputEntryCount += 1;
        return;
      }
      if (!grouped.has(ticker)) grouped.set(ticker, []);
      grouped.get(ticker).push(entry);
    } catch {
      invalidInputEntryCount += 1;
    }
  });

  const qualifiedCandidates = [...grouped.keys()]
    .sort()
    .map((ticker) => mergeTickerEntries(ticker, grouped.get(ticker), settings, evaluatedAt))
    .filter(Boolean)
    .sort(compareCandidates);
  const deepAnalysisCandidates = selectDiversified(qualifiedCandidates, settings);

  return {
    schemaVersion: "v3-candidate-pool-1",
    evaluatedAt,
    settings: {
      deepAnalysisLimit: settings.deepAnalysisLimit,
      maximumSectorConcentrationPercent: settings.maximumSectorConcentrationPercent,
      maximumBreadthContribution: settings.maximumBreadthContribution,
      perAdditionalBucketContribution: settings.perAdditionalBucketContribution,
      watchlistPriorityContribution: settings.watchlistPriorityContribution,
      watchlistOverrideEnabled: settings.watchlistOverrideEnabled,
    },
    qualifiedCandidates,
    deepAnalysisCandidates,
    diagnostics: {
      inputEntryCount: entries.length,
      invalidInputEntryCount,
      uniqueTickerCount: grouped.size,
      qualifiedCandidateCount: qualifiedCandidates.length,
      deepAnalysisCandidateCount: deepAnalysisCandidates.length,
      unknownSectorCount: qualifiedCandidates.filter((candidate) => candidate.sector === "unknown").length,
      limitations: [
        "Pool priority is not a prediction score.",
        "Only independently qualified bucket results contribute to priority.",
        "Unknown sectors are retained explicitly and are not fabricated.",
      ],
    },
  };
}

module.exports = {
  buildCandidatePool,
};
