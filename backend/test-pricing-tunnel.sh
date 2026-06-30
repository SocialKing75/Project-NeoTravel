#!/usr/bin/env bash
# Test rapide de l'API de pricing exposee via le tunnel Cloudflare.
# Usage: bash test-pricing-tunnel.sh [BASE_URL]
set -u

BASE="${1:-https://publicity-stripes-kitty-lay.trycloudflare.com}"
PAYLOAD='{"distance_km":200,"aller_retour":true,"saison":"Haute","days_to_departure":20,"capacity":50}'

echo "=== 1) Ping $BASE/ ==="
curl -sS "$BASE/" -w "\n[HTTP %{http_code}]\n"
echo

echo "=== 2) POST $BASE/calculer-devis ==="
echo "Payload: $PAYLOAD"
RESP=$(curl -sS -X POST "$BASE/calculer-devis" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w $'\n%{http_code}')

CODE=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')
echo "$BODY"
echo "[HTTP $CODE]"
echo

if [ "$CODE" = "200" ]; then
  echo "✅ OK — l'API repond. L'agent peut appeler le tunnel."
else
  echo "❌ ECHEC (HTTP $CODE) — l'API n'est pas prete (voir le corps ci-dessus)."
fi
