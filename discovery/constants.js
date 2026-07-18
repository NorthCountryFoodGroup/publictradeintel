const DISCOVERY_ENGINE_VERSIONS = Object.freeze([
  "legacy",
  "v3-evidence-buckets",
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

const DEFAULT_V3_DISCOVERY_SETTINGS = Object.freeze({
  discoveryEngineVersion: "legacy",
  discoveryShadowComparisonEnabled: true,
  discoveryEvidenceVersion: "v3-evidence-1",
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
  DISCOVERY_ENGINE_VERSIONS,
};
