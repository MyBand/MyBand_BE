#!/bin/bash
# First-time HTTPS / Let's Encrypt setup.
# Run this ONCE on the server before or right after the first deploy.
#
# Usage: bash scripts/init-ssl.sh <your@email.com>
#
# What it does:
#   1. Creates a temporary self-signed cert so nginx can boot.
#   2. Starts nginx + app.
#   3. Runs certbot (webroot) to get the real Let's Encrypt cert.
#   4. Copies the cert into config/ssl/ (nginx reads from there).
#   5. Reloads nginx.
#
# After this, the certbot service in docker-compose handles renewals
# automatically every 12 h. To ensure nginx picks up renewed certs,
# add this cron to the server (crontab -e):
#
#   0 3 * * * cd /path/to/MyBand_BE && docker compose exec nginx nginx -s reload

set -euo pipefail

DOMAIN="pagomnini.kro.kr"
EMAIL="${1:?Usage: $0 <your-email>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../config/ssl"

echo "==> [1/4] Generating temporary self-signed cert..."
mkdir -p "$SSL_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$SSL_DIR/key.pem" \
  -out  "$SSL_DIR/cert.pem" \
  -subj "/CN=$DOMAIN" 2>/dev/null
echo "    Created $SSL_DIR/{cert,key}.pem"

echo "==> [2/4] Starting app and nginx..."
docker compose up -d app nginx
echo -n "    Waiting for nginx to pass health check"
for _ in $(seq 1 15); do
  sleep 2
  if docker compose exec nginx nginx -t 2>/dev/null; then
    echo " OK"
    break
  fi
  echo -n "."
done

echo "==> [3/4] Issuing Let's Encrypt certificate for $DOMAIN..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive

echo "==> [4/4] Installing certificate and reloading nginx..."
docker compose run --rm --entrypoint sh certbot -c "
  cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/ssl-export/cert.pem &&
  cp /etc/letsencrypt/live/$DOMAIN/privkey.pem   /etc/ssl-export/key.pem &&
  echo '    Certificate copied to config/ssl/'
"
docker compose exec nginx nginx -s reload

echo ""
echo "==> Done! HTTPS is live at https://$DOMAIN"
echo "    Add a daily cron to reload nginx after auto-renewal:"
echo "    0 3 * * * cd $(realpath "$SCRIPT_DIR/..") && docker compose exec nginx nginx -s reload"
