#!/usr/bin/env bash
set -euo pipefail

# Deploy static pocket guide to gp.mosreg.alenos.ru via configured SSH host.
# Prerequisites:
# - SSH alias `timeweb-n8n` works
# - Nginx installed on server
# - DNS A record points gp.mosreg.alenos.ru -> server IP

SSH_HOST="${SSH_HOST:-timeweb-n8n}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/gp.mosreg.alenos.ru}"
DOMAIN="${DOMAIN:-gp.mosreg.alenos.ru}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Pre-check local files"
test -f "index.html"

echo "==> Upload static files"
ssh "$SSH_HOST" "mkdir -p \"$REMOTE_DIR\""
scp "index.html" "$SSH_HOST:$REMOTE_DIR/index.html"

# data.json is optional now because primary source is Google Sheets.
if [[ -f "data.json" ]]; then
  scp "data.json" "$SSH_HOST:$REMOTE_DIR/data.json"
fi

echo "==> Install nginx site config"
scp "nginx.vvod26.conf" "$SSH_HOST:/etc/nginx/sites-available/$DOMAIN"
ssh "$SSH_HOST" "ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"

echo "==> Validate and reload nginx"
ssh "$SSH_HOST" "nginx -t && systemctl reload nginx"

echo "==> Ensure TLS certificate"
ssh "$SSH_HOST" "certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect || true"

echo "==> Done"
echo "Open: https://$DOMAIN"
