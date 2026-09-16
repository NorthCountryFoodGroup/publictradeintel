# Kronos shadow forecasting (Phase 1)

Kronos is optional research evidence and never affects PublicTradeIntel recommendations, ranks, scores, confidence, qualification, horizons, persistence compatibility, or engine selection. `KRONOS_SHADOW_ENABLED` defaults to `false`; there is no authoritative mode.

## Official source and license

- Official repository: <https://github.com/shiyu-coder/Kronos>
- Paper: <https://arxiv.org/abs/2508.02739>
- License: MIT for the repository and published `NeoQuasar` model cards.
- Development checkpoint: `NeoQuasar/Kronos-mini` (4.1M parameters, 2048 context) with `NeoQuasar/Kronos-Tokenizer-2k`.

The official project requires Python 3.10+, PyTorch 2+, pandas, NumPy, einops, huggingface_hub, and safetensors. Checkpoints download from Hugging Face at runtime and are never stored in this repository. CPU inference is supported by PyTorch but may be slow; CUDA is supported by the official predictor. Memory depends on device, sample count, context, and PyTorch overhead, so deployment sizing must be measured before any production-capable service is approved. Kronos was trained across over 12 billion K-lines from 45 exchanges; the reviewed public repository, model card, and paper do not disclose a single definitive training-data cutoff. They also do not establish calibrated investment probabilities or guaranteed US-equity performance. Commercial use should retain MIT notices and undergo legal/model-risk review.

## Local workflow

Terminal 1 (deterministic contract adapter, no model download):

```powershell
$env:KRONOS_ADAPTER_MODE='mock'
python kronos-service/app.py
```

Terminal 2:

```powershell
$env:KRONOS_SHADOW_ENABLED='true'
$env:KRONOS_SERVICE_URL='http://127.0.0.1:8091'
npm start
```

For the real model, clone the official repository outside this repository, install `kronos-service/requirements.txt`, set `KRONOS_REPOSITORY_PATH` to that clone, and use `KRONOS_ADAPTER_MODE=real`. Phase 1 accepts loopback HTTP service URLs only and binds the Python process to loopback by default. A later separately deployed private service requires a separately reviewed authenticated transport; this phase deliberately does not make one production-capable.

Daily unadjusted OHLCV from the existing Yahoo chart infrastructure is used consistently; adjusted close is not mixed with unadjusted OHLC. Split/dividend events are requested for provenance, but Phase 1 does not transform bars. Suspect corporate-action series are partial/unsupported rather than fabricated. Inputs are chronological, unique, finite, positive, capped at 512 daily observations, and cut off before inference. No missing bars are invented or forward-filled.

Supported mappings are 1-Day → 1 trading bar, 7-Day → 5 trading bars, and 1-Month → 22 trading bars. One-year forecasting is intentionally unsupported. The default is eight independently sampled paths, bounded to sixteen. Output probabilities are described only as sample-implied.
