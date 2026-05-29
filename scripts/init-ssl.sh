#!/bin/bash
# First-time HTTPS setup — supports Let's Encrypt and ZeroSSL.
# Run this ONCE on the server before or right after the first deploy.
#
# Usage:
#   bash scripts/init-ssl.sh <your@email.com>                                    # Let's Encrypt (default)
#   bash scripts/init-ssl.sh <your@email.com> zerossl <eab-kid> <eab-hmac-key>  # ZeroSSL
#
# ZeroSSL EAB credentials: zerossl.com → Developer → Generate EAB Credentials
# Use ZeroSSL if you hit "too many certificates" from Let's Encrypt —
# kro.kr is a shared domain and its 50-certs/week cap fills up fast.
#
# What it does:
#   1. Creates a temporary self-signed cert so nginx can boot.
#   2. Starts nginx + app.
#   3. Runs certbot to get the real cert.
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
EMAIL="${1:?Usage: $0 <your-email> [zerossl <eab-kid> <eab-hmac-key>]}"
CA="${2:-letsencrypt}"
EAB_KID="${3:-}"
EAB_HMAC_KEY="${4:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../config/ssl"

case "$CA" in
  zerossl)
    ACME_SERVER="https://acme.zerossl.com/v2/DV90"
    if [[ -z "$EAB_KID" || -z "$EAB_HMAC_KEY" ]]; then
      echo "Error: ZeroSSL requires EAB credentials." >&2
      echo "Usage: $0 <email> zerossl <eab-kid> <eab-hmac-key>" >&2
      echo "Get them at: zerossl.com → Developer → Generate EAB Credentials" >&2
      exit 1
    fi
    echo "==> Using ZeroSSL as certificate authority."
    ;;
  letsencrypt|"")
    ACME_SERVER="https://acme-v02.api.letsencrypt.org/directory"
    echo "==> Using Let's Encrypt as certificate authority."
    ;;
  *)
    echo "Unknown CA '$CA'. Use 'letsencrypt' or 'zerossl'." >&2
    exit 1
    ;;
esac

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

echo "==> [3/4] Issuing certificate for $DOMAIN via $CA..."
EAB_FLAGS=""
if [[ -n "$EAB_KID" && -n "$EAB_HMAC_KEY" ]]; then
  EAB_FLAGS="--eab-kid $EAB_KID --eab-hmac-key $EAB_HMAC_KEY"
fi
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --server "$ACME_SERVER" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive \
  $EAB_FLAGS

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
