#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
MINIAPP_PORT="${MINIAPP_PORT:-5174}"
NGROK_API_URL="${NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"
NGROK_LOG_DIR="$ROOT_DIR/.ngrok"
NGROK_LOG_FILE="$NGROK_LOG_DIR/foodize.log"
NGROK_CONFIG_FILE="$NGROK_LOG_DIR/ngrok.yml"
NGROK_PID=""

cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

fetch_ngrok_api() {
  if [[ "${NGROK_BIN:-}" == *.exe ]] && [ -x /mnt/c/Windows/System32/curl.exe ]; then
    /mnt/c/Windows/System32/curl.exe -fsS "$NGROK_API_URL" | tr -d '\r'
  else
    curl -fsS "$NGROK_API_URL"
  fi
}

get_ngrok_url() {
  local api_json

  api_json="$(fetch_ngrok_api 2>/dev/null)" || return 1

  python3 - "$MINIAPP_PORT" "$api_json" <<'PY'
import json
import sys

miniapp_port = sys.argv[1]
api_json = sys.argv[2]

try:
    data = json.loads(api_json)
except (json.JSONDecodeError, OSError):
    sys.exit(1)

for tunnel in data.get("tunnels", []):
    public_url = tunnel.get("public_url", "")
    config_addr = tunnel.get("config", {}).get("addr", "")
    if public_url.startswith("https://") and config_addr.endswith(f":{miniapp_port}"):
        print(public_url)
        sys.exit(0)

for tunnel in data.get("tunnels", []):
    public_url = tunnel.get("public_url", "")
    if public_url.startswith("https://"):
        print(public_url)
        sys.exit(0)

sys.exit(1)
PY
}

get_ngrok_url_from_log() {
  if [ ! -f "$NGROK_LOG_FILE" ]; then
    return 1
  fi

  python3 - "$NGROK_LOG_FILE" <<'PY'
from pathlib import Path
import re
import sys

log_path = Path(sys.argv[1])
urls = re.findall(r"url=(https://[^\s]+)", log_path.read_text(errors="ignore"))
if not urls:
    sys.exit(1)

print(urls[-1].strip('"'))
PY
}

update_env_url() {
  local public_url="$1"

  python3 - "$ENV_FILE" "$public_url" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
public_url = sys.argv[2]

lines = env_path.read_text().splitlines()
updated_mini_app = False
updated_telegram_mini_app = False
next_lines = []

for line in lines:
    if line.startswith("MINI_APP_URL="):
        next_lines.append(f"MINI_APP_URL={public_url}")
        updated_mini_app = True
    elif line.startswith("TELEGRAM__MINI_APP_URL="):
        next_lines.append("TELEGRAM__MINI_APP_URL=${MINI_APP_URL}")
        updated_telegram_mini_app = True
    else:
        next_lines.append(line)

if not updated_mini_app:
    next_lines.append(f"MINI_APP_URL={public_url}")
if not updated_telegram_mini_app:
    next_lines.append("TELEGRAM__MINI_APP_URL=${MINI_APP_URL}")

env_path.write_text("\n".join(next_lines) + "\n")
PY
}

get_ngrok_authtoken() {
  if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
    printf '%s\n' "$NGROK_AUTHTOKEN"
    return 0
  fi

  local windows_config="/mnt/c/Users/Mikhail Khorokhorin/AppData/Local/ngrok/ngrok.yml"
  if [ -f "$windows_config" ]; then
    python3 - "$windows_config" <<'PY'
from pathlib import Path
import sys

config_path = Path(sys.argv[1])

for line in config_path.read_text().splitlines():
    stripped = line.strip()
    if stripped.startswith("authtoken:"):
        print(stripped.split(":", 1)[1].strip().strip('"').strip("'"))
        break
PY
  fi
}

