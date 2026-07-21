"use strict";

const {
  CHALLENGER_DISPOSITIONS,
  COMMITTEE_DISPOSITIONS,
  COMMITTEE_ROLES,
  CONFIDENCE_RELIABILITY_TIERS,
  CONFIDENCE_TIERS,
  DECISION_ACTIONS,
  DECISION_SCHEMA_VERSIONS,
  DEFAULT_MAXIMUM_LEARNING_ADJUSTMENT,
  EVIDENCE_CERTAINTY_CATEGORIES,
  INVESTMENT_HORIZONS,
  INVESTMENT_OBJECTIVES,
  INVESTMENT_OBJECTIVES_V2,
  LEARNING_RECOMMENDATIONS,
  MANDATE_STATUSES,
  MANDATE_STATUSES_V2,
  MAXIMUM_ARRAY_ITEMS,
  MAXIMUM_POSITIONS,
  MISTAKE_CATEGORIES,
  OPERATING_SESSION_STATUSES,
  OPERATING_SESSION_STATUSES_V2,
  OPERATING_SESSION_MODES,
  OPERATING_DECISION_TYPES,
  OPERATING_STAGES,
  OPERATING_STAGES_V2,
  OPERATING_STAGE_STATES,
  OPERATING_STAGE_STATES_V2,
  OUTCOME_STATES,
  SELL_AUTHORITY_MODES,
  SELL_ANALYSIS_AUTHORITIES,
  SHARE_MODES,
  VALIDATION_STATES,
} = require("./constants");
const { normalizeDecisionParameters, normalizeSymbol, validateDecisionParameters } = require("./parameters");

const FORBIDDEN_KEY = /(^|_)(reasoning|chainOfThought|hiddenThoughts|prompt|systemPrompt|credential|password|secret|token|pin|environment|envValue|absolutePath|filePath|rawPayload|providerPayload|providerResponse|accountNumber|orderField|orderRouting|routingField|routingData|executionField|executionInstructions|activationField)($|_)/i;
const GENERATION_MODES = Object.freeze(["DETERMINISTIC", "AI_SCHEMA_VALIDATED", "DETERMINISTIC_FALLBACK"]);
const SUPPORT_DIRECTIONS = Object.freeze(["SUPPORTS", "OPPOSES", "NEUTRAL"]);
const MISTAKE_STATUSES = Object.freeze(["ANECDOTAL", "OBSERVING", "LEARNING_ELIGIBLE", "RETIRED"]);
const RANGE_KEYS = Object.freeze(["minimum", "maximum"]);

