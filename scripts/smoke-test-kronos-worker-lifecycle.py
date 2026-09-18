"""Deterministic contract for Gunicorn worker-owned Kronos initialization."""
import importlib.util
import io
import json
import os
import pathlib
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVICE = ROOT / "kronos-service"
sys.path.insert(0, str(SERVICE))
os.environ["KRONOS_ADAPTER_MODE"] = "deterministic_adapter"
os.environ["KRONOS_SERVICE_TOKEN"] = "worker-lifecycle-test-token"
os.environ["KRONOS_DISABLE_STARTUP_INITIALIZATION"] = "true"

import wsgi

assert wsgi.STATE.state == "STARTING"
assert wsgi.STATE.initialization_started is False
assert wsgi.STATE.initialization_thread is None

spec = importlib.util.spec_from_file_location("gunicorn_config_under_test", SERVICE / "gunicorn.conf.py")
gunicorn_config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gunicorn_config)

original_forecast = wsgi.deterministic_forecast
entered = threading.Event()
release = threading.Event()
warmups = 0

def blocked_forecast(*args):
    global warmups
    warmups += 1
    entered.set()
    assert release.wait(2)
    return original_forecast(*args)

wsgi.deterministic_forecast = blocked_forecast
assert gunicorn_config.post_worker_init(None) is True
assert entered.wait(2)
thread = wsgi.STATE.initialization_thread
assert thread is not None
assert wsgi.STATE.state == "HEALTHY_NOT_READY"
assert gunicorn_config.post_worker_init(None) is False
assert wsgi.STATE.initialization_thread is thread

def request(path, authenticated=False):
    status = []
    environ = {
        "PATH_INFO": path,
        "REQUEST_METHOD": "GET",
        "HTTP_AUTHORIZATION": "Bearer worker-lifecycle-test-token" if authenticated else "",
        "wsgi.input": io.BytesIO(b""),
    }
    body = b"".join(wsgi.application(environ, lambda value, _headers: status.append(value)))
    return status[0], json.loads(body)

assert request("/healthz") == ("200 OK", {
    "serviceVersion": "2.0.0",
    "serviceContractVersion": "KRONOS_SHADOW_SERVICE_V1",
    "status": "healthy",
})
status, body = request("/readyz", True)
assert status == "200 OK" and body["readyForInference"] is False

release.set()
thread.join(2)
assert not thread.is_alive()
assert wsgi.STATE.state == "READY"
assert warmups == 1
status, body = request("/readyz", True)
assert status == "200 OK"
assert body["readyForInference"] is True
assert body["modelLoaded"] is True
assert body["executionMode"] == "deterministic_adapter"
assert gunicorn_config.post_worker_init(None) is False
assert warmups == 1

wsgi.shutdown_service()
assert wsgi.STATE.state == "SHUTTING_DOWN"

failed_state = wsgi.ServiceState()
failed_state.mode = "unsupported"
assert failed_state.initialize() is True
assert failed_state.state == "FAILED_NOT_READY"
assert failed_state.initialize() is False
wsgi.STATE = failed_state
status, body = request("/readyz", True)
assert status == "200 OK" and body["readyForInference"] is False
print("Kronos Gunicorn worker lifecycle contract: PASS")
