"use strict";

const assert = require("node:assert/strict");
const fixture = require("./fixtures/autonomous-decision-schema.json");
const {
  validateAutonomousDecisionFixture,
  validateChallenger,
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
  validateOutcome,
  validatePortfolioDecision,
  validateReplay,
  validateThesis,
} = require("../decision/schema");
const {
  INVESTMENT_OBJECTIVES_V2,
  MANDATE_STATUSES_V2,
  SELL_ANALYSIS_AUTHORITIES,
  OPERATING_SESSION_STATUSES_V2,
  OPERATING_STAGES_V2,
  OPERATING_STAGE_STATES_V2,
  OPERATING_DECISION_TYPES,
} = require("../decision/constants");
const { normalizeDecisionParameters, validateDecisionParameters } = require("../decision/parameters");

const copy = (value) => JSON.parse(JSON.stringify(value));
const invalid = (validation, message) => assert.equal(validation.valid, false, message);

assert.equal(validateAutonomousDecisionFixture(fixture).valid, true, "valid comprehensive fixture should pass");

const unknownVersion = copy(fixture.thesis);
unknownVersion.schemaVersion = "future-version";
invalid(validateThesis(unknownVersion), "unknown schema versions fail");

const missingId = copy(fixture.thesis);
delete missingId.thesisId;
invalid(validateThesis(missingId), "missing required IDs fail");

const invalidTimestamp = copy(fixture.evidenceSummary);
invalidTimestamp.decisionTimestamp = "not-a-time";
invalid(validateEvidenceSummary(invalidTimestamp), "invalid timestamps fail");

const futureEvidence = copy(fixture.evidenceSummary);
futureEvidence.supportingEvidence[0].availableAt = "2026-01-06T00:00:00.000Z";
invalid(validateEvidenceSummary(futureEvidence), "future evidence fails");

const invalidEnum = copy(fixture.committeeOpinions[0]);
invalidEnum.role = "ORACLE";
invalid(require("../decision/schema").validateCommitteeOpinion(invalidEnum), "invalid enum values fail");

for (const value of [NaN, Infinity, -Infinity]) {
  const parameters = copy(fixture.parameters);
  parameters.availableCapital = value;
  invalid(validateDecisionParameters(parameters), "non-finite values fail");
}
const negativeCapital = copy(fixture.parameters);
negativeCapital.availableCapital = -1;
invalid(validateDecisionParameters(negativeCapital), "negative capital fails");

const excessiveReserve = copy(fixture.parameters);
excessiveReserve.desiredCashReserve = 1001;
invalid(validateDecisionParameters(excessiveReserve), "cash reserve above capital fails");

const overAllocated = copy(fixture.portfolioDecision);
overAllocated.retainedCash = 500;
invalid(validatePortfolioDecision(overAllocated, fixture.parameters), "allocations above capital fail");

const duplicate = copy(fixture.portfolioDecision);
duplicate.positions[1].symbol = duplicate.positions[0].symbol;
invalid(validatePortfolioDecision(duplicate, fixture.parameters), "duplicate symbols fail");

const noTrade = copy(fixture.portfolioDecision);
noTrade.status = "NO_TRADE";
noTrade.positions = [];
noTrade.retainedCash = 1000;
noTrade.retainedCashPercent = 100;
assert.equal(validatePortfolioDecision(noTrade, fixture.parameters).valid, true, "no-trade with zero positions passes");

const allCash = copy(noTrade);
allCash.status = "RETAIN_CASH";
assert.equal(validatePortfolioDecision(allCash, fixture.parameters).valid, true, "100% cash passes");

const onePosition = copy(fixture.portfolioDecision);
onePosition.positions = onePosition.positions.slice(0, 1);
onePosition.retainedCash = 700;
onePosition.retainedCashPercent = 70;
assert.equal(validatePortfolioDecision(onePosition, fixture.parameters).valid, true, "fewer than maximum positions passes");