const SCHEMA_KEYS = Object.freeze({
  evidenceSummary: ["operatingSessionId", "evidenceSummaryId", "schemaVersion", "symbol", "decisionTimestamp", "horizon", "evidenceIds", "provenanceIds", "supportingEvidence", "opposingEvidence", "missingEvidence", "conflictingEvidence", "evidenceQuality", "evidenceFreshness", "confidence", "confidenceReliability", "knownFacts", "derivedMetrics", "estimates", "unresolvedQuestions", "staleSourceWarnings", "fallbackSourceWarnings", "validationStatus"],
  thesis: ["operatingSessionId", "investmentMandateId", "thesisId", "schemaVersion", "experimental", "shadowOnly", "productionApproved", "reviewRequired", "inputSnapshotId", "decisionTimestamp", "symbol", "horizon", "proposedAction", "thesisSummary", "whyNow", "supportingEvidenceIds", "opposingEvidenceIds", "assumptions", "unresolvedQuestions", "catalyst", "catalystWindow", "bullCase", "baseCase", "bearCase", "expectedReturnRange", "expectedDownsideRange", "confidence", "confidenceReliability", "conviction", "uncertainty", "entryLogic", "exitLogic", "invalidationConditions", "maximumIntendedHoldingPeriod", "allocationRationale", "strongestCounterargument", "whyNotBuy", "whatWouldChangeMyMind", "alternativesConsidered", "cashComparison", "provenanceIds", "dataTimestamp", "dataFreshness", "modelVersion", "ruleVersion", "evidenceVersion", "learningWeightVersion", "generationMode", "validationStatus", "warnings"],
  committeeOpinion: ["operatingSessionId", "committeeOpinionId", "schemaVersion", "decisionRunId", "symbol", "horizon", "role", "disposition", "confidence", "confidenceReliability", "conviction", "evidenceIds", "supportingPoints", "opposingPoints", "missingInformation", "keyAssumptions", "principalRisk", "preferredAction", "allocationView", "whatWouldChangeOpinion", "validationStatus", "generationMode"],
  committeeDecision: ["operatingSessionId", "committeeDecisionId", "schemaVersion", "decisionRunId", "symbol", "horizon", "memberOpinionIds", "agreementSummary", "disagreementSummary", "strongestSupportingView", "strongestOpposingView", "unresolvedDisputes", "chairDisposition", "chairConfidence", "chairConfidenceReliability", "chairConviction", "preferredAction", "proposedAllocationRange", "cashPreference", "rationaleSummary", "whatWouldReverseDecision", "validationStatus", "experimental", "shadowOnly", "productionApproved", "reviewRequired"],
  candidateComparison: ["operatingSessionId", "comparisonId", "schemaVersion", "decisionRunId", "horizon", "candidateSymbol", "alternativeSymbol", "cashIncluded", "candidateExpectedReturnRange", "alternativeExpectedReturnRange", "candidateExpectedDownsideRange", "alternativeExpectedDownsideRange", "candidateEvidenceQuality", "alternativeEvidenceQuality", "candidateConfidence", "alternativeConfidence", "candidateConfidenceReliability", "alternativeConfidenceReliability", "candidateConviction", "alternativeConviction", "candidateLiquidity", "alternativeLiquidity", "candidateVolatility", "alternativeVolatility", "candidateRegimeFit", "alternativeRegimeFit", "candidatePortfolioFit", "alternativePortfolioFit", "candidateRiskAdjustedUtility", "alternativeRiskAdjustedUtility", "preferredOption", "preferenceReasonCodes", "strongestReasonAgainstPreference", "whatWouldReversePreference", "validationStatus"],
  opportunityCost: ["operatingSessionId", "opportunityCostId", "schemaVersion", "selectedSymbol", "rejectedAlternative", "cashAlternative", "capitalAmount", "selectedAllocation", "estimatedForegoneReturnRange", "estimatedAvoidedDownsideRange", "diversificationEffect", "concentrationEffect", "liquidityEffect", "transactionCostDifference", "reasonSelected", "uncertainty", "validationStatus"],
  portfolioDecision: ["operatingSessionId", "investmentMandateId", "decisionRunId", "schemaVersion", "experimental", "shadowOnly", "productionApproved", "reviewRequired", "parameterSetId", "inputSnapshotId", "createdAt", "horizon", "status", "positions", "retainedCash", "retainedCashPercent", "rejectedCandidates", "deferredCandidates", "noTradeReason", "portfolioConstraints", "concentrationDiagnostics", "opportunityCosts", "expectedPortfolioReturnRange", "expectedPortfolioDownsideRange", "confidence", "confidenceReliability", "conviction", "uncertainty", "transactionCostEstimate", "warnings", "validationStatus"],
  challenger: ["operatingSessionId", "challengerResultId", "schemaVersion", "decisionRunId", "reviewedThesisIds", "reviewedCommitteeDecisionIds", "reviewedPortfolioDecisionId", "disposition", "reasonCodes", "unsupportedAssumptions", "omittedContradictions", "confidenceConcerns", "confidenceReliabilityConcerns", "convictionConcerns", "singleSignalDependencies", "plausibilityConcerns", "liquidityConcerns", "concentrationConcerns", "regimeConcerns", "staleEvidenceConcerns", "fallbackEvidenceConcerns", "priorFailureSimilarities", "cashAlternativeAssessment", "strongerRejectedAlternative", "beforeState", "afterState", "unresolvedConcerns", "validationStatus"],
  outcome: ["operatingSessionId", "outcomeId", "schemaVersion", "decisionRunId", "thesisId", "symbol", "horizon", "decisionTimestamp", "evaluationDeadline", "evaluationTimestamp", "state", "entryPrice", "exitPrice", "benchmarkSymbol", "benchmarkEntryPrice", "benchmarkExitPrice", "rawReturn", "netReturn", "benchmarkReturn", "benchmarkRelativeReturn", "maximumFavorableExcursion", "maximumAdverseExcursion", "volatility", "drawdown", "slippageEstimate", "transactionCostEstimate", "expectedReturnRange", "expectedDownsideRange", "catalystOccurred", "invalidationOccurred", "thesisAssessment", "timingAssessment", "allocationAssessment", "confidenceCalibrationAssessment", "confidenceReliabilityAssessment", "unresolvedMetrics", "sourceTimestamps", "validationStatus"],
  replay: ["operatingSessionId", "investmentMandateId", "replayId", "schemaVersion", "decisionRunId", "originalDecisionTimestamp", "replayGeneratedAt", "originalParameters", "originalEvidenceSummary", "originalThesis", "originalCommitteeOpinions", "originalCommitteeDecision", "originalCandidateComparisons", "originalOpportunityCosts", "originalPortfolioDecision", "originalChallengerResult", "observedOutcomeIds", "assumptionsConfirmed", "assumptionsRejected", "evidenceThatChanged", "mistakesIdentified", "strengthsIdentified", "hindsightWarning", "decisionUsingOriginalInformation", "decisionUsingCurrentInformation", "whatTheEngineWouldDoDifferently", "boundedLearningReferences", "validationStatus"],
  mistakeMemory: ["operatingSessionIds", "mistakeMemoryId", "schemaVersion", "createdAt", "updatedAt", "status", "mistakeCategory", "affectedHorizons", "affectedSectors", "affectedRegimes", "affectedEvidenceTypes", "affectedSignals", "associatedDecisionRunIds", "independentObservationCount", "recurringPattern", "exampleSummaries", "suspectedCause", "measuredImpact", "confidence", "confidenceReliability", "correctiveProposal", "productionAction", "reviewRequired", "validationWarnings"],
  learningProposal: ["operatingSessionIds", "proposalId", "schemaVersion", "createdAt", "recommendation", "baselineVersion", "proposedVersion", "trainingWindow", "evaluationWindow", "embargoWindow", "independentSampleCount", "affectedParameters", "boundedAdjustments", "maximumAdjustmentPerParameter", "totalAdjustmentBudget", "baselineMetrics", "proposalMetrics", "riskAdjustedComparison", "drawdownComparison", "turnoverComparison", "stabilityAcrossWindows", "concentrationWarnings", "mistakeMemoryIds", "validationWarnings", "rollbackTarget", "productionEligible", "reviewRequired", "automaticActivationAllowed", "validationStatus"],
  investmentMandate: ["investmentMandateId","schemaVersion","createdAt","createdBy","experimental","shadowOnly","productionApproved","reviewRequired","mandateStatus","availableCapital","investmentObjective","customInvestmentObjective","primaryHorizon","secondaryHorizons","riskTolerance","maximumAcceptableLossAmount","maximumAcceptableLossPercent","desiredCashReserveAmount","desiredCashReservePercent","maximumPositions","minimumPositionAmount","maximumPositionPercent","sectorConcentrationLimit","industryConcentrationLimit","volatilityTolerance","liquidityRequirement","shareMode","existingHoldingsSnapshotId","existingCashPosition","excludedSymbols","excludedSectors","requiredSymbols","dividendPreference","incomePreference","growthPreference","valuePreference","capitalPreservationPreference","taxContext","transactionCostAssumptions","rebalancePreference","sellAuthorityMode","userConstraints","userPriorities","userQuestions","mandateWarnings","validationStatus"],
  operatingStageRecord: ["schemaVersion","stage","state","startedAt","completedAt","attemptCount","inputReferenceIds","outputReferenceIds","warningCodes","errorCodes","deferredReasonCodes","validationStatus"],
  investmentOperatingSession: ["operatingSessionId","schemaVersion","investmentMandateId","parameterSetId","inputSnapshotId","startedAt","completedAt","status","currentStage","stageRecords","completedStages","failedStages","deferredStages","candidateUniverseSummary","committeeRunIds","comparisonRunIds","opportunityCostIds","portfolioDecisionId","challengerResultId","decisionJournalEntryId","outcomeTrackingIds","decisionReplayId","mistakeMemoryIds","learningProposalIds","capitalAvailable","capitalAllocated","retainedCash","finalActionSummary","warnings","errors","experimental","shadowOnly","productionApproved","reviewRequired","validationStatus"],
  operatingSystemDecisionSummary: ["operatingSessionId","investmentMandateId","schemaVersion","generatedAt","mandateSummary","capitalAvailable","capitalAllocated","retainedCash","retainedCashPercent","primaryHorizon","secondaryHorizons","recommendedActions","existingHoldingActions","selectedPositions","rejectedCandidates","deferredCandidates","noTradeDecision","noTradeReason","primaryReasons","principalRisks","strongestCounterarguments","whatWouldChangeTheDecision","opportunityCosts","portfolioExpectedReturnRange","portfolioExpectedDownsideRange","confidence","confidenceReliability","conviction","uncertainty","committeeSummary","challengerSummary","dataFreshnessSummary","provenanceSummary","nextEvaluationDates","experimentalLabel","shadowOnlyLabel","validationStatus"],
  investmentMandateV2: ["id","schemaVersion","status","createdAt","updatedAt","name","description","availableCapital","existingCash","investmentObjective","customObjective","primaryHorizon","secondaryHorizons","riskTolerance","maximumAcceptableLossPercent","desiredCashReservePercent","maximumPositions","minimumPositionPercent","maximumPositionPercent","maximumSectorPercent","maximumSingleThemePercent","existingHoldings","requiredSymbols","excludedSymbols","excludedSectors","preferredSectors","preferences","constraints","sellAnalysisAuthority","notes","metadata"],
  operatingStageRecordV2: ["id","schemaVersion","operatingSessionId","stage","state","startedAt","completedAt","blockedReason","error","inputReferences","outputReferences","metrics","notes","metadata"],
  investmentOperatingSessionV2: ["id","schemaVersion","investmentMandateId","status","mode","createdAt","startedAt","completedAt","asOf","currentStage","stageRecords","discoveryRunId","predictionRunIds","inputSnapshotId","evidenceGraphId","candidateAssessmentIds","committeeDecisionId","comparisonSetId","allocationDecisionId","challengerReviewId","operatingSystemDecisionSummaryId","decisionJournalId","outcomeTrackingId","replayIds","learningProposalIds","warnings","errors","metrics","metadata"],
  operatingSystemDecisionSummaryV2: ["id","schemaVersion","investmentMandateId","operatingSessionId","createdAt","asOf","decisionType","status","selectedPositions","retainedCashAmount","retainedCashPercent","rejectedCandidates","noTradeReason","committeeSummary","challengerSummary","confidence","confidenceReliability","conviction","uncertainty","strongestSupportingEvidenceIds","strongestOpposingEvidenceIds","missingInformation","primaryRisks","opportunityCostSummary","constraintChecks","whatWouldChangeTheDecision","warnings","metadata"],
});
SCHEMA_KEYS.evidenceSummary.push("evidenceGraphId");
for (const type of ["thesis", "portfolioDecision", "replay"]) {
  SCHEMA_KEYS[type].push("evidenceGraphId", "operatingSystemDecisionSummaryId");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function iso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function validId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value);
}
function uniqueIds(values) {
  return array(values) && values.every(validId) && new Set(values).size === values.length;
}
function validReferences(values, completedAt, errors, field) {
  if (!array(values)) return false;
  const ids = [];
  for (const reference of values) {
    if (typeof reference === "string") ids.push(reference);
    else if (reference && typeof reference === "object" && !Array.isArray(reference) &&
      Object.keys(reference).every((key) => ["referenceId", "createdAt"].includes(key)) &&
      validId(reference.referenceId) && iso(reference.createdAt)) {
      ids.push(reference.referenceId);
      if (field === "outputReferenceIds" && iso(completedAt) && Date.parse(reference.createdAt) > Date.parse(completedAt)) errors.push("Output reference cannot postdate stage completion.");
    } else return false;
  }
  return ids.every(validId) && new Set(ids).size === ids.length;
}
function array(value) {
  return Array.isArray(value) && value.length <= MAXIMUM_ARRAY_ITEMS;
}
function enumValue(value, values) {
  return values.includes(value);
}
function percent(value) {
  return finite(value) && value >= 0 && value <= 100;
}
function range(value, nullable = false) {
  if (nullable && value === null) return true;
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => RANGE_KEYS.includes(key)) &&
    finite(value.minimum) && finite(value.maximum) && value.minimum <= value.maximum;
}
function required(record, fields, errors) {
  fields.forEach((field) => {
    if (["investmentMandateId", "operatingSessionId", "operatingSessionIds", "evidenceGraphId", "operatingSystemDecisionSummaryId"].includes(field)) return;
    if (record[field] === undefined || record[field] === "") errors.push(`${field} is required.`);
  });
}
function strict(record, type, errors) {
  Object.keys(record).filter((key) => !SCHEMA_KEYS[type].includes(key)).forEach((key) => errors.push(`Unknown ${type} property: ${key}.`));
}
function forbiddenKey(key) {
  const normalized = String(key).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return [
    "reasoning", "chainofthought", "hiddenreasoning", "hiddenthoughts", "prompt",
    "systemprompt", "credential", "password", "secret", "token", "pin",
    "environment", "envvalue", "absolutepath", "filepath", "rawpayload",
    "providerpayload", "providerresponse", `bro${"kerage"}`, `bro${"keragefield"}`,
    "accountnumber", "orderfield", "orderrouting", "routingfield", "routingdata",
    "executionfield", "executioninstructions", "activationfield",
  ].some((term) => normalized === term || normalized.startsWith(term));
}
function scanForbidden(value, errors, prefix = "") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((item, index) => scanForbidden(item, errors, `${prefix}[${index}]`));
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key) || forbiddenKey(key)) errors.push(`Prohibited field: ${prefix}${key}.`);
    scanForbidden(nested, errors, `${prefix}${key}.`);
  }
}
function common(record, type, version, requiredFields) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return { valid: false, errors: [`${type} must be an object.`], normalized: record };
  strict(record, type, errors);
  scanForbidden(record, errors);
  required(record, requiredFields, errors);
  if (record.schemaVersion !== version) errors.push(`Unsupported ${type} schema version.`);
  if (record.validationStatus !== undefined && !enumValue(record.validationStatus, VALIDATION_STATES)) errors.push("Invalid validationStatus.");
  return { errors, normalized: clone(record) };
}
function result(errors, normalized) {
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(), normalized };
}
function validateConfidence(record, errors, confidence = "confidence", reliability = "confidenceReliability", conviction = "conviction") {
  if (!enumValue(record[confidence], CONFIDENCE_TIERS)) errors.push(`Invalid ${confidence}.`);
  if (!enumValue(record[reliability], CONFIDENCE_RELIABILITY_TIERS)) errors.push(`Invalid ${reliability}.`);
  if (conviction && !percent(record[conviction])) errors.push(`${conviction} must be between 0 and 100.`);
}
function enforceShadow(record, errors) {
  if (record.experimental !== true) errors.push("experimental must be true.");
  if (record.shadowOnly !== true) errors.push("shadowOnly must be true.");
  if (record.productionApproved !== false) errors.push("productionApproved must be false.");
  if (record.reviewRequired !== true) errors.push("reviewRequired must be true.");
}

