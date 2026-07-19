const DISCOVERY_ENGINE_VERSIONS = Object.freeze([
  "legacy",
  "v3-evidence-buckets",
]);

const DISCOVERY_EVIDENCE_SCHEMA_VERSION = "v3-evidence-1";
const DISCOVERY_EXPLANATION_VERSION = "v3-discovery-explanation-1";
const DISCOVERY_SHADOW_COMPARISON_VERSION = "v3-shadow-comparison-1";
const DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS = 200;
const DISCOVERY_SELECTOR_VERSION = "v3-selector-1";
const DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS = 200;

const DISCOVERY_SELECTOR_FALLBACK_REASONS = Object.freeze([
  "DEFAULTED_TO_LEGACY",
  "SHADOW_ONLY_CONFIGURATION",
  "UNKNOWN_ENGINE",
  "MALFORMED_CONFIGURATION",
  "V3_EXECUTION_ERROR",
  "V3_INVALID_OUTPUT",
  "V3_EMPTY_POOL",
  "V3_BELOW_MINIMUM_POOL",
  "V3_ABOVE_MAXIMUM_POOL",
  "V3_INELIGIBLE_CANDIDATE",
  "V3_UNQUALIFIED_CANDIDATE",
  "V3_DUPLICATE_TICKER",
  "V3_RUNTIME_LIMIT_EXCEEDED",
  "V3_FATAL_DIAGNOSTIC",
  "V3_ACTIVE",
]);
const DISCOVERY_REGIME_SCHEMA_VERSION = "v3-regime-1";
const DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT = 0.15;

const DISCOVERY_SUPPORTED_SECURITY_TYPES = Object.freeze([
  "Common Stock",
  "ETF",
  "ADR",
  "Closed-End Fund",
]);

const DISCOVERY_EVIDENCE_FIELD_PATHS = Object.freeze([
  "market.price",
  "market.previousClose",
  "market.change",
  "market.changePercent",
  "market.volume",
  "market.dollarVolume",
  "market.averageVolume20",
  "market.averageDollarVolume20",
  "market.relativeVolume",
  "market.high20",
  "market.low20",
  "market.high60",
  "market.low60",
  "market.return1",
  "market.return5",
  "market.return20",
  "market.volatility20",
  "market.movingAverage5",
  "market.movingAverage20",
  "market.distanceFromHigh20Percent",
  "market.distanceFromLow20Percent",
  "catalysts.earnings.nextEarningsAt",
  "catalysts.earnings.previousEarningsAt",
  "catalysts.earnings.daysUntilEarnings",
  "catalysts.earnings.daysSinceEarnings",
  "catalysts.earnings.surprisePercent",
  "catalysts.earnings.postEarningsReturn",
  "catalysts.congressional.buyCount",
  "catalysts.congressional.sellCount",
  "catalysts.congressional.memberCount",
  "catalysts.congressional.bipartisan",
  "catalysts.congressional.transactionValueMinimum",
  "catalysts.congressional.transactionValueMaximum",
  "catalysts.congressional.latestTransactionAt",
  "catalysts.congressional.latestDisclosureAt",
  "catalysts.policy.signalCount",
  "catalysts.policy.positiveCount",
  "catalysts.policy.negativeCount",
  "catalysts.policy.independentSourceCount",
  "catalysts.policy.strongestScore",
  "catalysts.policy.strongestDirection",
  "catalysts.policy.strongestSummary",
  "context.sectorReturn1",
  "context.sectorReturn5",
  "context.sectorReturn20",
  "context.marketReturn1",
  "context.marketReturn5",
  "context.marketReturn20",
  "context.sectorRelativeStrength",
  "context.marketRelativeStrength",
  "context.sectorBreadth",
]);

const DISCOVERY_BUCKET_DEFINITIONS = Object.freeze({
  momentum: Object.freeze({ label: "Momentum Leaders", minimumScore: 55, reservationTarget: 40, requiredEvidence: ["market.return5", "market.return20", "context.marketRelativeStrength"] }),
  relativeVolume: Object.freeze({ label: "High Relative Volume", minimumScore: 55, reservationTarget: 40, requiredEvidence: ["market.volume", "market.averageVolume20", "market.relativeVolume"] }),
  breakout: Object.freeze({ label: "Breakout Candidates", minimumScore: 55, reservationTarget: 40, requiredEvidence: ["market.price", "market.high20", "market.distanceFromHigh20Percent", "market.relativeVolume"] }),
  earnings: Object.freeze({ label: "Earnings Catalysts", minimumScore: 55, reservationTarget: 30, requiredEvidence: ["catalysts.earnings.daysUntilEarnings", "catalysts.earnings.nextEarningsAt"] }),
  congressional: Object.freeze({ label: "Congressional Activity", minimumScore: 45, reservationTarget: 20, requiredEvidence: ["catalysts.congressional.buyCount", "catalysts.congressional.memberCount", "catalysts.congressional.latestDisclosureAt"] }),
  policy: Object.freeze({ label: "Policy Catalysts", minimumScore: 45, reservationTarget: 20, requiredEvidence: ["catalysts.policy.signalCount", "catalysts.policy.independentSourceCount", "catalysts.policy.strongestDirection"] }),
  sectorLeaders: Object.freeze({ label: "Sector Leaders", minimumScore: 55, reservationTarget: 40, requiredEvidence: ["context.sectorReturn5", "context.sectorReturn20", "context.sectorRelativeStrength"] }),
  reversal: Object.freeze({ label: "Reversal Candidates", minimumScore: 55, reservationTarget: 30, requiredEvidence: ["market.return5", "market.return20", "market.distanceFromLow20Percent", "market.movingAverage20"] }),
});