const productionApproved = copy(fixture.thesis);
productionApproved.productionApproved = true;
invalid(validateThesis(productionApproved), "production approval fails");
const notShadow = copy(fixture.thesis);
notShadow.shadowOnly = false;
invalid(validateThesis(notShadow), "non-shadow thesis fails");

const activation = copy(fixture.learningProposal);
activation.automaticActivationAllowed = true;
invalid(validateLearningProposal(activation), "automatic activation fails");

const increasedAllocation = copy(fixture.challenger);
increasedAllocation.afterState.allocation = 351;
invalid(validateChallenger(increasedAllocation), "challenger allocation increase fails");
const increasedConfidence = copy(fixture.challenger);
increasedConfidence.afterState.confidence = 61;
invalid(validateChallenger(increasedConfidence), "challenger confidence increase fails");

const missingReliability = copy(fixture.thesis);
delete missingReliability.confidenceReliability;
invalid(validateThesis(missingReliability), "missing confidence reliability fails");
const invalidConviction = copy(fixture.thesis);
invalidConviction.conviction = 101;
invalid(validateThesis(invalidConviction), "conviction bounds fail");

const unsupportedNumericFacts = copy(fixture.thesis);
unsupportedNumericFacts.supportingEvidenceIds = [];
invalid(validateThesis(unsupportedNumericFacts), "unsupported numeric facts fail");

const forcedOutcome = copy(fixture.outcomes[0]);
forcedOutcome.rawReturn = 4;
invalid(validateOutcome(forcedOutcome), "unresolved forced outcomes fail");

const mutatedReplayId = copy(fixture.replay);
mutatedReplayId.originalPortfolioDecision.decisionRunId = "different-run";
invalid(validateReplay(mutatedReplayId), "replay cannot mutate original decision ID");
const hindsightOriginal = copy(fixture.replay);
hindsightOriginal.originalEvidenceSummary.decisionTimestamp = "2026-02-01T00:00:00.000Z";
invalid(validateReplay(hindsightOriginal), "hindsight cannot enter original evidence");

const anecdoteLearning = copy(fixture.mistakeMemory);
anecdoteLearning.status = "LEARNING_ELIGIBLE";
anecdoteLearning.independentObservationCount = 1;
invalid(validateMistakeMemory(anecdoteLearning), "single observation is not learning eligible");

const oversizedAdjustment = copy(fixture.learningProposal);
oversizedAdjustment.boundedAdjustments.momentumWeight = 0.06;
invalid(validateLearningProposal(oversizedAdjustment), "oversized learning adjustment fails");
const overlap = copy(fixture.learningProposal);
overlap.evaluationWindow.start = overlap.trainingWindow.end;
invalid(validateLearningProposal(overlap), "overlapping windows fail");
const missingRollback = copy(fixture.learningProposal);
missingRollback.rollbackTarget = "";
invalid(validateLearningProposal(missingRollback), "missing rollback target fails");

for (const prohibited of ["hiddenReasoning", "prompt", "environmentValue", "ADMIN_PIN", "absolutePath", "rawPayload"]) {
  const record = copy(fixture.thesis);
  record[prohibited] = "prohibited";
  invalid(validateThesis(record), `${prohibited} must fail`);
}
const unknown = copy(fixture.parameters);
unknown.surpriseProperty = "quarantine";
const unknownValidation = validateDecisionParameters(unknown);
invalid(unknownValidation, "unknown fields fail");
assert.deepEqual(unknownValidation.quarantinedUnknownProperties, ["surpriseProperty"]);

const normalizationInput = copy(fixture.parameters);
normalizationInput.excludedSymbols = ["bbbq", "AAAQ", "bbbq"];
normalizationInput.excludedSectors = ["Utilities", "utilities"];
const originalNormalizationInput = copy(normalizationInput);
const normalizedA = normalizeDecisionParameters(normalizationInput);
const normalizedB = normalizeDecisionParameters(normalizationInput);
assert.deepEqual(normalizedA, normalizedB, "normalization is deterministic");
assert.deepEqual(normalizationInput, originalNormalizationInput, "normalization does not mutate inputs");
assert.deepEqual(normalizedA.excludedSymbols, ["AAAQ", "BBBQ"]);
assert.deepEqual(normalizedA.excludedSectors, ["utilities"]);

