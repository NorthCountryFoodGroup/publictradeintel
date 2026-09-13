(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PublicTradeIntelPredictionSemantics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const HORIZON_KEYS = Object.freeze(["top25OneDay", "top25SevenDay", "top25OneMonth", "top25OneYear"]);
  const RECOMMENDATION_SECTION_KEYS = Object.freeze([
    ...HORIZON_KEYS,
    "topBuyCandidates", "bestFiveOneDay", "bestFiveSevenDay", "bestFiveOneMonth", "bestFiveOneYear",
    "avoidList", "comparisonView", "highAlignmentCandidates", "changedSinceLastScan", "oneDayOpportunities",
    "threeDayOpportunities", "sevenDayOpportunities", "thirtyDayOpportunities", "dailyOpportunities",
    "weeklyOpportunities", "monthlyOpportunities", "goldSilverOpportunities", "highestMomentum",
    "strongestSector", "congressionalTradeSignals", "strongestOneDay", "strongestThreeDay",
    "strongestSevenDay", "strongestThirtyDay", "biggestScoreIncrease", "biggestScoreDrop",
  ]);

  function qualificationReasons(record) {
    const quality = String(record?.dataQualityStatus || record?.marketDataQuality?.status || record?.marketDataQuality?.label || "").toLowerCase();
    const freshness = String(record?.freshnessStatus || record?.freshness || "").toLowerCase();
    const reasons = [];
    if (!(Number(record?.currentPrice) > 0)) reasons.push("current price unavailable");
    if (!(record?.latestUnderlyingQuoteAt || record?.quoteTimestamp)) reasons.push("quote timestamp unavailable");
    if (!(Number(record?.marketVolume) > 0)) reasons.push("volume unavailable");
    if (["failed", "unavailable", "stale"].includes(quality)) reasons.push(`data quality ${quality || "unavailable"}`);
    if (["stale", "unavailable"].includes(freshness)) reasons.push(`market data ${freshness}`);
    if (record?.criticalDataComplete === false || record?.dataUsabilityStatus === "insufficient") reasons.push("critical evidence incomplete");
    if (Array.isArray(record?.missingCriticalFields) && record.missingCriticalFields.length) reasons.push("critical fields missing");
    return [...new Set(reasons)];
  }

  function isQualified(record) {
    return qualificationReasons(record).length === 0;
  }

  function qualifyRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter(isQualified);
  }

  function tickerKey(record) {
    return String(record?.ticker || record?.symbol || "").trim().toUpperCase();
  }

  function requalifyDerivedRows(rows, authoritativeRows) {
    const authoritativeByTicker = new Map(
      (Array.isArray(authoritativeRows) ? authoritativeRows : [])
        .map((record) => [tickerKey(record), record])
        .filter(([ticker]) => ticker),
    );
    return (Array.isArray(rows) ? rows : [])
      .map((derived) => {
        const authoritative = authoritativeByTicker.get(tickerKey(derived));
        return authoritative ? {
          ...derived,
          ...authoritative,
          scanReferencePrice: authoritative.currentPrice ?? null,
          scanReferencePriceTimestamp: authoritative.latestUnderlyingQuoteAt || authoritative.quoteTimestamp || null,
        } : null;
      })
      .filter((record) => record && isQualified(record));
  }

  function normalizeStocksToBuyCenter(center, authoritativeRows) {
    if (!center || typeof center !== "object" || Array.isArray(center)) return center;
    const rankingLists = Object.fromEntries(Object.entries(center.rankingLists || {}).map(([key, list]) => {
      const sourceRows = Array.isArray(list?.qualifiedRows) ? list.qualifiedRows : list?.rows;
      const qualifiedRows = requalifyDerivedRows(sourceRows, authoritativeRows);
      return [key, {
        ...list,
        qualifiedCount: qualifiedRows.length,
        qualifiedRows,
        rows: qualifiedRows.slice(0, 25),
      }];
    }));
    const currentBestIdeas = requalifyDerivedRows(center.bestIdeas?.current, authoritativeRows).slice(0, 10);
    return {
      ...center,
      rankingLists,
      bestIdeas: { ...(center.bestIdeas || {}), current: currentBestIdeas },
    };
  }

  function deriveMarketSemantics(payload) {
    const qualified = qualifyRows(payload?.predictions);
    const usableEvidenceCount = Number(payload?.predictionSemantics?.usableMarketDataCount ?? payload?.predictionEngineHealth?.usablePredictionRecords ?? qualified.length) || 0;
    const qualifiedBullishCount = qualified.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bullish").length;
    const qualifiedBearishCount = qualified.filter((item) => String(item.unifiedDirection || "").toLowerCase() === "bearish").length;
    const qualifiedNeutralCount = Math.max(0, qualified.length - qualifiedBullishCount - qualifiedBearishCount);
    const qualifiedBias = !qualified.length || !usableEvidenceCount
      ? "Insufficient evidence"
      : qualifiedBullishCount > qualifiedBearishCount
        ? "Bullish"
        : qualifiedBearishCount > qualifiedBullishCount
          ? "Bearish"
          : "Mixed";
    return {
      qualifiedCount: qualified.length,
      qualifiedBullishCount,
      qualifiedBearishCount,
      qualifiedNeutralCount,
      usableEvidenceCount,
      observedBreadthAvailable: false,
      qualifiedBias,
    };
  }

  function summarize(payload) {
    const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
    const sections = payload?.sections || {};
    const qualified = qualifyRows(predictions);
    const health = payload?.predictionEngineHealth || {};
    const scan = payload?.scanHealth || {};
    const analyzed = Number(scan.deepCandidatesSelected || scan.deepAnalysisCandidatesSelected || health.tickersScanned) || predictions.length;
    const horizonCounts = Object.fromEntries(HORIZON_KEYS.map((key) => [key, qualifyRows(sections[key]).length]));
    return {
      scanTimestamp: payload?.updatedAt || health.scanCompletedAt || scan.scanCompletedAt || null,
      analyzedCount: analyzed,
      storedCount: predictions.length,
      qualifiedCount: qualified.length,
      usableMarketDataCount: Number(health.usablePredictionRecords) || qualified.length,
      marketDataAvailability: scan.dataAvailability || health.dataAvailability || health.dataQualityStatus || "Unavailable",
      dataQualityCounts: health.dataQualityStatusCounts || {},
      horizonCounts,
    };
  }

  function normalizePayload(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const predictions = (Array.isArray(source.predictions) ? source.predictions : []).map((record) => ({
      ...record,
      recommendationQualified: isQualified(record),
      qualificationState: isQualified(record) ? "qualified" : "insufficient-evidence",
      qualificationReasons: qualificationReasons(record),
    }));
    const sections = { ...(source.sections || {}) };
    RECOMMENDATION_SECTION_KEYS.forEach((key) => {
      if (Array.isArray(sections[key])) sections[key] = requalifyDerivedRows(sections[key], predictions);
    });
    if (sections.stocksToBuyCenter) sections.stocksToBuyCenter = normalizeStocksToBuyCenter(sections.stocksToBuyCenter, predictions);
    const normalized = { ...source, predictions, sections };
    normalized.predictionSemantics = summarize(normalized);
    return normalized;
  }

  return {
    HORIZON_KEYS,
    RECOMMENDATION_SECTION_KEYS,
    qualificationReasons,
    isQualified,
    qualifyRows,
    requalifyDerivedRows,
    normalizeStocksToBuyCenter,
    deriveMarketSemantics,
    summarize,
    normalizePayload,
  };
});
