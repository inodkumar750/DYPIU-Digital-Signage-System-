#!/usr/bin/env bash
# One-time server setup for NEXORA: Docker + app folder + GitHub Actions self-hosted runner.
# Tested target: Ubuntu / Debian. Run ON THE SERVER as root:
#
#   sudo bash setup-server.sh \
#        --repo https://github.com/inodkumar750/DYPIU-Digital-Signage-System- \
#        --token <RUNNER_REGISTRATION_TOKEN> \
#        --public-url http://10.100.0.39:5000
#
# The registration token comes from GitHub: repo → Settings → Actions → Runners → New self-hosted runner
# (it is valid for ~1 hour). The script is safe to re-run.
set -euo pipefail

REPO=""; TOKEN=""; PUBLIC_URL=""; RUNNER_NAME="nexora-$(hostname)"; APP_DIR="/opt/nexora"; RUNNER_DIR="/opt/actions-runner"
RUNNER_USER="github-runner"; RUNNER_VERSION="2.321.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2;;
    --token) TOKEN="$2"; shift 2;;
    --public-url) PUBLIC_URL="$2"; shift 2;;
    --name) RUNNER_NAME="$2"; shift 2;;
    *) echo "Unknown option $1"; exit 2;;
  esac
done
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }
[[ -n "$REPO" && -n "$TOKEN" && -n "$PUBLIC_URL" ]] || { echo "--repo, --token and --public-url are required"; exit 2; }

echo "==> 1/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y curl ca-certificates
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin

echo "==> 2/5 Runner user"
id "$RUNNER_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$RUNNER_USER"
usermod -aG docker "$RUNNER_USER"

echo "==> 3/5 App folder and secrets ($APP_DIR/.env)"
mkdir -p "$APP_DIR"
if [[ ! -f "$APP_DIR/.env" ]]; then
  rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  cat > "$APP_DIR/.env" <<EOF
DB_PASSWORD=$(rand 24)
CAMPUSCAST_AUTH_SECRET=$(rand 48)
CAMPUSCAST_PUBLIC_URL=${PUBLIC_URL}
CAMPUSCAST_TIMEZONE=Asia/Kolkata
CAMPUSCAST_REQUIRE_DEVICE_KEY=0
APP_PORT=5000
# CAMPUSCAST_ALERT_WEBHOOK_URL=
EOF
  chmod 600 "$APP_DIR/.env"
  echo "    created new $APP_DIR/.env with random secrets"
else
  echo "    $APP_DIR/.env already exists — left untouched"
fi
chown -R "$RUNNER_USER":"$RUNNER_USER" "$APP_DIR"

echo "==> 4/5 GitHub Actions runner"
mkdir -p "$RUNNER_DIR"; chown "$RUNNER_USER":"$RUNNER_USER" "$RUNNER_DIR"
if [[ ! -f "$RUNNER_DIR/config.sh" ]]; then
  ARCH=$(uname -m); case "$ARCH" in x86_64) RARCH=x64;; aarch64) RARCH=arm64;; *) echo "Unsupported arch $ARCH"; exit 1;; esac
  sudo -u "$RUNNER_USER" bash -c "cd '$RUNNER_DIR' && curl -fsSL -o r.tgz https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RARCH}-${RUNNER_VERSION}.tar.gz && tar xzf r.tgz && rm r.tgz"
  "$RUNNER_DIR/bin/installdependencies.sh" || true
fi
if [[ ! -f "$RUNNER_DIR/.runner" ]]; then
  sudo -u "$RUNNER_USER" bash -c "cd '$RUNNER_DIR' && ./config.sh --unattended --url '$REPO' --token '$TOKEN' --name '$RUNNER_NAME' --labels nexora --replace"
else
  echo "    runner already configured"
fi
cd "$RUNNER_DIR"
./svc.sh install "$RUNNER_USER" 2>/dev/null || true
./svc.sh start

echo "==> 5/5 Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 5000/tcp
fi

echo
echo "Done. The runner '$RUNNER_NAME' should now show as Idle in GitHub → Settings → Actions → Runners."
echo "Push to main (or run the 'CI-CD' workflow) to deploy. App will be at ${PUBLIC_URL}"
