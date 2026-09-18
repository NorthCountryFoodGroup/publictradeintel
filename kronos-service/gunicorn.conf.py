"""Production Gunicorn settings for one resident model and bounded shutdown."""
import os

bind = f"0.0.0.0:{int(os.getenv('PORT', '10000'))}"
worker_class = "gthread"
workers = 1
threads = 4
timeout = 120
graceful_timeout = 30
keepalive = 5
preload_app = False

def post_worker_init(_worker):
    from wsgi import start_service_initialization
    return start_service_initialization()

def worker_int(_worker):
    from wsgi import shutdown_service
    shutdown_service()

def worker_abort(_worker):
    from wsgi import shutdown_service
    shutdown_service()
