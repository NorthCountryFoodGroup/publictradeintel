"""Production WSGI boundary for private Kronos shadow inference."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import os
import pathlib
import random
import sys
import threading
import time
from datetime import datetime, timedelta, timezone

SERVICE_VERSION = "2.0.0"
SERVICE_CONTRACT_VERSION = "KRONOS_SHADOW_SERVICE_V1"
FORECAST_CONTRACT_VERSION = "KRONOS_SHADOW_FORECAST_V1"
SOURCE_REVISION = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
MODEL_ID = "NeoQuasar/Kronos-mini"
MODEL_REVISION = "f4e68697d9d5aed55cef5c96aabc3376bcad9f81"
TOKENIZER_ID = "NeoQuasar/Kronos-Tokenizer-2k"
TOKENIZER_REVISION = "26966d0035065a0cae0ebad7af8ece35bc1fb51c"
MAX_BODY = 2 * 1024 * 1024
MAX_OBSERVATIONS = 512
MAX_SAMPLES = 16
MAX_FORECAST_BARS = 22
ALLOWED_REQUEST_KEYS = frozenset({"contractVersion", "serviceContractVersion", "ticker", "interval", "inputCutoff", "observations", "forecastObservationCount", "sampleCount"})
REQUEST_ID_PATTERN = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")

LOGGER = logging.getLogger("kronos_service")
if not LOGGER.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    LOGGER.addHandler(handler)
LOGGER.setLevel(logging.INFO)


def bounded_request_id(value):
    candidate = str(value or "").strip()
    if 8 <= len(candidate) <= 64 and all(char in REQUEST_ID_PATTERN for char in candidate):
        return candidate
    return hashlib.sha256(os.urandom(32)).hexdigest()[:24]


def safe_log(event, **fields):
    allowed = {"event": str(event)[:48]}
    for key in ("requestId", "state", "classification", "durationMs", "executionMode"):
        if key in fields and fields[key] is not None:
            allowed[key] = str(fields[key])[:80]
    LOGGER.info(json.dumps(allowed, separators=(",", ":")))


def next_trading_times(last_timestamp, count):
    current = datetime.fromisoformat(last_timestamp.replace("Z", "+00:00"))
    result = []
    while len(result) < count:
        current += timedelta(days=1)
        if current.weekday() < 5:
            result.append(current.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"))
    return result


def validate(payload):
    if not isinstance(payload, dict) or set(payload) - ALLOWED_REQUEST_KEYS:
        raise ValueError("invalid_request")
    if payload.get("serviceContractVersion") != SERVICE_CONTRACT_VERSION or payload.get("contractVersion") != FORECAST_CONTRACT_VERSION:
        raise RuntimeError("contract_mismatch")
    ticker = payload.get("ticker")
    if not isinstance(ticker, str) or not ticker or len(ticker) > 12 or not ticker[0].isalpha() or any(not (char.isalnum() or char in ".-") for char in ticker):
        raise ValueError("invalid_request")
    observations, count, samples = payload.get("observations"), payload.get("forecastObservationCount"), payload.get("sampleCount")
    if not isinstance(observations, list) or not 64 <= len(observations) <= MAX_OBSERVATIONS:
        raise ValueError("invalid_request")
    if not isinstance(count, int) or not 1 <= count <= MAX_FORECAST_BARS or not isinstance(samples, int) or not 1 <= samples <= MAX_SAMPLES:
        raise ValueError("invalid_request")
    previous = None
    for row in observations:
        if not isinstance(row, dict) or set(row) != {"timestamp", "open", "high", "low", "close", "volume"}:
            raise ValueError("invalid_request")
        try:
            stamp = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
        except (TypeError, ValueError):
            raise ValueError("invalid_request") from None
        values = [row[name] for name in ("open", "high", "low", "close", "volume")]
        if (previous and stamp <= previous) or not all(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) for value in values):
            raise ValueError("invalid_request")
        if min(values[:4]) <= 0 or values[4] < 0 or row["high"] < max(row["open"], row["close"]) or row["low"] > min(row["open"], row["close"]):
            raise ValueError("invalid_request")
        previous = stamp
    cutoff = payload.get("inputCutoff")
    if cutoff != observations[-1]["timestamp"]:
        raise ValueError("invalid_request")
    return observations, count, samples


def deterministic_forecast(observations, count, sample_count):
    times, paths = next_trading_times(observations[-1]["timestamp"], count), []
    for sample in range(sample_count):
        rng, prior, path = random.Random(f"{observations[-1]['timestamp']}:{observations[-1]['close']}:{sample}"), observations[-1], []
        for timestamp in times:
            drift = (rng.random() - .48) * .012
            close, open_value = prior["close"] * (1 + drift), prior["close"]
            row = {"timestamp": timestamp, "open": open_value, "high": max(open_value, close) * (1 + rng.random() * .004), "low": min(open_value, close) * (1 - rng.random() * .004), "close": close, "volume": max(0, prior["volume"] * (.9 + rng.random() * .2))}
            path.append(row); prior = row
        paths.append(path)
    return paths


class ServiceState:
    def __init__(self):
        self.lock = threading.Lock()
        self.inference = threading.BoundedSemaphore(1)
        self.state = "STARTING"
        self.model = self.tokenizer = self.predictor = None
        self.active_jobs = 0
        self.queue_depth = 0
        self.failure = None
        self.mode = os.getenv("KRONOS_ADAPTER_MODE", "real_model").strip().lower()
        if self.mode == "mock": self.mode = "deterministic_adapter"
        self.device = os.getenv("KRONOS_DEVICE", "cpu").strip().lower() or "cpu"

    def ready(self):
        return self.state == "READY"

    def initialize(self):
        with self.lock:
            self.state = "HEALTHY_NOT_READY"
        safe_log("model_load_started", state=self.state, executionMode=self.mode)
        try:
            configured_tokens = [value for value in (os.getenv("KRONOS_SERVICE_TOKEN", "").strip(), os.getenv("KRONOS_SERVICE_TOKEN_NEXT", "").strip()) if value]
            if not configured_tokens or any(len(value) < 24 for value in configured_tokens) or len(set(configured_tokens)) != len(configured_tokens):
                raise RuntimeError("invalid_service_authentication")
            if self.mode == "deterministic_adapter":
                fixture = [{"timestamp": "2026-01-02T21:00:00Z", "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1000}]
                if len(deterministic_forecast(fixture, 1, 1)) != 1: raise RuntimeError("warmup_failed")
            elif self.mode == "real_model":
                repository = os.getenv("KRONOS_REPOSITORY_PATH", str(pathlib.Path(__file__).resolve().parent / "upstream-kronos")).strip()
                if not pathlib.Path(repository).is_dir(): raise RuntimeError("source_unavailable")
                if repository not in sys.path: sys.path.insert(0, repository)
                from model import Kronos, KronosPredictor, KronosTokenizer
                from huggingface_hub import snapshot_download
                cache_dir = os.getenv("KRONOS_MODEL_CACHE_DIR", "").strip() or None
                tokenizer_path = snapshot_download(repo_id=TOKENIZER_ID, revision=TOKENIZER_REVISION, cache_dir=cache_dir)
                model_path = snapshot_download(repo_id=MODEL_ID, revision=MODEL_REVISION, cache_dir=cache_dir)
                self.tokenizer = KronosTokenizer.from_pretrained(tokenizer_path)
                self.model = Kronos.from_pretrained(model_path)
                self.predictor = KronosPredictor(self.model, self.tokenizer, max_context=2048)
                self._real_forecast(_warmup_observations(), 1, 1)
            else:
                raise RuntimeError("invalid_execution_mode")
            with self.lock: self.state, self.failure = "READY", None
            safe_log("readiness_transition", state=self.state, executionMode=self.mode)
        except Exception:
            with self.lock: self.state, self.failure = "FAILED_NOT_READY", "model_load_failed"
            safe_log("model_load_failed", state=self.state, classification=self.failure, executionMode=self.mode)

    def shutdown(self):
        with self.lock: self.state = "SHUTTING_DOWN"
        safe_log("readiness_transition", state=self.state)

    def _real_forecast(self, observations, count, sample_count):
        import pandas as pd
        times = next_trading_times(observations[-1]["timestamp"], count)
        frame = pd.DataFrame(observations).drop(columns=["timestamp"])
        x_times = pd.Series(pd.to_datetime([row["timestamp"] for row in observations])); y_times = pd.Series(pd.to_datetime(times))
        raw_paths, normalized_paths = [], []
        for _ in range(sample_count):
            result = self.predictor.predict(df=frame, x_timestamp=x_times, y_timestamp=y_times, pred_len=count, T=1.0, top_p=.9, sample_count=1, verbose=False)
            raw_path, normalized_path = [], []
            for index in range(count):
                raw = {name: float(result.iloc[index][name]) for name in ("open", "high", "low", "close", "volume")}
                normalized = dict(raw); normalized["high"] = max(raw.values()) if False else max(raw["open"], raw["high"], raw["low"], raw["close"]); normalized["low"] = min(raw["open"], raw["high"], raw["low"], raw["close"]); normalized["volume"] = max(0.0, raw["volume"])
                raw_path.append({**raw, "timestamp": times[index]}); normalized_path.append({**normalized, "timestamp": times[index]})
            raw_paths.append(raw_path); normalized_paths.append(normalized_path)
        return raw_paths, normalized_paths

    def forecast(self, observations, count, samples):
        if self.mode == "deterministic_adapter":
            paths = deterministic_forecast(observations, count, samples); return paths, paths
        return self._real_forecast(observations, count, samples)


def _warmup_observations():
    result, current = [], datetime(2025, 1, 2, 21, tzinfo=timezone.utc)
    while len(result) < 64:
        if current.weekday() < 5: result.append({"timestamp": current.isoformat().replace("+00:00", "Z"), "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1000})
        current += timedelta(days=1)
    return result


STATE = ServiceState()


def _tokens():
    return tuple(value for value in (os.getenv("KRONOS_SERVICE_TOKEN", "").strip(), os.getenv("KRONOS_SERVICE_TOKEN_NEXT", "").strip()) if value)


def authorized(environ):
    header = str(environ.get("HTTP_AUTHORIZATION", ""))
    if not header.startswith("Bearer ") or header.count(" ") != 1: return False
    supplied = header[7:]
    return any(hmac.compare_digest(supplied, expected) for expected in _tokens())


def json_response(start_response, status, body):
    encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
    start_response(status, [("Content-Type", "application/json"), ("Content-Length", str(len(encoded))), ("Cache-Control", "no-store")])
    return [encoded]


def base_response():
    return {"serviceVersion": SERVICE_VERSION, "serviceContractVersion": SERVICE_CONTRACT_VERSION}


def application(environ, start_response):
    path, method = environ.get("PATH_INFO", ""), environ.get("REQUEST_METHOD", "GET").upper()
    request_id = bounded_request_id(environ.get("HTTP_X_KRONOS_REQUEST_ID"))
    if path == "/healthz" and method == "GET":
        return json_response(start_response, "200 OK", {**base_response(), "status": "healthy"})
    if path not in ("/readyz", "/v1/forecast"):
        return json_response(start_response, "404 Not Found", {"error": "not_found"})
    if not authorized(environ):
        safe_log("request_rejected", requestId=request_id, classification="unauthorized")
        return json_response(start_response, "401 Unauthorized", {"error": "unauthorized"})
    if path == "/readyz" and method == "GET":
        body = {**base_response(), "readyForInference": STATE.ready(), "modelLoaded": STATE.ready(), "modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "tokenizerId": TOKENIZER_ID, "tokenizerRevision": TOKENIZER_REVISION, "sourceRevision": SOURCE_REVISION, "device": STATE.device, "queueDepth": STATE.queue_depth, "activeJobs": STATE.active_jobs, "executionMode": STATE.mode, "state": STATE.state}
        return json_response(start_response, "200 OK", body)
    if path != "/v1/forecast" or method != "POST":
        return json_response(start_response, "405 Method Not Allowed", {"error": "invalid_request"})
    if not STATE.ready(): return json_response(start_response, "503 Service Unavailable", {**base_response(), "error": "not_ready"})
    try: length = int(environ.get("CONTENT_LENGTH") or "0")
    except ValueError: length = -1
    if length <= 0 or length > MAX_BODY: return json_response(start_response, "413 Payload Too Large", {"error": "invalid_request"})
    if not STATE.inference.acquire(blocking=False): return json_response(start_response, "429 Too Many Requests", {"error": "capacity_unavailable"})
    started = time.monotonic()
    try:
        STATE.active_jobs = 1
        try: payload = json.loads(environ["wsgi.input"].read(length))
        except Exception: return json_response(start_response, "400 Bad Request", {"error": "invalid_request"})
        observations, count, samples = validate(payload)
        safe_log("inference_started", requestId=request_id, executionMode=STATE.mode)
        raw_paths, paths = STATE.forecast(observations, count, samples)
        body = {**base_response(), "executionMode": STATE.mode, "outputNormalization": "deterministic_ohlcv_envelope_v1" if STATE.mode == "real_model" else "none", "modelName": MODEL_ID if STATE.mode == "real_model" else "Kronos deterministic contract adapter", "modelVersion": MODEL_REVISION if STATE.mode == "real_model" else "mock-v1", "tokenizerVersion": TOKENIZER_REVISION if STATE.mode == "real_model" else "mock-v1", "checkpoint": MODEL_ID if STATE.mode == "real_model" else "none", "sourceRevision": SOURCE_REVISION, "rawSamples": raw_paths, "samples": paths}
        safe_log("inference_completed", requestId=request_id, durationMs=round((time.monotonic() - started) * 1000), executionMode=STATE.mode)
        return json_response(start_response, "200 OK", body)
    except RuntimeError as error:
        classification = "contract_mismatch" if str(error) == "contract_mismatch" else "inference_failed"
        return json_response(start_response, "409 Conflict" if classification == "contract_mismatch" else "503 Service Unavailable", {**base_response(), "error": classification})
    except ValueError:
        return json_response(start_response, "400 Bad Request", {**base_response(), "error": "invalid_request"})
    except Exception:
        safe_log("inference_failed", requestId=request_id, classification="inference_failed")
        return json_response(start_response, "503 Service Unavailable", {**base_response(), "error": "inference_failed"})
    finally:
        STATE.active_jobs = 0; STATE.inference.release()


def initialize_service():
    STATE.initialize()


def shutdown_service(*_args):
    STATE.shutdown()


if os.getenv("KRONOS_DISABLE_STARTUP_INITIALIZATION", "false").lower() != "true":
    threading.Thread(target=initialize_service, name="kronos-initialize", daemon=True).start()

app = application
