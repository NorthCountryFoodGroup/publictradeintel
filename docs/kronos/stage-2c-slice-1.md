# Stage 2C Slice 1: research contracts and no-influence guards

Implementation baseline: `03b0878680cce139b7ae14f5b51bf257ca34ca55`.
Design and implementation are limited to pure contracts and defensive guards. No
scheduler, selector, ledger, collector, automatic worker, or statistical evaluator
is implemented. No production action is part of this slice.

## Protocol

`KRONOS_AUTO_SHADOW_PROTOCOL_V1` is the immutable initial automatic experiment.
The exported protocol and all nested values are frozen. The contract test pins
its complete content. Material parameter changes require a new version, a new
validator/dispatch path, and retention of the old version for historical records;
do not modify V1 in place.

| Parameter | V1 value |
| --- | --- |
| Cohort target | 20 |
| Legacy high conviction | 4 |
| Legacy medium/watch | 4 |
| Legacy avoid/negative | 3 |
| Legacy neutral/nonrecommended | 5 |
| Benchmark ETFs | 2 |
| Rotating controls | 2 |
| Horizon / bars | 7-Day / 5 future daily trading bars |
| Sample paths | 8 |
| Target / minimum observations | 512 / 252 |
| Inference concurrency | 1 |
| Hard session limit | 1,200,000 ms (20 minutes) |
| Sector concentration cap | 25% (maximum 5 of 20) |
| Trigger | automatic_shadow |
| Production influence | literal false |

The sector cap applies to the entire selected cohort, including benchmarks and
controls, without an implicit exemption. Sector labels are compared ignoring
case. Future selection must resolve a canonical sector taxonomy, including ETF
and unknown classifications, before freezing a cohort. The validator checks an
already chosen cohort; it does not select, rank, replace, or fetch candidates.

## API and record versions

`kronos/research-contracts.js` exports `validateSession`, `validateCohort`,
`validateJob`, `validateOutcome`, `validateMembership`, and
`assertTransition(kind, from, to)`, plus frozen protocol/version/state constants.
Validators return detached, deeply frozen JSON-compatible data. Inputs remain
untouched. Unknown top-level fields, malformed references/hashes/timestamps,
unsafe influence values, unsupported versions, and inconsistent state fields
are rejected. Callers must retain the returned value, not the original input.

Every record includes `contractVersion`, `protocolVersion`, `id`, `createdAt`,
`triggerMode`, and `productionInfluence: false`. Timestamps are canonical UTC ISO
strings. IDs are bounded references; snapshot references include a SHA-256 string.
References are syntactically validated here. Resolving them, verifying stored
content hashes, enforcing durable idempotency/foreign keys, and reconciling counts
against actual stored jobs belong to later persistence/session slices.

| Record | Contract version | Additional contract data |
| --- | --- | --- |
| Session | KRONOS_COLLECTION_SESSION_V1 | Trading date, America/New_York timezone, cutoff, idempotency key, frozen cohort reference/hash, state/update timestamp, counts for all 20 jobs, terminal reason |
| Cohort | KRONOS_FROZEN_COHORT_V1 | Universe and Legacy snapshot references/hashes, selector version, seed, frozen timestamp, cap, selected/reserve/rejected lists |
| Job | KRONOS_COLLECTION_JOB_V1 | Session ID, cohort reference/hash, ticker, stratum/order, idempotency key, input provenance, state/update timestamp, forecast reference or reason |
| Outcome | KRONOS_OUTCOME_LIFECYCLE_V1 | Forecast reference, maturity timestamp, state/update timestamp, evidence references or exception reason |
| Membership | KRONOS_RESEARCH_MEMBERSHIP_V1 | Forecast/session/job references, primary prospective membership, partition and frozen partition-plan reference |

A cohort has exactly the specified stratum counts, unique tickers across its three
lists, contiguous deterministic order within each list, and bounded reasons for
reserves and rejections. Deep copying and freezing prevent shared-reference edits.
A job's execution states require input snapshot/cutoff and 252-512 observations.
Only a COMPLETED job may contain a forecast reference, which is mandatory then.

## State transitions

The frozen `TRANSITIONS` table is the canonical permitted transition set.
`assertTransition` rejects unknown states, self-transitions, and all unspecified
edges. It performs no transition, execution, cancellation, scheduling, or writes.
A future ledger must validate both records and the transition, preserve immutable
identity/protocol/cohort fields, and apply changes atomically with concurrency
control. Standalone validation is not a durable ledger.

Sessions:

- PLANNED -> QUEUED, FAILED, CANCELLED
- QUEUED -> RUNNING, FAILED, CANCELLED
- RUNNING -> COMPLETED, COMPLETED_WITH_FAILURES, FAILED, CANCELLED
- COMPLETED, COMPLETED_WITH_FAILURES, FAILED, CANCELLED are terminal.

COMPLETED requires 20 completed jobs. COMPLETED_WITH_FAILURES requires all jobs
terminal, at least one success, and at least one failed/skipped job. FAILED and
CANCELLED require bounded reasons. Their counts preserve the last observed job
state; cancellation does not invent runtime job cancellation in this slice.

Jobs:

- PLANNED -> QUEUED, SKIPPED, FAILED
- QUEUED -> RUNNING, SKIPPED, FAILED
- RUNNING -> COMPLETED, FAILED
- COMPLETED, SKIPPED, FAILED are terminal.

