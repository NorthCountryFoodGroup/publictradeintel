(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PublicTradeIntelScanOutcome = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STATES = Object.freeze({ SUCCESS: "SUCCESS", DEGRADED: "DEGRADED", FAILED: "FAILED" });
  function classify(payload = {}) {
    const scan = payload.scanHealth || payload;
    const health = payload.predictionEngineHealth || {};
    const semantics = payload.predictionSemantics || {};
    const completed = scan.scanStatus === "completed" || Boolean(scan.scanCompletedAt || payload.updatedAt);
    const analyzed = Number(semantics.analyzedCount ?? scan.deepCandidatesSelected ?? health.tickersScanned) || 0;
    const stored = Number(semantics.storedCount ?? health.predictionsGenerated) || 0;
    const usable = Number(semantics.usableMarketDataCount ?? health.usablePredictionRecords) || 0;
    const qualified = Number(semantics.qualifiedCount ?? health.qualifiedRecommendationCount) || 0;
    const availability = String(semantics.marketDataAvailability || scan.dataAvailability || health.dataAvailability || "Unavailable");
    const engineFailed = String(health.predictionEngineStatus || health.status || "").toLowerCase() === "failed";
    let status = STATES.SUCCESS;
    let reasonCode = "USABLE_SCAN_COMPLETED";
    if (!completed || engineFailed || (analyzed > 0 && stored === 0)) {
      status = STATES.FAILED; reasonCode = !completed ? "SCAN_NOT_COMPLETED" : engineFailed ? "ENGINE_FAILED" : "AUTHORITATIVE_OUTPUT_MISSING";
    } else if (usable === 0 || availability.toLowerCase() === "unavailable") {
      status = STATES.DEGRADED; reasonCode = usable === 0 ? "NO_USABLE_MARKET_EVIDENCE" : "MARKET_DATA_UNAVAILABLE";
    }
    const copy = status === STATES.SUCCESS
      ? { title: "Scan complete", explanation: "Market data was available and the scan completed normally.", decisionImpact: "Review the recommendation categories and supporting evidence." }
      : status === STATES.DEGRADED
        ? { title: "Scan degraded", explanation: "The scan finished, but important market data was unavailable or incomplete.", decisionImpact: "Market data wasn't reliable enough for normal recommendations, so PublicTradeIntel withheld them." }
        : { title: "Scan failed", explanation: "The scan could not safely complete.", decisionImpact: "No new authoritative recommendation output was issued." };
    return Object.freeze({ status, reasonCode, completed, analyzedCount: analyzed, storedCount: stored, usableMarketDataCount: usable, qualifiedCount: qualified, marketDataAvailability: availability, recommendationUseAllowed: status === STATES.SUCCESS, ...copy });
  }
  return { STATES, classify };
});