const silentlyCorrectedSymbol = copy(fixture.parameters);
silentlyCorrectedSymbol.excludedSymbols = ["BAD1"];
invalid(validateDecisionParameters(silentlyCorrectedSymbol), "invalid ticker text must not be silently corrected");
const nestedCredential = copy(fixture.parameters);
nestedCredential.customConstraints = [{ providerPayload: "prohibited" }];
invalid(validateDecisionParameters(nestedCredential), "nested sensitive fields must fail");
const wrongArrayType = copy(fixture.parameters);
wrongArrayType.excludedSymbols = "AAAQ";
invalid(validateDecisionParameters(wrongArrayType), "invalid collection types must not normalize to empty arrays");

const roundTrip = JSON.parse(JSON.stringify(validateAutonomousDecisionFixture(fixture).normalized));
assert.equal(validateAutonomousDecisionFixture(roundTrip).valid, true, "serialization and revalidation preserve meaning");
assert.equal(roundTrip.outcomes[0].exitPrice, null, "valid unavailable values remain null");

// Investment Operating System amendment contracts.
assert.equal(validateInvestmentMandate(fixture.investmentMandate).valid, true, "valid mandate passes");
const customWithoutText = copy(fixture.investmentMandate);
customWithoutText.investmentObjective = "CUSTOM";
customWithoutText.customInvestmentObjective = "";
invalid(validateInvestmentMandate(customWithoutText), "CUSTOM objective requires text");
const symbolConflict = copy(fixture.investmentMandate);
symbolConflict.requiredSymbols = ["ZZZX"];
invalid(validateInvestmentMandate(symbolConflict), "required and excluded symbols cannot overlap");
const mandateReserve = copy(fixture.investmentMandate);
mandateReserve.desiredCashReserveAmount = 1001;
invalid(validateInvestmentMandate(mandateReserve), "mandate reserve cannot exceed capital");
const mandateLoss = copy(fixture.investmentMandate);
mandateLoss.maximumAcceptableLossAmount = 1001;
invalid(validateInvestmentMandate(mandateLoss), "maximum loss cannot exceed capital");
const negativeCash = copy(fixture.investmentMandate);
negativeCash.existingCashPosition = -1;
invalid(validateInvestmentMandate(negativeCash), "existing cash cannot be negative");
const badSellAuthority = copy(fixture.investmentMandate);
badSellAuthority.sellAuthorityMode = "PLACE_TRADES";
invalid(validateInvestmentMandate(badSellAuthority), "invalid sell authority fails");
for (const field of ["brokerageField", "orderRouting", "executionField"]) {
  const unsafe = copy(fixture.investmentMandate);
  unsafe.userConstraints = [{ [field]: "prohibited" }];
  invalid(validateInvestmentMandate(unsafe), `${field} fails recursively`);
}