function validateEvidenceItem(item, decisionTimestamp, errors) {
  const keys = ["evidenceId", "category", "summary", "sourceType", "provenanceId", "observedAt", "availableAt", "freshness", "certaintyCategory", "quality", "supportsOrOpposes", "numericFactReference"];
  if (!item || typeof item !== "object") return errors.push("Evidence item must be an object.");
  Object.keys(item).filter((key) => !keys.includes(key)).forEach((key) => errors.push(`Unknown evidence item property: ${key}.`));
  required(item, ["evidenceId", "category", "summary", "sourceType", "provenanceId", "observedAt", "availableAt", "freshness", "certaintyCategory", "quality", "supportsOrOpposes"], errors);
  if (!iso(item.observedAt) || !iso(item.availableAt)) errors.push("Evidence timestamps must be explicit ISO-8601 timestamps.");
  if (iso(item.availableAt) && iso(decisionTimestamp) && Date.parse(item.availableAt) > Date.parse(decisionTimestamp)) errors.push("Evidence available after decision time is prohibited.");
  if (!enumValue(item.certaintyCategory, EVIDENCE_CERTAINTY_CATEGORIES)) errors.push("Invalid evidence certainty category.");
  if (!enumValue(item.supportsOrOpposes, SUPPORT_DIRECTIONS)) errors.push("Invalid evidence direction.");
  if (!percent(item.quality)) errors.push("Evidence quality must be between 0 and 100.");
  if (item.numericFactReference !== null && item.numericFactReference !== undefined && !text(item.numericFactReference)) errors.push("Numeric facts require an evidence reference.");
}

function validateEvidenceSummary(record) {
  const base = common(record, "evidenceSummary", DECISION_SCHEMA_VERSIONS.EVIDENCE_SUMMARY, ["operatingSessionId", "evidenceSummaryId", "symbol", "decisionTimestamp", "horizon", "confidence", "confidenceReliability", "validationStatus"]);
  const { errors } = base;
  if (!normalizeSymbol(record.symbol)) errors.push("Valid symbol required.");
  if (!iso(record.decisionTimestamp)) errors.push("Invalid decisionTimestamp.");
  if (!enumValue(record.horizon, INVESTMENT_HORIZONS)) errors.push("Invalid horizon.");
  validateConfidence(record, errors, "confidence", "confidenceReliability", null);
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  ["supportingEvidence", "opposingEvidence", "missingEvidence", "conflictingEvidence", "knownFacts", "derivedMetrics", "estimates"].forEach((field) => {
    if (!array(record[field])) errors.push(`${field} must be a bounded array.`);
    else record[field].forEach((item) => validateEvidenceItem(item, record.decisionTimestamp, errors));
  });
  ["evidenceIds", "provenanceIds", "unresolvedQuestions", "staleSourceWarnings", "fallbackSourceWarnings"].forEach((field) => {
    if (!array(record[field])) errors.push(`${field} must be a bounded array.`);
  });
  if (!percent(record.evidenceQuality)) errors.push("evidenceQuality must be between 0 and 100.");
  return result(errors, base.normalized);
}

function validateThesis(record) {
  const base = common(record, "thesis", DECISION_SCHEMA_VERSIONS.THESIS, ["operatingSessionId", "investmentMandateId", "thesisId", "inputSnapshotId", "decisionTimestamp", "symbol", "horizon", "proposedAction", "confidence", "confidenceReliability", "conviction", "uncertainty", "validationStatus"]);
  const { errors } = base;
  enforceShadow(record, errors);
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId) || record.investmentMandateId !== undefined && !validId(record.investmentMandateId)) errors.push("Thesis operating-system linkage is malformed.");
  if (!iso(record.decisionTimestamp) || !iso(record.dataTimestamp) || (iso(record.dataTimestamp) && iso(record.decisionTimestamp) && Date.parse(record.dataTimestamp) > Date.parse(record.decisionTimestamp))) errors.push("Thesis timestamps are invalid or use future data.");
  if (!enumValue(record.horizon, INVESTMENT_HORIZONS) || !enumValue(record.proposedAction, DECISION_ACTIONS)) errors.push("Invalid thesis horizon or action.");
  validateConfidence(record, errors);
  if (!percent(record.uncertainty)) errors.push("uncertainty must be between 0 and 100.");
  if (!range(record.expectedReturnRange) || !range(record.expectedDownsideRange)) errors.push("Expected return and downside must be numeric ranges.");
  if (!enumValue(record.generationMode, GENERATION_MODES)) errors.push("Invalid generationMode.");
  if (!array(record.supportingEvidenceIds) || !array(record.opposingEvidenceIds) || !array(record.provenanceIds)) errors.push("Thesis evidence references must be bounded arrays.");
  const numericClaims = [record.expectedReturnRange, record.expectedDownsideRange];
  if (numericClaims.some(Boolean) && !(record.supportingEvidenceIds || []).length) errors.push("Numeric thesis facts require supporting evidence references.");
  return result(errors, base.normalized);
}

