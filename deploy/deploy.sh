#!/usr/bin/env bash
# Deploys the checked-out code with Docker Compose, health-checks it and rolls back on failure.
# Used by .github/workflows/ci-cd.yml on the self-hosted runner; can also be run by hand from the repo root.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/nexora/.env}"
PROJECT="${PROJECT:-nexora}"
PORT="$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2 || true)"; PORT="${PORT:-5000}"
DC=(docker compose -p "$PROJECT" --env-file "$ENV_FILE")

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE — run deploy/setup-server.sh first."; exit 1; }

# Keep the running image so we can roll back.
if docker image inspect nexora-app:latest >/dev/null 2>&1; then
  docker tag nexora-app:latest nexora-app:previous
fi

echo "==> Building and starting"
"${DC[@]}" up -d --build --remove-orphans

echo "==> Waiting for health"
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" | grep -q '"healthy"'; then
    echo "Healthy after ~$((i*3))s"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 3
done

echo "!! Health check failed — last app logs:"
"${DC[@]}" logs --tail=60 app || true
if docker image inspect nexora-app:previous >/dev/null 2>&1; then
  echo "==> Rolling back to previous image"
  docker tag nexora-app:previous nexora-app:latest
  "${DC[@]}" up -d --no-build app
fi
exit 1
