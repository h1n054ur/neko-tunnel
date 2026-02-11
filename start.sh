#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env
set -a
source .env
set +a

if [ -z "${CF_TURN_KEY_ID:-}" ] || [ -z "${CF_TURN_API_TOKEN:-}" ]; then
  echo "WARN: CF_TURN_KEY_ID or CF_TURN_API_TOKEN not set in .env"
  echo "      WebRTC will use STUN only (may not work behind strict NAT)"
  export NEKO_ICE_SERVERS='[{"urls":["stun:stun.l.google.com:19302"]}]'
else
  echo "==> Generating Cloudflare TURN credentials (24h TTL)..."
  ICE_JSON=$(curl -sf \
    "https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers" \
    -H "Authorization: Bearer ${CF_TURN_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"ttl": 86400}')

  if [ -z "$ICE_JSON" ]; then
    echo "ERROR: Failed to generate TURN credentials"
    exit 1
  fi

  # Extract the iceServers array, filter out port 53 URLs (blocked by browsers)
  NEKO_ICE_SERVERS=$(echo "$ICE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for server in data['iceServers']:
    if 'urls' in server:
        server['urls'] = [u for u in server['urls'] if ':53' not in u]
print(json.dumps(data['iceServers']))
")
  export NEKO_ICE_SERVERS

  echo "==> TURN credentials generated successfully"
  echo "    Servers: $(echo "$NEKO_ICE_SERVERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(', '.join(u for s in d for u in s.get('urls',[])))")"
fi

echo "==> Starting neko-tunnel stack..."
docker compose --profile tunnel up -d "$@"

echo ""
echo "==> Stack is up!"
echo "    User password: ${NEKO_USER_PASSWORD}"
echo "    Admin password: ${NEKO_ADMIN_PASSWORD}"