function validateCommitteeOpinion(record) {
  const base = common(record, "committeeOpinion", DECISION_SCHEMA_VERSIONS.COMMITTEE_OPINION, ["operatingSessionId", "committeeOpinionId", "decisionRunId", "symbol", "horizon", "role", "disposition", "confidence", "confidenceReliability", "conviction", "preferredAction", "validationStatus", "generationMode"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!enumValue(record.role, COMMITTEE_ROLES) || !enumValue(record.disposition, COMMITTEE_DISPOSITIONS)) errors.push("Invalid committee role or disposition.");
  if (!enumValue(record.horizon, INVESTMENT_HORIZONS) || !enumValue(record.preferredAction, DECISION_ACTIONS)) errors.push("Invalid committee horizon or action.");
  validateConfidence(record, errors);
  if (!array(record.evidenceIds) || !record.evidenceIds.length) errors.push("Committee opinion requires evidence IDs.");
  if (!enumValue(record.generationMode, GENERATION_MODES)) errors.push("Invalid generationMode.");
  return result(errors, base.normalized);
}

function validateCommitteeDecision(record) {
  const base = common(record, "committeeDecision", DECISION_SCHEMA_VERSIONS.COMMITTEE_DECISION, ["operatingSessionId", "committeeDecisionId", "decisionRunId", "symbol", "horizon", "memberOpinionIds", "chairDisposition", "chairConfidence", "chairConfidenceReliability", "chairConviction", "preferredAction", "proposedAllocationRange", "validationStatus"]);
  const { errors } = base;
  enforceShadow(record, errors);
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!array(record.memberOpinionIds) || record.memberOpinionIds.length !== 6) errors.push("Committee decision requires six member opinion IDs.");
  if (!enumValue(record.chairDisposition, COMMITTEE_DISPOSITIONS)) errors.push("Invalid chairDisposition.");
  validateConfidence(record, errors, "chairConfidence", "chairConfidenceReliability", "chairConviction");
  if (!range(record.proposedAllocationRange) || record.proposedAllocationRange.minimum < 0) errors.push("Invalid proposedAllocationRange.");
  return result(errors, base.normalized);
}

function validateCandidateComparison(record) {
  const base = common(record, "candidateComparison", DECISION_SCHEMA_VERSIONS.CANDIDATE_COMPARISON, ["operatingSessionId", "comparisonId", "decisionRunId", "horizon", "candidateSymbol", "alternativeSymbol", "preferredOption", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!enumValue(record.horizon, INVESTMENT_HORIZONS)) errors.push("Invalid comparison horizon.");
  ["candidateExpectedReturnRange", "alternativeExpectedReturnRange", "candidateExpectedDownsideRange", "alternativeExpectedDownsideRange"].forEach((field) => {
    if (!range(record[field])) errors.push(`${field} must be a numeric range.`);
  });
  ["candidateConfidence", "alternativeConfidence"].forEach((field) => {
    if (!enumValue(record[field], CONFIDENCE_TIERS)) errors.push(`Invalid ${field}.`);
  });
  ["candidateConfidenceReliability", "alternativeConfidenceReliability"].forEach((field) => {
    if (!enumValue(record[field], CONFIDENCE_RELIABILITY_TIERS)) errors.push(`Invalid ${field}.`);
  });
  ["candidateEvidenceQuality", "alternativeEvidenceQuality", "candidateConviction", "alternativeConviction"].forEach((field) => {
    if (!percent(record[field])) errors.push(`${field} must be between 0 and 100.`);
  });
  ["candidateRiskAdjustedUtility", "alternativeRiskAdjustedUtility"].forEach((field) => {
    if (!finite(record[field])) errors.push(`${field} must be finite.`);
  });
  return result(errors, base.normalized);
}

function validateOpportunityCost(record) {
  const base = common(record, "opportunityCost", DECISION_SCHEMA_VERSIONS.OPPORTUNITY_COST, ["operatingSessionId", "opportunityCostId", "selectedSymbol", "rejectedAlternative", "capitalAmount", "selectedAllocation", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!finite(record.capitalAmount) || record.capitalAmount < 0 || !finite(record.selectedAllocation) || record.selectedAllocation < 0 || record.selectedAllocation > record.capitalAmount) errors.push("Opportunity cost capital values are invalid.");
  if (!range(record.estimatedForegoneReturnRange) || !range(record.estimatedAvoidedDownsideRange)) errors.push("Opportunity cost ranges are invalid.");
  return result(errors, base.normalized);
}

function validatePortfolioDecision(record, parameters) {
  const base = common(record, "portfolioDecision", DECISION_SCHEMA_VERSIONS.PORTFOLIO_DECISION, ["operatingSessionId", "investmentMandateId", "decisionRunId", "parameterSetId", "inputSnapshotId", "createdAt", "horizon", "status", "positions", "retainedCash", "retainedCashPercent", "validationStatus"]);
  const { errors } = base;
  enforceShadow(record, errors);
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId) || record.investmentMandateId !== undefined && !validId(record.investmentMandateId)) errors.push("Portfolio operating-system linkage is malformed.");
  if (!iso(record.createdAt) || !enumValue(record.horizon, INVESTMENT_HORIZONS) || !enumValue(record.status, DECISION_ACTIONS)) errors.push("Portfolio timestamp, horizon, or status is invalid.");
  if (!array(record.positions)) errors.push("positions must be a bounded array.");
  const symbols = new Set();
  let allocated = 0;
  (record.positions || []).forEach((position) => {
    const symbol = normalizeSymbol(position.symbol);
    if (!symbol) errors.push("Position symbol is invalid.");
    if (symbols.has(symbol)) errors.push("Duplicate portfolio symbols are prohibited.");
    symbols.add(symbol);
    if (!enumValue(position.action, DECISION_ACTIONS) || !enumValue(position.existingPositionAction, DECISION_ACTIONS) || !enumValue(position.shareMode, SHARE_MODES)) errors.push("Position action or share mode is invalid.");
    ["price", "shares", "dollarAllocation", "portfolioPercent", "maximumLossAmount"].forEach((field) => {
      if (!finite(position[field]) || position[field] < 0) errors.push(`Position ${field} cannot be negative or non-finite.`);
    });
    if (!iso(position.priceTimestamp)) errors.push("Position priceTimestamp is invalid.");
    allocated += finite(position.dollarAllocation) ? position.dollarAllocation : 0;
  });
  if (!finite(record.retainedCash) || record.retainedCash < 0 || !percent(record.retainedCashPercent)) errors.push("Retained cash values are invalid.");
  if (parameters) {
    const parameterValidation = validateDecisionParameters(parameters);
    if (!parameterValidation.valid) errors.push("Portfolio parameters are invalid.");
    else {
      const capital = parameterValidation.normalized.availableCapital;
      if (allocated + record.retainedCash > capital + 1e-9) errors.push("Allocations plus retained cash exceed available capital.");
      if ((record.positions || []).length > parameterValidation.normalized.maximumPositions) errors.push("Position count exceeds maximumPositions.");
    }
  }
  if (record.status === "NO_TRADE" && (record.positions || []).length) errors.push("NO_TRADE must contain zero positions.");
  validateConfidence(record, errors);
  if (!percent(record.uncertainty)) errors.push("uncertainty must be between 0 and 100.");
  if (!range(record.expectedPortfolioReturnRange) || !range(record.expectedPortfolioDownsideRange)) errors.push("Portfolio expected ranges are invalid.");
  return result(errors, base.normalized);
}

