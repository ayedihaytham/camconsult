#!/usr/bin/env bash
# Installe les prérequis système sur un VPS Ubuntu 22.04 / 24.04.
# Usage :  sudo bash deploy/setup-vps.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Lancez avec sudo :  sudo bash deploy/setup-vps.sh" >&2
  exit 1
fi

echo "==> Mise à jour du système"
apt-get update -y
apt-get upgrade -y

echo "==> Node.js 20 (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> PostgreSQL, Nginx, Git, Certbot"
apt-get install -y postgresql postgresql-contrib nginx git ufw \
  certbot python3-certbot-nginx

systemctl enable --now postgresql
systemctl enable --now nginx

echo "==> PM2 (gestionnaire de processus Node)"
npm install -g pm2

echo "==> Pare-feu (SSH + HTTP + HTTPS)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

echo
echo "✅ Prérequis installés."
echo "   Node : $(node -v) | npm : $(npm -v) | PM2 : $(pm2 -v)"
echo "   Suite des étapes : voir DEPLOIEMENT-VPS.md (à partir de l'étape 3)."