prepare_ngrok_config() {
  local authtoken

  mkdir -p "$NGROK_LOG_DIR"
  authtoken="$(get_ngrok_authtoken)"

  {
    echo 'version: "2"'
    if [ -n "$authtoken" ]; then
      echo "authtoken: $authtoken"
    fi
  } > "$NGROK_CONFIG_FILE"
}

ngrok_config_arg() {
  local ngrok_path="$1"

  if [[ "$ngrok_path" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$NGROK_CONFIG_FILE"
  else
    printf '%s\n' "$NGROK_CONFIG_FILE"
  fi
}

cleanup() {
  if [ -n "$NGROK_PID" ] && kill -0 "$NGROK_PID" >/dev/null 2>&1; then
    echo "Stopping ngrok..."
    kill "$NGROK_PID" >/dev/null 2>&1 || true
  fi
}

require_command docker
require_command curl
require_command python3
require_command ngrok
NGROK_BIN="$(command -v ngrok)"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    echo "Created .env from .env.example"
  else
    echo "Missing .env and .env.example"
    exit 1
  fi
fi

if ! grep -q '^BOT_TOKEN=.' "$ENV_FILE"; then
  echo "BOT_TOKEN is empty in .env. Fill it with the token from @BotFather, then run make tg again."
  exit 1
fi

if ! grep -q '^TELEGRAM__BOT_API_SECRET=.' "$ENV_FILE"; then
  echo "TELEGRAM__BOT_API_SECRET is empty in .env. Set any long local secret, then run make tg again."
  exit 1
fi

echo "Starting Telegram local services..."
docker compose up -d pg redis rabbitmq backend
docker compose up -d --force-recreate --renew-anon-volumes telegram-miniapp

echo "Waiting for the Mini App on http://localhost:$MINIAPP_PORT ..."
MINIAPP_READY=""
for _ in {1..60}; do
  if curl -fsS "http://localhost:$MINIAPP_PORT" >/dev/null 2>&1; then
    MINIAPP_READY="1"
    break
  fi
  sleep 1
done

if [ -z "$MINIAPP_READY" ]; then
  echo "Mini App did not respond on http://localhost:$MINIAPP_PORT"
  echo "Check logs with: docker compose logs telegram-miniapp --tail 100"
  exit 1
fi

prepare_ngrok_config
NGROK_CONFIG_ARG="$(ngrok_config_arg "$NGROK_BIN")"

PUBLIC_URL="$(get_ngrok_url || true)"

if [ -z "$PUBLIC_URL" ]; then
  : > "$NGROK_LOG_FILE"
  echo "Starting ngrok for http://localhost:$MINIAPP_PORT ..."
  ngrok http "$MINIAPP_PORT" --config "$NGROK_CONFIG_ARG" --log=stdout > "$NGROK_LOG_FILE" 2>&1 &
  NGROK_PID="$!"
  trap cleanup EXIT INT TERM

  for _ in {1..30}; do
    PUBLIC_URL="$(get_ngrok_url || get_ngrok_url_from_log || true)"
    if [ -n "$PUBLIC_URL" ]; then
      break
    fi
    sleep 1
  done
fi

if [ -z "$PUBLIC_URL" ]; then
  echo "Could not get an HTTPS ngrok URL. Check $NGROK_LOG_FILE"
  exit 1
fi

echo "Using Mini App URL: $PUBLIC_URL"
update_env_url "$PUBLIC_URL"

echo "Recreating services that read Telegram env values..."
docker compose up -d --force-recreate backend telegram-miniapp telegram-bot

echo "Telegram bot is running locally."
echo "Set the BotFather Menu Button URL to: $PUBLIC_URL"
echo "Bot logs: docker compose logs telegram-bot --tail 50"

if [ -n "$NGROK_PID" ]; then
  echo "ngrok is running in this terminal. Press Ctrl-C to stop the tunnel."
  wait "$NGROK_PID"
else
  echo "Using an already running ngrok tunnel."
fi