function validateChallenger(record) {
  const base = common(record, "challenger", DECISION_SCHEMA_VERSIONS.CHALLENGER, ["operatingSessionId", "challengerResultId", "decisionRunId", "reviewedPortfolioDecisionId", "disposition", "beforeState", "afterState", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!enumValue(record.disposition, CHALLENGER_DISPOSITIONS)) errors.push("Invalid challenger disposition.");
  const before = record.beforeState || {};
  const after = record.afterState || {};
  ["confidence", "confidenceReliabilityScore", "conviction", "allocation"].forEach((field) => {
    if (!finite(before[field]) || !finite(after[field])) errors.push(`Challenger ${field} values must be finite.`);
    else if (after[field] > before[field]) errors.push(`Challenger cannot increase ${field}.`);
  });
  return result(errors, base.normalized);
}

function validateOutcome(record) {
  const base = common(record, "outcome", DECISION_SCHEMA_VERSIONS.OUTCOME, ["operatingSessionId", "outcomeId", "decisionRunId", "thesisId", "symbol", "horizon", "decisionTimestamp", "evaluationDeadline", "state", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId)) errors.push("operatingSessionId is malformed.");
  if (!enumValue(record.state, OUTCOME_STATES) || !enumValue(record.horizon, INVESTMENT_HORIZONS)) errors.push("Invalid outcome state or horizon.");
  if (!iso(record.decisionTimestamp) || !iso(record.evaluationDeadline) || (record.evaluationTimestamp !== null && !iso(record.evaluationTimestamp))) errors.push("Outcome timestamps are invalid.");
  const resultFields = ["exitPrice", "rawReturn", "netReturn", "benchmarkReturn", "benchmarkRelativeReturn", "maximumFavorableExcursion", "maximumAdverseExcursion", "volatility", "drawdown"];
  if (record.state === "UNRESOLVED" && resultFields.some((field) => record[field] !== null)) errors.push("Unresolved outcomes cannot contain forced result metrics.");
  resultFields.forEach((field) => {
    if (record[field] !== null && !finite(record[field])) errors.push(`${field} must remain null or be finite.`);
  });
  return result(errors, base.normalized);
}

function validateReplay(record) {
  const base = common(record, "replay", DECISION_SCHEMA_VERSIONS.REPLAY, ["operatingSessionId", "investmentMandateId", "replayId", "decisionRunId", "originalDecisionTimestamp", "replayGeneratedAt", "originalPortfolioDecision", "hindsightWarning", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionId !== undefined && !validId(record.operatingSessionId) || record.investmentMandateId !== undefined && !validId(record.investmentMandateId)) errors.push("Replay operating-system linkage is malformed.");
  if (!iso(record.originalDecisionTimestamp) || !iso(record.replayGeneratedAt) || Date.parse(record.replayGeneratedAt) < Date.parse(record.originalDecisionTimestamp)) errors.push("Replay chronology is invalid.");
  if (record.originalPortfolioDecision?.decisionRunId !== record.decisionRunId) errors.push("Replay cannot mutate the original decision ID.");
  const originalEvidenceTime = record.originalEvidenceSummary?.decisionTimestamp;
  if (originalEvidenceTime && Date.parse(originalEvidenceTime) > Date.parse(record.originalDecisionTimestamp)) errors.push("Hindsight information cannot be inserted into original evidence.");
  if (!text(record.hindsightWarning)) errors.push("Replay requires a hindsight warning.");
  return result(errors, base.normalized);
}

function validateMistakeMemory(record) {
  const base = common(record, "mistakeMemory", DECISION_SCHEMA_VERSIONS.MISTAKE_MEMORY, ["operatingSessionIds", "mistakeMemoryId", "createdAt", "updatedAt", "status", "mistakeCategory", "independentObservationCount", "productionAction", "reviewRequired"]);
  const { errors } = base;
  if (record.operatingSessionIds !== undefined && !uniqueIds(record.operatingSessionIds)) errors.push("operatingSessionIds must be unique valid IDs.");
  if (!iso(record.createdAt) || !iso(record.updatedAt) || Date.parse(record.updatedAt) < Date.parse(record.createdAt)) errors.push("Mistake-memory chronology is invalid.");
  if (!enumValue(record.status, MISTAKE_STATUSES) || !enumValue(record.mistakeCategory, MISTAKE_CATEGORIES)) errors.push("Invalid mistake-memory status or category.");
  if (!Number.isInteger(record.independentObservationCount) || record.independentObservationCount < 1) errors.push("independentObservationCount must be a positive integer.");
  if (record.status === "LEARNING_ELIGIBLE" && record.independentObservationCount < 2) errors.push("A single observation cannot be learning eligible.");
  if (record.productionAction !== "NONE" || record.reviewRequired !== true) errors.push("Mistake memory cannot directly change production.");
  validateConfidence(record, errors, "confidence", "confidenceReliability", null);
  return result(errors, base.normalized);
}

function validateLearningProposal(record) {
  const base = common(record, "learningProposal", DECISION_SCHEMA_VERSIONS.LEARNING_PROPOSAL, ["operatingSessionIds", "proposalId", "createdAt", "recommendation", "baselineVersion", "proposedVersion", "trainingWindow", "evaluationWindow", "embargoWindow", "independentSampleCount", "boundedAdjustments", "maximumAdjustmentPerParameter", "totalAdjustmentBudget", "rollbackTarget", "productionEligible", "reviewRequired", "automaticActivationAllowed", "validationStatus"]);
  const { errors } = base;
  if (record.operatingSessionIds !== undefined && !uniqueIds(record.operatingSessionIds)) errors.push("operatingSessionIds must be unique valid IDs.");
  if (!iso(record.createdAt) || !enumValue(record.recommendation, LEARNING_RECOMMENDATIONS)) errors.push("Invalid learning creation time or recommendation.");
  if (!text(record.baselineVersion) || !text(record.rollbackTarget)) errors.push("Baseline and rollback versions are required.");
  ["trainingWindow", "evaluationWindow", "embargoWindow"].forEach((field) => {
    if (!record[field] || !iso(record[field].start) || !iso(record[field].end) || Date.parse(record[field].start) >= Date.parse(record[field].end)) errors.push(`${field} chronology is invalid.`);
  });
  if (record.trainingWindow && record.evaluationWindow && Date.parse(record.trainingWindow.end) >= Date.parse(record.evaluationWindow.start)) errors.push("Training and evaluation windows must not overlap.");
  if (!Number.isInteger(record.independentSampleCount) || record.independentSampleCount < 1) errors.push("Independent sample count is required.");
  if (!finite(record.maximumAdjustmentPerParameter) || record.maximumAdjustmentPerParameter <= 0 || record.maximumAdjustmentPerParameter > DEFAULT_MAXIMUM_LEARNING_ADJUSTMENT) errors.push("maximumAdjustmentPerParameter exceeds the allowed bound.");
  if (!finite(record.totalAdjustmentBudget) || record.totalAdjustmentBudget <= 0) errors.push("totalAdjustmentBudget must be bounded and positive.");
  if (!record.boundedAdjustments || typeof record.boundedAdjustments !== "object") errors.push("boundedAdjustments are required.");
  else Object.entries(record.boundedAdjustments).forEach(([key, value]) => {
    if (!finite(value) || Math.abs(value) > record.maximumAdjustmentPerParameter) errors.push(`Learning adjustment exceeds bound: ${key}.`);
  });
  if (record.productionEligible !== false || record.reviewRequired !== true || record.automaticActivationAllowed !== false) errors.push("Learning proposals must remain review-only and production-ineligible.");
  if (!LEARNING_RECOMMENDATIONS.includes(record.recommendation)) errors.push("Unsupported promotion recommendation.");
  return result(errors, base.normalized);
}

function validateInvestmentMandate(record) {
  const requiredFields = SCHEMA_KEYS.investmentMandate.filter((field) => !["customInvestmentObjective", "existingHoldingsSnapshotId"].includes(field));
  const base = common(record, "investmentMandate", DECISION_SCHEMA_VERSIONS.INVESTMENT_MANDATE, requiredFields);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  enforceShadow(record, errors);
  if (!validId(record.investmentMandateId) || !iso(record.createdAt) || !text(record.createdBy)) errors.push("Mandate identity or creation fields are invalid.");
  if (!enumValue(record.mandateStatus, MANDATE_STATUSES)) errors.push("Invalid mandateStatus.");
  if (!enumValue(record.investmentObjective, INVESTMENT_OBJECTIVES)) errors.push("Invalid investmentObjective.");
  if (record.investmentObjective === "CUSTOM" && (!text(record.customInvestmentObjective) || record.customInvestmentObjective.length > 500)) errors.push("CUSTOM objective requires bounded custom text.");
  if (!enumValue(record.primaryHorizon, INVESTMENT_HORIZONS) || !array(record.secondaryHorizons) || new Set(record.secondaryHorizons).size !== record.secondaryHorizons.length || record.secondaryHorizons.some((horizon) => !INVESTMENT_HORIZONS.includes(horizon)) || record.secondaryHorizons.includes(record.primaryHorizon)) errors.push("Mandate horizons are invalid or duplicated.");
  if (!finite(record.availableCapital) || record.availableCapital <= 0) errors.push("availableCapital must be finite and positive.");
  ["riskTolerance","maximumAcceptableLossPercent","desiredCashReservePercent","maximumPositionPercent","sectorConcentrationLimit","industryConcentrationLimit","volatilityTolerance","liquidityRequirement","dividendPreference","incomePreference","growthPreference","valuePreference","capitalPreservationPreference"].forEach((field) => {
    if (!percent(record[field])) errors.push(`${field} must be between 0 and 100.`);
  });
  ["maximumAcceptableLossAmount","desiredCashReserveAmount","minimumPositionAmount","existingCashPosition"].forEach((field) => {
    if (!finite(record[field]) || record[field] < 0) errors.push(`${field} must be finite and nonnegative.`);
  });
  if (record.maximumAcceptableLossAmount > record.availableCapital) errors.push("Maximum acceptable loss cannot exceed capital.");
  if (record.desiredCashReserveAmount > record.availableCapital) errors.push("Desired cash reserve cannot exceed capital.");
  if (finite(record.desiredCashReserveAmount) && percent(record.desiredCashReservePercent) && Math.abs(record.desiredCashReserveAmount - record.availableCapital * record.desiredCashReservePercent / 100) > 0.01) errors.push("Cash reserve amount and percent are inconsistent.");
  if (record.minimumPositionAmount > record.availableCapital) errors.push("minimumPositionAmount cannot exceed capital.");
  if (!Number.isInteger(record.maximumPositions) || record.maximumPositions < 1 || record.maximumPositions > MAXIMUM_POSITIONS) errors.push("maximumPositions must be a bounded positive integer.");
  if (!enumValue(record.shareMode, SHARE_MODES) || !enumValue(record.sellAuthorityMode, SELL_AUTHORITY_MODES)) errors.push("Invalid shareMode or sellAuthorityMode.");
  for (const field of ["excludedSymbols","requiredSymbols"]) {
    if (!array(record[field])) errors.push(`${field} must be a bounded array.`);
    else {
      const normalized = record[field].map(normalizeSymbol);
      if (normalized.some((symbol, index) => !symbol || symbol !== record[field][index]) || new Set(normalized).size !== normalized.length) errors.push(`${field} must contain normalized unique symbols.`);
    }
  }
  if ((record.requiredSymbols || []).some((symbol) => (record.excludedSymbols || []).includes(symbol))) errors.push("Required symbols cannot overlap excluded symbols.");
  for (const field of ["excludedSectors","userConstraints","userPriorities","userQuestions","mandateWarnings"]) if (!array(record[field])) errors.push(`${field} must be a bounded array.`);
  return result(errors, base.normalized);
}

function validateOperatingStageRecord(record) {
  const base = common(record, "operatingStageRecord", DECISION_SCHEMA_VERSIONS.OPERATING_STAGE_RECORD, SCHEMA_KEYS.operatingStageRecord);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!enumValue(record.stage, OPERATING_STAGES) || !enumValue(record.state, OPERATING_STAGE_STATES)) errors.push("Invalid operating stage or state.");
  if (record.startedAt !== null && !iso(record.startedAt)) errors.push("startedAt must be null or ISO-8601.");
  if (record.completedAt !== null && !iso(record.completedAt)) errors.push("completedAt must be null or ISO-8601.");
  if (record.state === "NOT_STARTED" && (record.startedAt !== null || record.completedAt !== null)) errors.push("NOT_STARTED cannot have timestamps.");
  if (record.state === "READY" && record.completedAt !== null) errors.push("READY cannot have completedAt.");
  if (record.state === "RUNNING" && (!iso(record.startedAt) || record.completedAt !== null)) errors.push("RUNNING requires only startedAt.");
  if (record.state === "COMPLETED" && (!iso(record.startedAt) || !iso(record.completedAt))) errors.push("COMPLETED requires both timestamps.");
  if (record.state === "FAILED" && (!array(record.errorCodes) || !record.errorCodes.length)) errors.push("FAILED requires an error code.");
  if (record.state === "DEFERRED" && (!array(record.deferredReasonCodes) || !record.deferredReasonCodes.length)) errors.push("DEFERRED requires a reason code.");
  if (iso(record.startedAt) && iso(record.completedAt) && Date.parse(record.completedAt) < Date.parse(record.startedAt)) errors.push("completedAt cannot precede startedAt.");
  if (!Number.isInteger(record.attemptCount) || record.attemptCount < 0 || record.attemptCount > 100) errors.push("attemptCount must be a bounded nonnegative integer.");
  for (const field of ["inputReferenceIds","outputReferenceIds"]) if (!validReferences(record[field], record.completedAt, errors, field)) errors.push(`${field} must contain unique valid references.`);
  for (const field of ["warningCodes","errorCodes","deferredReasonCodes"]) if (!uniqueIds(record[field])) errors.push(`${field} must contain unique valid IDs.`);
  return result(errors, base.normalized);
}

function validateInvestmentOperatingSession(record, mandate = null) {
  const base = common(record, "investmentOperatingSession", DECISION_SCHEMA_VERSIONS.INVESTMENT_OPERATING_SESSION, SCHEMA_KEYS.investmentOperatingSession);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  enforceShadow(record, errors);
  if (!validId(record.operatingSessionId) || !validId(record.investmentMandateId)) errors.push("Session and mandate IDs are required and valid.");
  if (!enumValue(record.status, OPERATING_SESSION_STATUSES) || !enumValue(record.currentStage, OPERATING_STAGES)) errors.push("Invalid session status or current stage.");
  if (!iso(record.startedAt) || (record.completedAt !== null && !iso(record.completedAt)) || (iso(record.completedAt) && Date.parse(record.completedAt) < Date.parse(record.startedAt))) errors.push("Session chronology is invalid.");
  if (!finite(record.capitalAvailable) || record.capitalAvailable <= 0 || !finite(record.capitalAllocated) || record.capitalAllocated < 0 || !finite(record.retainedCash) || record.retainedCash < 0 || record.capitalAllocated + record.retainedCash > record.capitalAvailable + 1e-9) errors.push("Session capital values are invalid.");
  if (!array(record.stageRecords) || record.stageRecords.length !== OPERATING_STAGES.length) errors.push("Session requires one record for every operating stage.");
  const stageNames = (record.stageRecords || []).map((stage) => stage.stage);
  if (new Set(stageNames).size !== stageNames.length || OPERATING_STAGES.some((stage) => !stageNames.includes(stage))) errors.push("Session stage records must cover each stage exactly once.");
  (record.stageRecords || []).forEach((stage) => {
    const validation = validateOperatingStageRecord(stage);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${stage.stage}: ${error}`));
  });
  const states = (state) => (record.stageRecords || []).filter((stage) => stage.state === state).map((stage) => stage.stage).sort();
  for (const [field, state] of [["completedStages","COMPLETED"],["failedStages","FAILED"],["deferredStages","DEFERRED"]]) {
    if (!uniqueIds(record[field]) || JSON.stringify([...record[field]].sort()) !== JSON.stringify(states(state))) errors.push(`${field} does not match stage records.`);
  }
  if (mandate) {
    const mandateValidation = validateInvestmentMandate(mandate);
    if (!mandateValidation.valid || mandate.investmentMandateId !== record.investmentMandateId) errors.push("Linked mandate is invalid or mismatched.");
    if (record.capitalAvailable !== mandate.availableCapital) errors.push("Session capital must equal linked mandate capital.");
    if (["RUNNING","READY"].includes(record.status) && mandate.mandateStatus === "DRAFT") errors.push("A DRAFT mandate cannot run or be ready.");
  }
  if (record.status === "COMPLETED") {
    if (record.completedAt === null || (record.stageRecords || []).some((stage) => ["NOT_STARTED","READY","RUNNING"].includes(stage.state))) errors.push("An incomplete session cannot be COMPLETED.");
    const explicitNoTrade = record.finalActionSummary?.action === "NO_TRADE" && text(record.finalActionSummary?.reason);
    if (!validId(record.portfolioDecisionId) && !explicitNoTrade) errors.push("Completed session requires a portfolio decision or explicit no-trade result.");
  }
  return result(errors, base.normalized);
}

function validateOperatingSystemDecisionSummary(record) {
  const base = common(record, "operatingSystemDecisionSummary", DECISION_SCHEMA_VERSIONS.OPERATING_SYSTEM_DECISION_SUMMARY, SCHEMA_KEYS.operatingSystemDecisionSummary);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!validId(record.operatingSessionId) || !validId(record.investmentMandateId) || !iso(record.generatedAt)) errors.push("Decision summary identity or timestamp is invalid.");
  if (!finite(record.capitalAvailable) || !finite(record.capitalAllocated) || !finite(record.retainedCash) || record.capitalAllocated < 0 || record.retainedCash < 0 || record.capitalAllocated + record.retainedCash > record.capitalAvailable || !percent(record.retainedCashPercent)) errors.push("Decision summary capital is invalid.");
  if (!enumValue(record.primaryHorizon, INVESTMENT_HORIZONS) || !array(record.secondaryHorizons)) errors.push("Decision summary horizons are invalid.");
  validateConfidence(record, errors);
  if (!percent(record.uncertainty) || !range(record.portfolioExpectedReturnRange) || !range(record.portfolioExpectedDownsideRange)) errors.push("Decision summary metrics are invalid.");
  const narrative = JSON.stringify(record).toLowerCase();
  const prohibitedClaims = [
    /\b(trade|order)\s+(was\s+)?(placed|submitted|transmitted|executed)\b/,
    /\b(real|actual)\s+(owned\s+)?portfolio\b/,
    /\bunresolved\b[^.]{0,80}\b(profitable|profit|won|winner)\b/,
    /\blearning\b[^.]{0,80}\b(activated|applied|deployed)\b/,
    /\bproduction[\s-]+approved\b/,
  ];
  if (prohibitedClaims.some((pattern) => pattern.test(narrative))) errors.push("Decision summary contains a prohibited operational or performance claim.");
  if (!text(record.experimentalLabel) || !/experimental|prediction|recommendation/i.test(record.experimentalLabel) || !text(record.shadowOnlyLabel) || !/shadow|simulated/i.test(record.shadowOnlyLabel)) errors.push("Decision summary must clearly label experimental shadow output.");
  return result(errors, base.normalized);
}

function validateInvestmentMandateV2(record) {
  const base = common(record, "investmentMandateV2", DECISION_SCHEMA_VERSIONS.INVESTMENT_MANDATE_V2, SCHEMA_KEYS.investmentMandateV2);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!validId(record.id) || !iso(record.createdAt) || !iso(record.updatedAt) || Date.parse(record.updatedAt) < Date.parse(record.createdAt)) errors.push("V2 mandate identity or chronology is invalid.");
  if (!enumValue(record.status, MANDATE_STATUSES_V2) || !enumValue(record.investmentObjective, INVESTMENT_OBJECTIVES_V2) || !enumValue(record.sellAnalysisAuthority, SELL_ANALYSIS_AUTHORITIES)) errors.push("V2 mandate enum is invalid.");
  if (record.investmentObjective === "custom" && !text(record.customObjective)) errors.push("custom objective requires text.");
  if (!finite(record.availableCapital) || record.availableCapital <= 0 || !finite(record.existingCash) || record.existingCash < 0) errors.push("V2 mandate capital is invalid.");
  for (const field of ["riskTolerance","maximumAcceptableLossPercent","desiredCashReservePercent","minimumPositionPercent","maximumPositionPercent","maximumSectorPercent","maximumSingleThemePercent"]) if (!percent(record[field])) errors.push(`${field} must be between 0 and 100.`);
  if (record.minimumPositionPercent > record.maximumPositionPercent) errors.push("Minimum position percent cannot exceed maximum.");
  if (!Number.isInteger(record.maximumPositions) || record.maximumPositions < 1 || record.maximumPositions > MAXIMUM_POSITIONS) errors.push("maximumPositions must be bounded.");
  if (!enumValue(record.primaryHorizon, INVESTMENT_HORIZONS) || !array(record.secondaryHorizons) || record.secondaryHorizons.some((item) => !INVESTMENT_HORIZONS.includes(item)) || new Set(record.secondaryHorizons).size !== record.secondaryHorizons.length) errors.push("V2 mandate horizons are invalid.");
  for (const field of ["requiredSymbols","excludedSymbols"]) {
    if (!array(record[field])) errors.push(`${field} must be bounded.`);
    else {
      const symbols = record[field].map(normalizeSymbol);
      if (symbols.some((symbol, index) => !symbol || symbol !== record[field][index]) || new Set(symbols).size !== symbols.length) errors.push(`${field} must contain unique normalized symbols.`);
    }
  }
  if ((record.requiredSymbols || []).some((symbol) => (record.excludedSymbols || []).includes(symbol))) errors.push("Required and excluded symbols overlap.");
  if (!array(record.existingHoldings)) errors.push("existingHoldings must be bounded.");
  else {
    const symbols = [];
    record.existingHoldings.forEach((holding) => {
      if (!holding || typeof holding !== "object" || !validId(holding.id) || normalizeSymbol(holding.symbol) !== holding.symbol || !finite(holding.shares) || holding.shares < 0 || !finite(holding.marketValue) || holding.marketValue < 0) errors.push("Existing holding is invalid.");
      else symbols.push(holding.symbol);
    });
    if (new Set(symbols).size !== symbols.length) errors.push("Existing holding symbols must be unique.");
  }
  for (const field of ["excludedSectors","preferredSectors","preferences","constraints","notes"]) if (!array(record[field])) errors.push(`${field} must be bounded.`);
  return result(errors, base.normalized);
}

function validateOperatingStageRecordV2(record) {
  const base = common(record, "operatingStageRecordV2", DECISION_SCHEMA_VERSIONS.OPERATING_STAGE_RECORD_V2, SCHEMA_KEYS.operatingStageRecordV2);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!validId(record.id) || !validId(record.operatingSessionId) || !enumValue(record.stage, OPERATING_STAGES_V2) || !enumValue(record.state, OPERATING_STAGE_STATES_V2)) errors.push("V2 stage identity or enum is invalid.");
  if (record.startedAt !== null && !iso(record.startedAt) || record.completedAt !== null && !iso(record.completedAt)) errors.push("V2 stage timestamps are invalid.");
  if (record.state === "pending" && (record.startedAt !== null || record.completedAt !== null)) errors.push("Pending stage cannot have timestamps.");
  if (record.state === "running" && (!iso(record.startedAt) || record.completedAt !== null)) errors.push("Running stage requires only startedAt.");
  if (record.state === "completed" && (!iso(record.startedAt) || !iso(record.completedAt))) errors.push("Completed stage requires timestamps.");
  if (record.state === "blocked" && !text(record.blockedReason)) errors.push("Blocked stage requires a reason.");
  if (record.state === "failed" && !text(record.error)) errors.push("Failed stage requires an error.");
  if (iso(record.startedAt) && iso(record.completedAt) && Date.parse(record.completedAt) < Date.parse(record.startedAt)) errors.push("V2 stage chronology is invalid.");
  if (!uniqueIds(record.inputReferences) || !uniqueIds(record.outputReferences)) errors.push("V2 stage references must be unique IDs.");
  return result(errors, base.normalized);
}

function normalizeInvestmentOperatingSessionV2(record = {}) {
  const normalized = clone(record) || {};
  if (normalized.mode === undefined || normalized.mode === null || normalized.mode === "") normalized.mode = "shadow";
  return normalized;
}

function validateInvestmentOperatingSessionV2(record) {
  const normalized = normalizeInvestmentOperatingSessionV2(record);
  const requiredFields = SCHEMA_KEYS.investmentOperatingSessionV2.filter((field) => field !== "mode");
  const base = common(normalized, "investmentOperatingSessionV2", DECISION_SCHEMA_VERSIONS.INVESTMENT_OPERATING_SESSION_V2, requiredFields);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!validId(normalized.id) || !validId(normalized.investmentMandateId) || !enumValue(normalized.status, OPERATING_SESSION_STATUSES_V2) || !enumValue(normalized.mode, OPERATING_SESSION_MODES) || !enumValue(normalized.currentStage, OPERATING_STAGES_V2)) errors.push("V2 session identity, status, mode, or stage is invalid.");
  for (const field of ["createdAt","asOf"]) if (!iso(normalized[field])) errors.push(`${field} must be ISO-8601.`);
  for (const field of ["startedAt","completedAt"]) if (normalized[field] !== null && !iso(normalized[field])) errors.push(`${field} must be null or ISO-8601.`);
  if (iso(normalized.startedAt) && iso(normalized.completedAt) && Date.parse(normalized.completedAt) < Date.parse(normalized.startedAt)) errors.push("V2 session chronology is invalid.");
  if (!array(normalized.stageRecords)) errors.push("stageRecords must be bounded.");
  else normalized.stageRecords.forEach((stage) => {
    const validation = validateOperatingStageRecordV2(stage);
    if (!validation.valid || stage.operatingSessionId !== normalized.id) errors.push("Session contains an invalid or mismatched stage record.");
  });
  for (const field of ["predictionRunIds","candidateAssessmentIds","replayIds","learningProposalIds"]) if (!uniqueIds(normalized[field])) errors.push(`${field} must contain unique valid IDs.`);
  for (const field of ["discoveryRunId","inputSnapshotId","evidenceGraphId","committeeDecisionId","comparisonSetId","allocationDecisionId","challengerReviewId","operatingSystemDecisionSummaryId","decisionJournalId","outcomeTrackingId"]) if (normalized[field] !== null && !validId(normalized[field])) errors.push(`${field} must be null or a valid ID.`);
  if (normalized.status === "running" && normalized.startedAt === null) errors.push("Running session requires startedAt.");
  if (["completed","completed_no_trade"].includes(normalized.status) && normalized.completedAt === null) errors.push("Completed session requires completedAt.");
  return result(errors, normalized);
}

function validateOperatingSystemDecisionSummaryV2(record, mandate = null) {
  const base = common(record, "operatingSystemDecisionSummaryV2", DECISION_SCHEMA_VERSIONS.OPERATING_SYSTEM_DECISION_SUMMARY_V2, SCHEMA_KEYS.operatingSystemDecisionSummaryV2);
  if (!record || typeof record !== "object" || Array.isArray(record)) return result(base.errors, base.normalized);
  const { errors } = base;
  if (!validId(record.id) || !validId(record.investmentMandateId) || !validId(record.operatingSessionId) || !iso(record.createdAt) || !iso(record.asOf)) errors.push("V2 summary identity or chronology is invalid.");
  if (!enumValue(record.decisionType, OPERATING_DECISION_TYPES) || !enumValue(record.status, ["experimental","shadow_complete","shadow_no_trade"])) errors.push("V2 summary decision type or status is invalid.");
  if (!finite(record.retainedCashAmount) || record.retainedCashAmount < 0 || !percent(record.retainedCashPercent)) errors.push("V2 summary retained cash is invalid.");
  if (mandate && (mandate.id !== record.investmentMandateId || Math.abs(record.retainedCashAmount - mandate.availableCapital * record.retainedCashPercent / 100) > 0.01)) errors.push("V2 summary cash representation is inconsistent with mandate capital.");
  if (!array(record.selectedPositions)) errors.push("selectedPositions must be bounded.");
  else {
    let total = 0;
    const symbols = [];
    record.selectedPositions.forEach((position) => {
      if (!position || normalizeSymbol(position.symbol) !== position.symbol || !finite(position.amount) || position.amount < 0 || !percent(position.percent)) errors.push("Selected position is invalid.");
      else { total += position.amount; symbols.push(position.symbol); }
    });
    if (new Set(symbols).size !== symbols.length) errors.push("Selected positions must be unique.");
    if (mandate && total + record.retainedCashAmount > mandate.availableCapital + 1e-9) errors.push("Allocation plus retained cash exceeds mandate capital.");
  }
  if (record.decisionType === "no_trade" && ((record.selectedPositions || []).length || !text(record.noTradeReason))) errors.push("No-trade summary requires zero positions and a reason.");
  validateConfidence(record, errors);
  if (!percent(record.uncertainty)) errors.push("V2 summary uncertainty is invalid.");
  for (const field of ["strongestSupportingEvidenceIds","strongestOpposingEvidenceIds"]) if (!uniqueIds(record[field])) errors.push(`${field} must contain unique evidence IDs.`);
  return result(errors, base.normalized);
}

const VALIDATORS = Object.freeze({
  investmentMandate: validateInvestmentMandate,
  operatingStageRecord: validateOperatingStageRecord,
  investmentOperatingSession: validateInvestmentOperatingSession,
  operatingSystemDecisionSummary: validateOperatingSystemDecisionSummary,
  evidenceSummary: validateEvidenceSummary,
  thesis: validateThesis,
  committeeOpinion: validateCommitteeOpinion,
  committeeDecision: validateCommitteeDecision,
  candidateComparison: validateCandidateComparison,
  opportunityCost: validateOpportunityCost,
  portfolioDecision: validatePortfolioDecision,
  challenger: validateChallenger,
  outcome: validateOutcome,
  replay: validateReplay,
  mistakeMemory: validateMistakeMemory,
  learningProposal: validateLearningProposal,
});

function validateAutonomousDecisionFixture(fixture) {
  const errors = [];
  const parameterResult = validateDecisionParameters(fixture.parameters);
  if (!parameterResult.valid) errors.push(...parameterResult.errors.map((error) => `parameters: ${error}`));
  if (fixture.investmentMandate !== undefined) {
    const mandateValidation = validateInvestmentMandate(fixture.investmentMandate);
    if (!mandateValidation.valid) errors.push(...mandateValidation.errors.map((error) => `investmentMandate: ${error}`));
  }
  if (fixture.operatingSession !== undefined) {
    const sessionValidation = validateInvestmentOperatingSession(fixture.operatingSession, fixture.investmentMandate);
    if (!sessionValidation.valid) errors.push(...sessionValidation.errors.map((error) => `operatingSession: ${error}`));
  }
  if (fixture.operatingSystemDecisionSummary !== undefined) {
    const summaryValidation = validateOperatingSystemDecisionSummary(fixture.operatingSystemDecisionSummary);
    if (!summaryValidation.valid) errors.push(...summaryValidation.errors.map((error) => `operatingSystemDecisionSummary: ${error}`));
  }
  const singles = ["evidenceSummary", "thesis", "committeeDecision", "opportunityCost", "portfolioDecision", "challenger", "replay", "mistakeMemory", "learningProposal"];
  singles.forEach((type) => {
    const validation = type === "portfolioDecision"
      ? validatePortfolioDecision(fixture[type], fixture.parameters)
      : VALIDATORS[type](fixture[type]);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${type}: ${error}`));
  });
  (fixture.committeeOpinions || []).forEach((record, index) => {
    const validation = validateCommitteeOpinion(record);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `committeeOpinions[${index}]: ${error}`));
  });
  (fixture.candidateComparisons || []).forEach((record, index) => {
    const validation = validateCandidateComparison(record);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `candidateComparisons[${index}]: ${error}`));
  });
  (fixture.outcomes || []).forEach((record, index) => {
    const validation = validateOutcome(record);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `outcomes[${index}]: ${error}`));
  });
  const sessionId = fixture.operatingSession?.operatingSessionId;
  const mandateId = fixture.investmentMandate?.investmentMandateId;
  if (sessionId && mandateId) {
  const linkedSingles = ["evidenceSummary","thesis","committeeDecision","opportunityCost","portfolioDecision","challenger","replay"];
  linkedSingles.forEach((type) => {
    if (fixture[type]?.operatingSessionId !== sessionId) errors.push(`${type}: operatingSessionId does not resolve.`);
  });
  ["thesis","portfolioDecision","replay"].forEach((type) => {
    if (fixture[type]?.investmentMandateId !== mandateId) errors.push(`${type}: investmentMandateId does not resolve.`);
  });
  [...(fixture.committeeOpinions || []), ...(fixture.candidateComparisons || []), ...(fixture.outcomes || [])].forEach((record) => {
    if (record.operatingSessionId !== sessionId) errors.push("Array record operatingSessionId does not resolve.");
  });
  for (const type of ["mistakeMemory","learningProposal"]) if (!(fixture[type]?.operatingSessionIds || []).includes(sessionId)) errors.push(`${type}: operatingSessionIds do not resolve.`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(), normalized: clone(fixture) };
}

module.exports = {
  GENERATION_MODES,
  SCHEMA_KEYS,
  clone,
  normalizeDecisionParameters,
  validateAutonomousDecisionFixture,
  validateCandidateComparison,
  validateChallenger,
  validateCommitteeDecision,
  validateCommitteeOpinion,
  validateEvidenceSummary,
  validateLearningProposal,
  validateInvestmentMandate,
  validateInvestmentMandateV2,
  validateInvestmentOperatingSession,
  validateInvestmentOperatingSessionV2,
  validateMistakeMemory,
  validateOperatingStageRecord,
  validateOperatingStageRecordV2,
  validateOperatingSystemDecisionSummary,
  validateOperatingSystemDecisionSummaryV2,
  validateOpportunityCost,
  validateOutcome,
  validatePortfolioDecision,
  validateReplay,
  validateThesis,
  normalizeInvestmentOperatingSessionV2,
};
