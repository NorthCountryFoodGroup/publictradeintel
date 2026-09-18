# Kronos Stage 2A private-service runbook

Stage 2A productionizes the dormant Kronos inference boundary. It does not enable Kronos in PublicTradeIntel, schedule work, collect forecasts, or give model output production influence. `KRONOS_SHADOW_ENABLED` remains `false` during the entire Stage 2A deployment.

## Reproducible runtime

- Python: `3.12.8`
- Official source: `shiyu-coder/Kronos` at `67b630e67f6a18c9e9be918d9b4337c960db1e9a`
- Model: `NeoQuasar/Kronos-mini` at `f4e68697d9d5aed55cef5c96aabc3376bcad9f81`
- Tokenizer: `NeoQuasar/Kronos-Tokenizer-2k` at `26966d0035065a0cae0ebad7af8ece35bc1fb51c`
- Service contract: `KRONOS_SHADOW_SERVICE_V1`

Direct runtime dependencies are pinned in `kronos-service/requirements.txt`: NumPy 2.1.3, pandas 2.2.3, CPU PyTorch 2.5.1, einops 0.8.1, huggingface_hub 0.33.1, safetensors 0.6.2, and Gunicorn 23.0.0. Pip resolves their platform-appropriate transitive dependencies from the lock-like exact direct constraints and the official CPU PyTorch index; `pip freeze` from the approved Render build should be retained with deployment evidence. Platform-specific transitive packages are intentionally not copied from Windows into the Linux requirements file.

Future Render build command:

```sh
python -m pip install --requirement kronos-service/requirements.txt && python kronos-service/install-source.py
```

Model and tokenizer weights are acquired at runtime with their exact revisions because the runtime cache disk is unavailable during Render build. A missing pinned artifact leaves the process healthy but not ready; it never falls back to the deterministic adapter in `real_model` mode.

Future Render start command:

```sh
cd kronos-service && gunicorn --worker-class gthread --workers 1 --threads 4 --timeout 120 --graceful-timeout 30 --keep-alive 5 --bind 0.0.0.0:$PORT wsgi:app
```

`--preload` is deliberately absent. One worker means one resident model copy. Four HTTP threads keep health/readiness responsive, while the one-slot inference semaphore permits only one active PyTorch inference. The 120-second Gunicorn worker timeout is distinct from the Node inference budget, which remains 20 seconds by default and can be changed only by trusted server construction.

Real model initialization is deliberately absent from `wsgi:app` module import. Gunicorn's `post_worker_init` hook starts one guarded background initialization in the serving worker, so the same process owns the service state, model, tokenizer, inference semaphore, warm-up, and readiness transition. During loading, `/healthz` remains available while authenticated `/readyz` truthfully reports not ready. Repeated hook calls are idempotent and do not create another model copy or warm-up.

## Authentication and private routing

`/healthz` is intentionally unauthenticated and returns only service and contract versions plus process health. `/readyz` and `/v1/forecast` require `Authorization: Bearer <KRONOS_SERVICE_TOKEN>`. The optional `KRONOS_SERVICE_TOKEN_NEXT` permits overlap during a future rotation; remove the old token after both services have been redeployed. Comparisons use `hmac.compare_digest`. Tokens are never logged, returned, written to forecast records, or sent to browsers.

Node reads `KRONOS_SERVICE_URL` and the token only from its environment. Local development accepts loopback HTTP. Production accepts HTTP private DNS hostnames and rejects loopback, URL credentials, query strings, fragments, unsafe schemes, and request-level URL overrides. The browser cannot select either host or credential.

Future environment contract:

- Python: `KRONOS_SERVICE_TOKEN`, optional `KRONOS_SERVICE_TOKEN_NEXT`, `KRONOS_MODEL_CACHE_DIR`, optional `KRONOS_REPOSITORY_PATH` (defaults to the build-acquired `kronos-service/upstream-kronos`), `KRONOS_ADAPTER_MODE=real_model`, `KRONOS_DEVICE=cpu`.
- Node: `KRONOS_SERVICE_URL`, `KRONOS_SERVICE_TOKEN`.
- Provenance pins remain code-controlled: `KRONOS_SOURCE_REVISION`, `KRONOS_MODEL_REVISION`, and `KRONOS_TOKENIZER_REVISION` must match this document. They may be mirrored in deployment configuration for auditing but must not override the approved code pins.
- `KRONOS_SHADOW_ENABLED=false`.

No real secret belongs in Git. Local adapter tests provide isolated process-only credentials.

## Lifecycle and diagnostics

The service states are `STARTING`, `HEALTHY_NOT_READY`, `READY`, `SHUTTING_DOWN`, and `FAILED_NOT_READY`. Startup loads the exact tokenizer and model and executes one bounded 64-bar, one-step, one-sample warm-up. The warm-up is not persisted or reported as research. Only successful warm-up transitions to `READY`. Failed loading remains process-healthy for bounded diagnostics and is retried only by an operator restart, never a tight loop.

SIGTERM immediately changes readiness to `SHUTTING_DOWN`; Gunicorn supplies the bounded graceful period for the one active inference. The service owns no PublicTradeIntel persistence. Logs contain bounded event names, request IDs, execution mode, duration, state, and error classification only—never tokens, inputs, forecasts, paths, environment dumps, credentials, or stack traces.

## Future Render configuration

- Type: Private Service; no public URL.
- Region: same as the PublicTradeIntel Node service.
- Initial plan: 1 CPU / 2 GB RAM; measure before considering 2 CPU / 4 GB.
- Disk: 1 GB persistent model cache, exposed through `KRONOS_MODEL_CACHE_DIR`.
- Auto-Deploy: disabled during controlled rollout.
- Health check: unauthenticated `/healthz`.
- Operational readiness: authenticated `/readyz`.

Stage 2A deployment acceptance requires the exact approved commit, private-only networking, exact source/model/tokenizer revisions, successful load and warm-up, healthy process, authenticated readiness, rejected unauthorized calls, measured CPU/memory, and no restart/OOM loop. Production Node must not invoke inference; the feature flag remains false and no forecast is created.

If startup, loading, warm-up, memory, authentication, exposure, or restart behavior is unsafe, do not enable Node. Suspend or roll back only the new private service. PublicTradeIntel and Legacy stay on their healthy release. No Legacy rollback is required for failure of this dormant service.
