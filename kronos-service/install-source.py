"""Acquire the approved upstream Kronos source revision during a controlled build."""
import os
import pathlib
import subprocess

REVISION = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
REPOSITORY = "https://github.com/shiyu-coder/Kronos.git"
default_destination = pathlib.Path(__file__).resolve().parent / "upstream-kronos"
destination = pathlib.Path(os.getenv("KRONOS_REPOSITORY_PATH", str(default_destination))).resolve()
if destination.exists():
    result = subprocess.run(["git", "-C", str(destination), "rev-parse", "HEAD"], check=True, capture_output=True, text=True)
    if result.stdout.strip() != REVISION:
        raise SystemExit("Existing Kronos source revision does not match the approved pin.")
else:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", REPOSITORY, str(destination)], check=True)
    subprocess.run(["git", "-C", str(destination), "checkout", "--detach", REVISION], check=True)