SKIPPED and FAILED require nonempty reasons of at most 240 characters. An already
running job cannot be relabeled as skipped.

Outcome lifecycle:

- PENDING -> MATURED or an explicit data/provider/symbol exception
- MATURED -> EVALUATED or an explicit exception, including EVALUATION_FAILED
- Recoverable data/provider/symbol-review exceptions -> PENDING or MATURED
- EVALUATION_FAILED -> MATURED; EVALUATED and DELISTED are terminal.

The complete state vocabulary is PENDING, MATURED, EVALUATED, INSUFFICIENT_DATA,
SYMBOL_CHANGED, DELISTED, CORPORATE_ACTION_REVIEW, PROVIDER_UNAVAILABLE,
EVALUATION_FAILED. Recoveries require future evidence review; there is no automatic
retry. MATURED/EVALUATED require elapsed maturity. EVALUATED additionally requires
an actual-bar snapshot/hash, completeness reference, evaluation reference, exactly
five expected/observed bars and literal `complete: true`. A timestamp alone never
establishes successful evaluation. Data retrieval, closing-bar settlement checks,
corporate-action decisions, and metric computation are deferred to Slice 4.

The existing `KRONOS_SHADOW_OUTCOME_V1` helper and its lowercase statuses are
unchanged. No old outcome or forecast is migrated or automatically reinterpreted.
Manual records may be explicitly represented by an excluded membership wrapper;
this does not relabel their original forecast protocol or stored data.

## Flags, provenance and execution

`loadFeatureFlags` parses KRONOS_SHADOW_ENABLED, KRONOS_AUTO_COLLECTION_ENABLED,
and KRONOS_OUTCOME_EVALUATION_ENABLED with the existing strictBoolean semantics:
trimmed, case-insensitive `true` is true; missing, blank, malformed and false values
are false. Existing boolean true behavior is retained. Returned flags are frozen.
No process or deployment environment is modified by these modules.

Only the existing manual endpoint is a caller of the research service. It assigns
manual provenance server-side, and the request allowlist still permits only ticker,
horizon and sampleCount. Clients cannot assign trigger, influence, session or job
metadata. `automatic_shadow` remains valid record provenance for future trusted
server code, but is not an executable mode in this slice.

`assertManualExecution` unconditionally rejects automatic_shadow with
`automatic_execution_unavailable`. The service applies the guard before history,
readiness, inference or persistence, irrespective of flag combinations. There is
no automatic worker or environment-controlled override. Other validated modes
must be manual. Record creation retains literal false influence and additionally
checks it before persistence. Contract validators reject true, strings, numbers,
null and missing influence rather than coercing them.

Stored research reads do not consult inference/evaluation flags or contact Python.
No existing forecast schema, manual limits, samples, analytics, persistence, or
read response is changed. A fixed AAPL fixture matches the baseline service output
exactly. Tests that use model output fixtures do not execute a Kronos model.

Manual membership requires primaryProspective=false, EXCLUDED_MANUAL, and no
session/job/partition-plan reference. Automatic membership requires explicit
prospective membership and DEVELOPMENT, VALIDATION or HOLDOUT with a plan reference.
Assignment is deferred: first 250 matured automatic forecasts for development,
next 250 for validation, then locked chronological holdout. Manual forecasts never
silently enter this population. No statistical aggregation or promotion exists.

## Infrastructure determination

DEPLOY-PUBLICTRADEINTEL.md describes creating/configuring a Web Service through the
Render dashboard. render.yaml does not describe the current Kronos private service
or its operational settings. Repository evidence does not establish that a Render
Blueprint currently controls production. No live Render inspection was performed.
Accordingly render.yaml is not treated as authoritative for this change and is
unchanged; all new defaults live in code/contracts/tests/documentation. No Render,
deployment, or operational environment changes are authorized or performed.

## Isolation and verification

The three new suites are `smoke:kronos-research-contracts`,
`smoke:kronos-research-guards`, and `smoke:kronos-research-boundary`.
They cover the protocol, every state-pair transition, cancellation, invalid records,
deep immutability, eight flag combinations, forbidden calls, manual baseline
compatibility, stored reads, and capability-denied module imports. The boundary
suite checks the entire protected production surfaces against the approved commit,
so it also protects scoring, qualification, confidence, categories, Best Ideas,
Stocks to Buy, Opportunities, market outlook, portfolios and order execution.

Protected buildPrediction SHA-256:
`72714872ed27c9c7d1ceac407a87e67d753afb9f6c7cec8f0051cc80631fb1bc`.

Existing discovery validation must remain 24/24, with its additional provenance
check. Relevant offline Kronos, Trade Brief, semantics and compatibility suites
must pass. The existing kronos-service and kronos-stage2a integration suites call
/v1/forecast and are intentionally excluded from this slice's authorized run.
No production state or model-service endpoint is required by the focused tests.

Slice 2 may be designed only after review/commit/merge. Automatic collection stays
off until durable persistence, session/cohort handling, outcomes, and scheduling
have received the required reviews. No promotion is authorized: future evaluation
must test preregistered incremental value and permit a conclusion of no value.
Sample-path frequencies remain uncalibrated frequencies, never success probabilities.
