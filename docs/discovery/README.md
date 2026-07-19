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

The validator does not write runtime data. Symbol-universe provenance is resolved from the
completed scan's actual source metadata and fails closed to `Unknown` when that metadata is
insufficient.

Completed production scans contribute one validated, bounded readiness observation to
`DATA_DIR/discoveryReadinessHistory.json`. The rolling file retains at most 100 observations,
uses safe replacement, and is diagnostic only: it never changes the configured engine.

Local development defaults `DATA_DIR` to `<repository>/data`. Production may override that
root with the `DATA_DIR` environment variable; surrounding whitespace is ignored, blank values
use the local default, and relative values resolve deterministically from the process working
directory. Production deployments should use an absolute path. Render production uses
`/var/data`, and only runtime files beneath that mounted path persist across deployments and
application restarts.
