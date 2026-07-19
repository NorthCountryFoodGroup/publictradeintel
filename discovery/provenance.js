const MAXIMUM_PROVENANCE_TEXT_LENGTH = 160;

function boundedProvenanceText(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, MAXIMUM_PROVENANCE_TEXT_LENGTH) : fallback;
}

function sourceKind(value) {
  const text = String(value || "").toLowerCase();
  if (/emergency|preset fallback|generated fixture/.test(text)) return "emergency";
  if (/saved[- ]snapshot|saved listing|stale|saved|cache/.test(text)) return "saved";
  if (/packaged|cached public|snapshot/.test(text)) return "cached";
  if (/live|nasdaq trader|exchange listing/.test(text)) return "live";
  return "unknown";
}

function resolveUniverseProvenance(metadata = {}) {
  const source = boundedProvenanceText(metadata.source);
  const primarySource = boundedProvenanceText(metadata.primarySource || metadata.primary?.source || source);
  const fallbackReason = boundedProvenanceText(
    metadata.initializationDiagnostics?.fallbackReason ||
    metadata.lastRefreshError ||
    metadata.fallbackReason,
  );
  const sources = [...new Set((Array.isArray(metadata.sources) ? metadata.sources : [])
    .map((item) => boundedProvenanceText(item?.source || item))
    .filter(Boolean))].slice(0, 8);
  const status = boundedProvenanceText(metadata.refreshStatus, "unknown").toLowerCase();
  const emergency = metadata.emergencyFallbackActive === true || status === "emergency-preset-fallback";
  const mixed = status === "mixed" || sources.length > 1;
  let kind = emergency ? "emergency" : sourceKind(status);
  if (kind === "unknown") kind = sourceKind(primarySource);
  if (metadata.packagedSnapshot === true || status === "packaged-snapshot") kind = "cached";
  if (metadata.savedSnapshot === true || status === "saved-snapshot") kind = "saved";
  if (status === "stale" && kind === "live") kind = "saved";

  let label = "Unknown";
  if (mixed) {
    label = primarySource ? `Mixed sources (primary: ${primarySource})` : "Mixed sources (primary: Unknown)";
  } else if (kind === "emergency") {
    label = "Emergency Preset Fallback";
  } else if (kind === "cached") {
    label = "Cached public listing snapshot";
  } else if (kind === "saved") {
    label = primarySource ? `Saved listing data (${primarySource})` : "Saved listing data";
  } else if (kind === "live") {
    label = primarySource ? `Live listing source (${primarySource})` : "Live Listing Source";
  }

  return {
    label: boundedProvenanceText(label, "Unknown"),
    sourceType: mixed ? "mixed" : kind,
    primarySource: primarySource || null,
    sources,
    fallbackReason,
  };
}

module.exports = {
  MAXIMUM_PROVENANCE_TEXT_LENGTH,
  boundedProvenanceText,
  resolveUniverseProvenance,
};
