# Public Trade Intel Discovery v3 — Phase 1

Architecture version: `v3-phase1-architecture-1`

Current default engine: `legacy`

Current readiness result with an empty or first-observation history: `INSUFFICIENT_OBSERVATIONS`

Current recommendation: `CONTINUE_SHADOW_VALIDATION`

Phase 1 adds an evidence-based discovery path beside the existing legacy discovery process. It does not replace the prediction engine. V3 can be requested only with the exact `v3-evidence-buckets` engine ID, remains fail-closed, and falls back completely to legacy if any readiness safeguard fails.

Documents:

- [Architecture](architecture.md)
- [Execution flows](execution-flow.md)
- [Promotion guide](promotion-guide.md)
- [Rollback guide](rollback-guide.md)
- [Operational runbook](runbook.md)
- [Engineering assumptions](engineering-assumptions.md)
- [Phase 2 roadmap](phase-2-roadmap.md)

Run the complete, read-only Phase 1 validation with:

```powershell
npm.cmd run validate:discovery:phase1
```

On non-Windows systems:

```sh
npm run validate:discovery:phase1
```

The validator does not write runtime data. It treats the exact known `smoke:data-provenance` mismatch as an acknowledged readiness blocker and fails if that signature changes.

Completed production scans contribute one validated, bounded readiness observation to
`DATA_DIR/discoveryReadinessHistory.json`. The rolling file retains at most 100 observations,
uses safe replacement, and is diagnostic only: it never changes the configured engine.