const completedStage = fixture.operatingSession.stageRecords.find((stage) => stage.state === "COMPLETED");
assert.equal(validateOperatingStageRecord(completedStage).valid, true, "valid stage record passes");
const notStartedTimestamp = copy(fixture.operatingSession.stageRecords.find((stage) => stage.state === "NOT_STARTED"));
notStartedTimestamp.startedAt = "2026-01-05T13:10:00.000Z";
invalid(validateOperatingStageRecord(notStartedTimestamp), "NOT_STARTED with timestamp fails");
const runningWithoutStart = copy(completedStage);
runningWithoutStart.state = "RUNNING";
runningWithoutStart.startedAt = null;
runningWithoutStart.completedAt = null;
invalid(validateOperatingStageRecord(runningWithoutStart), "RUNNING without startedAt fails");
const completedWithoutTimes = copy(completedStage);
completedWithoutTimes.startedAt = null;
completedWithoutTimes.completedAt = null;
invalid(validateOperatingStageRecord(completedWithoutTimes), "COMPLETED without timestamps fails");
const failedWithoutCode = copy(completedStage);
failedWithoutCode.state = "FAILED";
failedWithoutCode.errorCodes = [];
invalid(validateOperatingStageRecord(failedWithoutCode), "FAILED without error code fails");
const deferredWithoutReason = copy(completedStage);
deferredWithoutReason.state = "DEFERRED";
deferredWithoutReason.deferredReasonCodes = [];
invalid(validateOperatingStageRecord(deferredWithoutReason), "DEFERRED without reason fails");
const reversedStageTime = copy(completedStage);
reversedStageTime.completedAt = "2026-01-05T13:04:00.000Z";
invalid(validateOperatingStageRecord(reversedStageTime), "completedAt before startedAt fails");
const futureStageOutput = copy(completedStage);
futureStageOutput.outputReferenceIds = [{ referenceId: "future-output-001", createdAt: "2026-01-05T13:07:00.000Z" }];
invalid(validateOperatingStageRecord(futureStageOutput), "output created after stage completion fails");

assert.equal(validateInvestmentOperatingSession(fixture.operatingSession, fixture.investmentMandate).valid, true, "valid operating session passes");
const noMandate = copy(fixture.operatingSession);
delete noMandate.investmentMandateId;
invalid(validateInvestmentOperatingSession(noMandate, fixture.investmentMandate), "session requires mandate reference");
const draftMandate = copy(fixture.investmentMandate);
draftMandate.mandateStatus = "DRAFT";
const runningDraftSession = copy(fixture.operatingSession);
runningDraftSession.status = "RUNNING";
invalid(validateInvestmentOperatingSession(runningDraftSession, draftMandate), "DRAFT mandate cannot run");
const allCashSession = copy(fixture.operatingSession);
allCashSession.capitalAllocated = 0;
allCashSession.retainedCash = 1000;
allCashSession.candidateUniverseSummary.selectedPositionCount = 0;
assert.equal(validateInvestmentOperatingSession(allCashSession, fixture.investmentMandate).valid, true, "100% cash and zero positions pass");
assert.ok(allCashSession.candidateUniverseSummary.selectedPositionCount < fixture.investmentMandate.maximumPositions, "fewer positions than requested pass");
const overCapitalSession = copy(fixture.operatingSession);
overCapitalSession.capitalAllocated = 700;
overCapitalSession.retainedCash = 400;
invalid(validateInvestmentOperatingSession(overCapitalSession, fixture.investmentMandate), "session cannot exceed capital");
for (const [state, list] of [["FAILED", "completedStages"], ["DEFERRED", "completedStages"]]) {
  const mismatch = copy(fixture.operatingSession);
  const stage = mismatch.stageRecords.find((item) => item.state === state) || mismatch.stageRecords[2];
  stage.state = state;
  if (state === "FAILED") stage.errorCodes = ["FICTIONAL-ERROR"];
  if (state === "DEFERRED") stage.deferredReasonCodes = ["FICTIONAL-DEFER"];
  mismatch[list].push(stage.stage);
  invalid(validateInvestmentOperatingSession(mismatch, fixture.investmentMandate), `${state} stage cannot be completed`);
}
for (const field of ["completedStages", "failedStages", "deferredStages"]) {
  const mismatch = copy(fixture.operatingSession);
  mismatch[field] = [];
  if (field === "failedStages") mismatch[field] = ["MANDATE_VALIDATION"];
  invalid(validateInvestmentOperatingSession(mismatch, fixture.investmentMandate), `${field} mismatch fails`);
}
const incompleteCompleted = copy(fixture.operatingSession);
incompleteCompleted.status = "COMPLETED";
incompleteCompleted.completedAt = "2026-01-05T14:00:00.000Z";
invalid(validateInvestmentOperatingSession(incompleteCompleted, fixture.investmentMandate), "incomplete session cannot be completed");
const noCompletedDecision = copy(incompleteCompleted);
noCompletedDecision.stageRecords.forEach((stage, index) => {
  stage.state = "COMPLETED";
  stage.startedAt = `2026-01-05T13:${String(index).padStart(2, "0")}:00.000Z`;
  stage.completedAt = `2026-01-05T13:${String(index).padStart(2, "0")}:30.000Z`;
  stage.deferredReasonCodes = [];
});
noCompletedDecision.completedStages = noCompletedDecision.stageRecords.map((stage) => stage.stage);
noCompletedDecision.deferredStages = [];
noCompletedDecision.portfolioDecisionId = null;
noCompletedDecision.finalActionSummary = { action: "DEFER", reason: "Not a no-trade result." };
invalid(validateInvestmentOperatingSession(noCompletedDecision, fixture.investmentMandate), "completed session requires decision or no-trade result");

