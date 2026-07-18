const DISCOVERY_ENGINE_VERSIONS = Object.freeze([
  "legacy",
  "v3-evidence-buckets",
]);

const DISCOVERY_EVIDENCE_SCHEMA_VERSION = "v3-evidence-1";
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
  momentum: Object.freeze({ label: "Momentum Leaders", minimumScore: 55, reservationTarget: 40 }),
  relativeVolume: Object.freeze({ label: "High Relative Volume", minimumScore: 55, reservationTarget: 40 }),
  breakout: Object.freeze({ label: "Breakout Candidates", minimumScore: 55, reservationTarget: 40 }),
  earnings: Object.freeze({ label: "Earnings Catalysts", minimumScore: 55, reservationTarget: 30 }),
  congressional: Object.freeze({ label: "Congressional Activity", minimumScore: 45, reservationTarget: 20 }),
  policy: Object.freeze({ label: "Policy Catalysts", minimumScore: 45, reservationTarget: 20 }),
  sectorLeaders: Object.freeze({ label: "Sector Leaders", minimumScore: 55, reservationTarget: 40 }),
  reversal: Object.freeze({ label: "Reversal Candidates", minimumScore: 55, reservationTarget: 30 }),
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
  bucketSettings: DEFAULT_BUCKET_SETTINGS,
});

module.exports = {
  DEFAULT_BUCKET_SETTINGS,
  DEFAULT_V3_DISCOVERY_SETTINGS,
  DISCOVERY_BUCKET_DEFINITIONS,
  DISCOVERY_EVIDENCE_FIELD_PATHS,
  DISCOVERY_EVIDENCE_SCHEMA_VERSION,
  DISCOVERY_ENGINE_VERSIONS,
  DISCOVERY_REGIME_MAXIMUM_ADJUSTMENT,
  DISCOVERY_REGIME_NEUTRAL_BUCKET_EMPHASIS,
  DISCOVERY_REGIME_SCHEMA_VERSION,
  DISCOVERY_SUPPORTED_SECURITY_TYPES,
};
