#!/bin/bash
# ============================================================
# deploy.sh — FindMyDonor Oracle VM Deployment Script
# Run this ON the Oracle VM as the deployment user.
# Usage: bash deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="/home/ubuntu/findmydonor"
REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git"   # ← fill in
BRANCH="main"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " FindMyDonor — Deploying to Oracle VM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Ensure Node ≥ 20 and PM2 are installed ────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(+process.version.slice(1).split(".")[0] < 20)')" != "" ]]; then
  echo "[Setup] Installing Node 20 via nvm…"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  nvm alias default 20
fi
echo "[✓] Node $(node --version)"

if ! command -v pm2 &>/dev/null; then
  echo "[Setup] Installing PM2…"
  npm install -g pm2
fi
echo "[✓] PM2 $(pm2 --version)"

# ── 2. Git logic removed for SCP deployment ────────────────
cd "$APP_DIR"

# ── 3. Write production .env (only if it doesn't exist) ──
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "[Env] Creating $ENV_FILE from template — FILL IN SECRETS BEFORE STARTING!"
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  # Patch known-safe values automatically
  sed -i "s|APP_URL=.*|APP_URL=https://findmydonor.online|" "$ENV_FILE"
  sed -i "s|WAHA_BASE_URL=.*|WAHA_BASE_URL=http://127.0.0.1:3001|" "$ENV_FILE"
  sed -i "s|ADMIN_PORT=.*|ADMIN_PORT=6000|" "$ENV_FILE"
else
  echo "[Env] $ENV_FILE exists — skipping overwrite."
fi

# ── 4. Install dependencies (production only) ─────────────
echo "[npm] Installing dependencies…"
npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# ── 5. Build production bundles ───────────────────────────
echo "[Build] Building frontend + backend…"
npm run build

echo "[✓] Build complete. dist/ and dist-admin/ created."

# ── 6. Open firewall ports (Oracle iptables) ──────────────
echo "[Firewall] Opening ports 3001, 5000, 6000…"
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 6000 -j ACCEPT 2>/dev/null || true
# Persist rules (Ubuntu)
sudo netfilter-persistent save 2>/dev/null || true

# ── 7. Start / reload PM2 ────────────────────────────────
echo "[PM2] Reloading apps…"
if pm2 list | grep -q "findmydonor"; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save
pm2 startup 2>/dev/null || true   # register PM2 on system boot

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
echo ""
echo "  Frontend   → http://145.241.154.187:3001/"
echo "  Backend    → http://145.241.154.187:5000/"
echo "  Admin      → http://145.241.154.187:6000/"
echo "  Domain     → https://findmydonor.online/"
echo ""
echo "  pm2 status → pm2 list"
echo "  pm2 logs   → pm2 logs findmydonor-backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
