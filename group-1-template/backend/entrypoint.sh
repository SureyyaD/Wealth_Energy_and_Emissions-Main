#!/bin/bash
set -eu

# Defaults (override via env)
: "${DEV_MODE:=false}"
: "${APP_MODULE:=app.asgi:api_app}" # use python package resolution instead of full path
: "${HOST:=0.0.0.0}"
: "${PORT:=5001}"
: "${WORKERS:=4}"
: "${LOG_LEVEL:=info}"

if [ "$DEV_MODE" = "true" ]; then
  echo "[entrypoint] Development mode with hot reload..."
  # Helpful in Docker on some filesystems (optional):
  # export WATCHFILES_FORCE_POLLING=true
  exec uvicorn "$APP_MODULE" \
    --host "$HOST" \
    --port "$PORT" \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --reload \
    --reload-dir /usr/src/app \
    --reload-include '*.py' \
    --reload-exclude '.git/*' \
    --reload-exclude '__pycache__/*' \
    --reload-exclude '.venv/*' \
    --log-level "$LOG_LEVEL"
else
  echo "[entrypoint] Production mode with gunicorn..."
  # Note: APP_MODULE is module:var (your FastAPI instance variable)
  exec gunicorn "$APP_MODULE" \
    --workers "$WORKERS" \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "$HOST:$PORT" \
    --access-logfile '-' \
    --log-level "$LOG_LEVEL"
fi