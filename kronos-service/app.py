"""Local-only WSGI runner retained for deterministic development smoke tests."""
if __name__ == "__main__":
    import os as _os
    from wsgiref.simple_server import make_server as _make_server
    from wsgi import app as _wsgi_app
    with _make_server("127.0.0.1", int(_os.getenv("KRONOS_PORT", "8091")), _wsgi_app) as _server:
        _server.serve_forever()
    raise SystemExit(0)

"""Legacy implementation retained below for source-history comparison; never executed."""
import json, math, os, random, sys, threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 2 * 1024 * 1024
MAX_OBSERVATIONS = 512
MAX_SAMPLES = 16
MAX_FORECAST_BARS = 22
MODEL_ID = os.getenv("KRONOS_MODEL_ID", "NeoQuasar/Kronos-mini")
TOKENIZER_ID = os.getenv("KRONOS_TOKENIZER_ID", "NeoQuasar/Kronos-Tokenizer-2k")
MODEL_PATH = os.getenv("KRONOS_MODEL_PATH", MODEL_ID)
TOKENIZER_PATH = os.getenv("KRONOS_TOKENIZER_PATH", TOKENIZER_ID)
MODE = os.getenv("KRONOS_ADAPTER_MODE", "real").strip().lower()
DEVICE = os.getenv("KRONOS_DEVICE", "cpu")
MODEL = None
TOKENIZER = None
PREDICTOR = None
MODEL_LOCK = threading.Lock()
INFERENCE_LOCK = threading.BoundedSemaphore(1)

def next_trading_times(last_timestamp, count):
    current = datetime.fromisoformat(last_timestamp.replace("Z", "+00:00"))
    result = []
    while len(result) < count:
        current += timedelta(days=1)
        if current.weekday() < 5:
            result.append(current.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"))
    return result

def validate(payload):
    allowed = {"contractVersion", "ticker", "interval", "inputCutoff", "observations", "forecastObservationCount", "sampleCount"}
    if not isinstance(payload, dict) or set(payload) - allowed:
        raise ValueError("invalid_request")
    observations = payload.get("observations")
    count = payload.get("forecastObservationCount")
    samples = payload.get("sampleCount")
    if not isinstance(observations, list) or not 64 <= len(observations) <= MAX_OBSERVATIONS:
        raise ValueError("invalid_observation_count")
    if not isinstance(count, int) or not 1 <= count <= MAX_FORECAST_BARS:
        raise ValueError("invalid_forecast_length")
    if not isinstance(samples, int) or not 1 <= samples <= MAX_SAMPLES:
        raise ValueError("invalid_sample_count")
    previous = None
    for row in observations:
        if not isinstance(row, dict) or set(row) != {"timestamp", "open", "high", "low", "close", "volume"}:
            raise ValueError("invalid_observation")
        stamp = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
        values = [row[name] for name in ("open", "high", "low", "close", "volume")]
        if previous and stamp <= previous or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in values):
            raise ValueError("invalid_observation")
        if min(values[:4]) <= 0 or values[4] < 0 or row["high"] < max(row["open"], row["close"]) or row["low"] > min(row["open"], row["close"]):
            raise ValueError("invalid_observation")
        previous = stamp
    return observations, count, samples

def deterministic_forecast(observations, count, sample_count):
    times = next_trading_times(observations[-1]["timestamp"], count)
    paths = []
    for sample in range(sample_count):
        rng = random.Random(f"{observations[-1]['timestamp']}:{observations[-1]['close']}:{sample}")
        prior = observations[-1]
        path = []
        for timestamp in times:
            drift = (rng.random() - .48) * .012
            close = prior["close"] * (1 + drift); open_value = prior["close"]
            high = max(open_value, close) * (1 + rng.random() * .004); low = min(open_value, close) * (1 - rng.random() * .004)
            row = {"timestamp": timestamp, "open": open_value, "high": high, "low": low, "close": close, "volume": max(0, prior["volume"] * (.9 + rng.random() * .2))}
            path.append(row); prior = row
        paths.append(path)
    return paths