assert.equal(validateOperatingSystemDecisionSummary(fixture.operatingSystemDecisionSummary).valid, true, "valid operating-system summary passes");
for (const claim of [
  "The trade was executed.",
  "This is a real portfolio.",
  "The unresolved outcome was profitable.",
  "The learning proposal was activated.",
  "This strategy is production-approved.",
]) {
  const unsafe = copy(fixture.operatingSystemDecisionSummary);
  unsafe.mandateSummary = claim;
  invalid(validateOperatingSystemDecisionSummary(unsafe), `summary claim fails: ${claim}`);
}
for (const [field, value] of [["experimental", false], ["shadowOnly", false], ["productionApproved", true], ["reviewRequired", false]]) {
  const unsafe = copy(fixture.investmentMandate);
  if (field === "experimental") delete unsafe.experimental;
  else unsafe[field] = value;
  invalid(validateInvestmentMandate(unsafe), `${field} shadow safeguard fails`);
}
const missingLink = copy(fixture.thesis);
delete missingLink.operatingSessionId;
assert.equal(validateThesis(missingLink).valid, true, "additive operatingSessionId remains optional for older records");
const malformedLink = copy(fixture.parameters);
malformedLink.investmentMandateId = "../bad";
invalid(validateDecisionParameters(malformedLink), "malformed linkage ID fails");
const duplicateSessions = copy(fixture.learningProposal);
duplicateSessions.operatingSessionIds.push(duplicateSessions.operatingSessionIds[0]);
invalid(validateLearningProposal(duplicateSessions), "duplicate operatingSessionIds fail");
assert.equal(validateAutonomousDecisionFixture(fixture).valid, true, "fixture cross-record references resolve");
const laterContext = copy(fixture.replay);
laterContext.originalEvidenceSummary.decisionTimestamp = "2026-03-01T00:00:00.000Z";
invalid(validateReplay(laterContext), "later information cannot enter earlier decision context");
for (const field of ["hiddenReasoning", "prompt", "credential", "absolutePath", "rawPayload", "brokerageField", "routingField", "orderField", "executionField"]) {
  const unsafe = copy(fixture.investmentMandate);
  unsafe.userPriorities = [{ [field]: "prohibited" }];
  invalid(validateInvestmentMandate(unsafe), `${field} fails recursively`);
}
const mandateBefore = copy(fixture.investmentMandate);
const mandateA = validateInvestmentMandate(fixture.investmentMandate);
const mandateB = validateInvestmentMandate(fixture.investmentMandate);
assert.deepEqual(mandateA, mandateB, "mandate validation is deterministic");
assert.deepEqual(fixture.investmentMandate, mandateBefore, "mandate validation does not mutate input");
const amendmentRoundTrip = JSON.parse(JSON.stringify(validateAutonomousDecisionFixture(fixture).normalized));
assert.equal(validateAutonomousDecisionFixture(amendmentRoundTrip).valid, true, "amendment serialization preserves meaning");

