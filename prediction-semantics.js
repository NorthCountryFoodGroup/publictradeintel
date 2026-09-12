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
    const sections = { ...(source.sections || {}) };
    RECOMMENDATION_SECTION_KEYS.forEach((key) => {
      if (Array.isArray(sections[key])) sections[key] = qualifyRows(sections[key]);
    });
    const normalized = { ...source, sections };
    normalized.predictionSemantics = summarize(normalized);
    normalized.predictions = (Array.isArray(source.predictions) ? source.predictions : []).map((record) => ({
      ...record,
      recommendationQualified: isQualified(record),
      qualificationState: isQualified(record) ? "qualified" : "insufficient-evidence",
      qualificationReasons: qualificationReasons(record),
    }));
    return normalized;
  }

  return { HORIZON_KEYS, RECOMMENDATION_SECTION_KEYS, qualificationReasons, isQualified, qualifyRows, summarize, normalizePayload };
});