def load_real_model():
    global MODEL, TOKENIZER, PREDICTOR
    with MODEL_LOCK:
        if PREDICTOR is not None: return
        repository = os.getenv("KRONOS_REPOSITORY_PATH", "").strip()
        if repository: sys.path.insert(0, repository)
        from model import Kronos, KronosTokenizer, KronosPredictor
        TOKENIZER = KronosTokenizer.from_pretrained(TOKENIZER_PATH)
        MODEL = Kronos.from_pretrained(MODEL_PATH)
        PREDICTOR = KronosPredictor(MODEL, TOKENIZER, max_context=2048)

def real_forecast(observations, count, sample_count):
    import pandas as pd
    load_real_model(); times = next_trading_times(observations[-1]["timestamp"], count)
    frame = pd.DataFrame(observations).drop(columns=["timestamp"]); x_times = pd.Series(pd.to_datetime([row["timestamp"] for row in observations])); y_times = pd.Series(pd.to_datetime(times))
    raw_paths = []
    normalized_paths = []
    for _ in range(sample_count):
        result = PREDICTOR.predict(df=frame, x_timestamp=x_times, y_timestamp=y_times, pred_len=count, T=1.0, top_p=.9, sample_count=1, verbose=False)
        raw_path = []
        normalized_path = []
        for index in range(count):
            raw = {name: float(result.iloc[index][name]) for name in ("open", "high", "low", "close", "volume")}
            raw_row = {**raw, "timestamp": times[index]}
            normalized = dict(raw)
            normalized["high"] = max(raw["open"], raw["high"], raw["low"], raw["close"])
            normalized["low"] = min(raw["open"], raw["high"], raw["low"], raw["close"])
            normalized["volume"] = max(0.0, raw["volume"])
            raw_path.append(raw_row)
            normalized_path.append({**normalized, "timestamp": times[index]})
        raw_paths.append(raw_path)
        normalized_paths.append(normalized_path)
    return raw_paths, normalized_paths

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, body):
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(encoded))); self.end_headers(); self.wfile.write(encoded)
    def do_GET(self):
        if self.path != "/healthz": return self.send_json(404, {"error": "not_found"})
        self.send_json(200, {"status": "healthy", "mode": MODE, "modelLoaded": PREDICTOR is not None if MODE == "real" else True})
    def do_POST(self):
        if self.path != "/v1/forecast": return self.send_json(404, {"error": "not_found"})
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY: return self.send_json(413, {"error": "invalid_request"})
        if not INFERENCE_LOCK.acquire(blocking=False): return self.send_json(429, {"error": "capacity_unavailable"})
        try:
            observations, count, samples = validate(json.loads(self.rfile.read(length)))
            if MODE == "mock":
                paths = deterministic_forecast(observations, count, samples)
                raw_paths = paths
            else:
                raw_paths, paths = real_forecast(observations, count, samples)
            self.send_json(200, {"executionMode": "real_model" if MODE == "real" else "deterministic_adapter", "outputNormalization": "ohlcv_envelope" if MODE == "real" else "none", "modelName": MODEL_ID if MODE == "real" else "Kronos deterministic contract adapter", "modelVersion": "official-checkpoint" if MODE == "real" else "mock-v1", "tokenizerVersion": TOKENIZER_ID if MODE == "real" else "mock-v1", "checkpoint": MODEL_ID if MODE == "real" else "none", "rawSamples": raw_paths, "samples": paths})
        except (ValueError, json.JSONDecodeError) as error: self.send_json(400, {"error": str(error)[:80]})
        except Exception: self.send_json(503, {"error": "inference_unavailable"})
        finally: INFERENCE_LOCK.release()
    def log_message(self, format_string, *args):
        return

if __name__ == "__main__":
    host = "127.0.0.1"; port = int(os.getenv("KRONOS_PORT", "8091"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