// Lowercase additive operating-contract vocabulary.
let v2AssertionCount = 0;
for (const [values, expected] of [
  [INVESTMENT_OBJECTIVES_V2, ["capital_preservation","income","balanced_growth","growth","aggressive_growth","tactical_opportunity","custom"]],
  [MANDATE_STATUSES_V2, ["draft","active","suspended","archived"]],
  [SELL_ANALYSIS_AUTHORITIES, ["disabled","existing_positions_only","enabled"]],
  [OPERATING_SESSION_STATUSES_V2, ["draft","queued","running","completed","completed_no_trade","blocked","failed","cancelled","archived"]],
  [OPERATING_STAGES_V2, ["mandate_validation","session_initialization","market_context","universe_discovery","evidence_collection","evidence_normalization","candidate_assessment","committee_review","candidate_comparison","capital_allocation","challenger_review","final_decision","decision_journal","outcome_tracking","replay","learning_review"]],
  [OPERATING_STAGE_STATES_V2, ["pending","running","completed","skipped","blocked","failed","cancelled"]],
  [OPERATING_DECISION_TYPES, ["allocate","rebalance","hold_existing","retain_cash","no_trade"]],
]) {
  expected.forEach((value) => {
    assert.ok(values.includes(value), `new enum includes ${value}`);
    v2AssertionCount += 1;
  });
}
assert.equal(validateInvestmentMandateV2(fixture.investmentMandateV2).valid, true, "valid V2 mandate passes"); v2AssertionCount += 1;
const v2BadCapital = copy(fixture.investmentMandateV2);
v2BadCapital.availableCapital = 0;
invalid(validateInvestmentMandateV2(v2BadCapital), "V2 invalid capital fails"); v2AssertionCount += 1;
const v2BadReserve = copy(fixture.investmentMandateV2);
v2BadReserve.desiredCashReservePercent = 101;
invalid(validateInvestmentMandateV2(v2BadReserve), "V2 reserve percentage fails"); v2AssertionCount += 1;
const v2BadLimits = copy(fixture.investmentMandateV2);
v2BadLimits.minimumPositionPercent = 50;
v2BadLimits.maximumPositionPercent = 20;
invalid(validateInvestmentMandateV2(v2BadLimits), "V2 position limits fail"); v2AssertionCount += 1;
assert.equal(fixture.investmentMandateV2.existingHoldings.length, 1, "V2 holding fixture exists");
assert.equal(validateInvestmentMandateV2(fixture.investmentMandateV2).valid, true, "V2 existing holding validates"); v2AssertionCount += 2;
for (const symbol of ["bad1", "AAAQ"]) {
  const badSymbols = copy(fixture.investmentMandateV2);
  badSymbols.requiredSymbols = symbol === "AAAQ" ? ["AAAQ", "AAAQ"] : [symbol];
  invalid(validateInvestmentMandateV2(badSymbols), `V2 malformed or duplicate symbol fails: ${symbol}`);
  v2AssertionCount += 1;
}
assert.equal(validateOperatingStageRecordV2(fixture.operatingStageRecordV2).valid, true, "valid V2 stage passes"); v2AssertionCount += 1;
for (const mutation of [
  (record) => { record.state = "running"; record.startedAt = null; record.completedAt = null; },
  (record) => { record.state = "completed"; record.completedAt = null; },
  (record) => { record.state = "blocked"; record.blockedReason = null; },
  (record) => { record.state = "failed"; record.error = null; },
]) {
  const badStage = copy(fixture.operatingStageRecordV2);
  mutation(badStage);
  invalid(validateOperatingStageRecordV2(badStage), "invalid V2 stage transition fails");
  v2AssertionCount += 1;
}
assert.equal(validateInvestmentOperatingSessionV2(fixture.investmentOperatingSessionV2).valid, true, "valid V2 session passes"); v2AssertionCount += 1;
const defaultShadowSession = copy(fixture.investmentOperatingSessionV2);
delete defaultShadowSession.mode;
const defaultShadowValidation = validateInvestmentOperatingSessionV2(defaultShadowSession);
assert.equal(defaultShadowValidation.valid, true, "missing V2 mode defaults safely");
assert.equal(defaultShadowValidation.normalized.mode, "shadow", "V2 default mode is shadow"); v2AssertionCount += 2;
const invalidSessionReference = copy(fixture.investmentOperatingSessionV2);
invalidSessionReference.evidenceGraphId = "../bad";
invalid(validateInvestmentOperatingSessionV2(invalidSessionReference), "invalid V2 session reference fails"); v2AssertionCount += 1;
assert.equal(validateOperatingSystemDecisionSummaryV2(fixture.operatingSystemDecisionSummaryV2, fixture.investmentMandateV2).valid, true, "valid allocation summary passes"); v2AssertionCount += 1;
const noTradeSummary = copy(fixture.operatingSystemDecisionSummaryV2);
noTradeSummary.decisionType = "no_trade";
noTradeSummary.status = "shadow_no_trade";
noTradeSummary.selectedPositions = [];
noTradeSummary.retainedCashAmount = 1000;
noTradeSummary.retainedCashPercent = 100;
noTradeSummary.noTradeReason = "Insufficient synthetic evidence.";
assert.equal(validateOperatingSystemDecisionSummaryV2(noTradeSummary, fixture.investmentMandateV2).valid, true, "valid no-trade summary passes"); v2AssertionCount += 1;
const overAllocatedV2 = copy(fixture.operatingSystemDecisionSummaryV2);
overAllocatedV2.selectedPositions[0].amount = 700;
invalid(validateOperatingSystemDecisionSummaryV2(overAllocatedV2, fixture.investmentMandateV2), "V2 allocation plus cash cannot exceed capital"); v2AssertionCount += 1;
for (const field of ["investmentMandateId", "operatingSessionId"]) {
  const missing = copy(fixture.operatingSystemDecisionSummaryV2);
  delete missing[field];
  invalid(validateOperatingSystemDecisionSummaryV2(missing, fixture.investmentMandateV2), `V2 summary requires ${field}`);
  v2AssertionCount += 1;
}
const oldWithoutOperatingRecords = copy(fixture);
delete oldWithoutOperatingRecords.investmentMandate;
delete oldWithoutOperatingRecords.operatingSession;
delete oldWithoutOperatingRecords.operatingSystemDecisionSummary;
delete oldWithoutOperatingRecords.parameters.investmentMandateId;
for (const record of [oldWithoutOperatingRecords.evidenceSummary, oldWithoutOperatingRecords.thesis, oldWithoutOperatingRecords.committeeDecision, oldWithoutOperatingRecords.opportunityCost, oldWithoutOperatingRecords.portfolioDecision, oldWithoutOperatingRecords.challenger, oldWithoutOperatingRecords.replay]) {
  delete record.operatingSessionId;
  delete record.investmentMandateId;
}
oldWithoutOperatingRecords.committeeOpinions.forEach((record) => delete record.operatingSessionId);
oldWithoutOperatingRecords.candidateComparisons.forEach((record) => delete record.operatingSessionId);
oldWithoutOperatingRecords.outcomes.forEach((record) => delete record.operatingSessionId);
delete oldWithoutOperatingRecords.mistakeMemory.operatingSessionIds;
delete oldWithoutOperatingRecords.learningProposal.operatingSessionIds;
assert.equal(validateAutonomousDecisionFixture(oldWithoutOperatingRecords).valid, true, "older fixture remains valid without additive linkages"); v2AssertionCount += 1;
const additiveThesis = copy(fixture.thesis);
additiveThesis.evidenceGraphId = "evidence-graph-fictional-001";
additiveThesis.operatingSystemDecisionSummaryId = "summary-v2-fictional-001";
assert.equal(validateThesis(additiveThesis).valid, true, "optional additive evidence and summary links validate"); v2AssertionCount += 1;
assert.ok(v2AssertionCount >= 52, `V2 amendment executes at least 52 assertions; received ${v2AssertionCount}`);

console.log("Autonomous decision schema contract passed.");