const DEFAULT_BUCKET_SETTINGS = Object.freeze(
  Object.fromEntries(
    Object.entries(DISCOVERY_BUCKET_DEFINITIONS).map(([key, definition]) => [
      key,
      Object.freeze({
        enabled: true,
        minimumScore: definition.minimumScore,
        reservationTarget: definition.reservationTarget,
      }),
    ]),
  ),
);

const DISCOVERY_REGIME_NEUTRAL_BUCKET_EMPHASIS = Object.freeze(
  Object.fromEntries(
    Object.keys(DISCOVERY_BUCKET_DEFINITIONS).map((bucket) => [bucket, 1]),
  ),
);

const DISCOVERY_CANDIDATE_POOL_DEFAULTS = Object.freeze({
  deepAnalysisLimit: 40,
  maximumSectorConcentrationPercent: 20,
  maximumBreadthContribution: 12,
  perAdditionalBucketContribution: 3,
  watchlistPriorityContribution: 2,
  watchlistOverrideEnabled: true,
});

const DISCOVERY_EXPLANATION_REASON_CODES = Object.freeze([
  "QUALIFIED_BUCKET",
  "BELOW_BUCKET_THRESHOLD",
  "MISSING_REQUIRED_EVIDENCE",
  "STALE_EVIDENCE",
  "FALLBACK_EVIDENCE",
  "PRODUCTION_INELIGIBLE",
  "UNSUPPORTED_SECURITY_TYPE",
  "INACTIVE_SECURITY",
  "GENERATED_FIXTURE",
  "DUPLICATE_RECORD_MERGED",
  "SELECTED_FOR_DEEP_ANALYSIS",
  "EXCLUDED_POOL_LIMIT",
  "EXCLUDED_SECTOR_CONCENTRATION",
  "EXCLUDED_BUCKET_DIVERSITY",
  "WATCHLIST_PRIORITY_APPLIED",
  "WATCHLIST_DID_NOT_QUALIFY",
  "REGIME_ADJUSTMENT_APPLIED",
  "REGIME_UNAVAILABLE",
  "UNKNOWN_SECTOR",
  "PROVIDER_LIMITATION",
  "MALFORMED_INPUT",
]);

const DEFAULT_V3_DISCOVERY_SETTINGS = Object.freeze({
  discoveryEngineVersion: "legacy",
  discoveryShadowComparisonEnabled: true,
  discoveryEvidenceVersion: DISCOVERY_EVIDENCE_SCHEMA_VERSION,
  discoveryMaximumEvidenceAgeMs: 24 * 60 * 60 * 1000,
  minimumDiscoveryDataQuality: 35,
  minimumDiscoveryScore: 0,
  minimumDollarVolume: 1_000_000,
  maximumSectorConcentrationPercent: 20,
  watchlistOverrideEnabled: true,
  discoveryMinimumViableCandidateCount: 1,
  discoveryMaximumCandidateCount: 600,
  discoverySelectorMaximumDurationMs: 10000,
  bucketSettings: DEFAULT_BUCKET_SETTINGS,
});

module.exports = {
  DEFAULT_BUCKET_SETTINGS,
  DEFAULT_V3_DISCOVERY_SETTINGS,
  DISCOVERY_CANDIDATE_POOL_DEFAULTS,
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_EVIDENCE_FIELD_PATHS,
  DISCOVERY_EVIDENCE_SCHEMA_VERSION,
  DISCOVERY_ENGINE_VERSIONS,
  DISCOVERY_EXPLANATION_REASON_CODES,
  DISCOVERY_EXPLANATION_VERSION,
  DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
  DISCOVERY_REGIME_NEUTRAL_BUCKET_EMPHASIS,
  DISCOVERY_REGIME_SCHEMA_VERSION,
  DISCOVERY_SHADOW_COMPARISON_VERSION,
  DISCOVERY_SHADOW_DIAGNOSTIC_MAX_ITEMS,
  DISCOVERY_SELECTOR_DIAGNOSTIC_MAX_ITEMS,
  DISCOVERY_SELECTOR_FALLBACK_REASONS,
  DISCOVERY_SELECTOR_VERSION,
  DISCOVERY_SUPPORTED_SECURITY_TYPES,
};
