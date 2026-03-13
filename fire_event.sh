#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:4040/api/v1"
FINGERPRINT='eyJhcHBWZXJzaW9uIjoiMC4wLjEiLCJkZXZpY2VJZCI6ImQwMGU3YzQ1ZTg4MDA4YTMiLCJpcCI6IjEwLjAuMi4xNSIsIm1vZGVsIjoiR29vZ2xlIHNka19ncGhvbmU2NF9hcm02NCIsInBsYXRmb3JtIjoiYW5kcm9pZCIsInVzZXJBZ2VudCI6IlNuYXBsZXQvMC4wLjEgKEFuZHJvaWQ7IEdvb2dsZSBzZGtfZ3Bob25lNjRfYXJtNjQpIn0='

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅${NC} $*"; }
err() { echo -e "${RED}[$(date '+%H:%M:%S')] ❌${NC} $*"; }

TARGET_USER_ID="6965e21d1a259d10c7be1726"  # meo@gmail.com
SEQ=1

# Login User2
log "Logging in hehehehe@gmail.com..."
RESP=$(curl -sS \
  -H "Content-Type: application/json" \
  -H "X-Client-Fingerprint: $FINGERPRINT" \
  -d '{"email":"hehehehe@gmail.com","password":"Thinhpro0123"}' \
  "$BASE_URL/auth/login")

TOKEN=$(echo "$RESP" | jq -r '.data.token.accessToken // .token.accessToken // empty')
if [[ -z "$TOKEN" ]]; then
  err "Login failed: $RESP"; exit 1
fi
ok "Logged in. Firing events to meo@gmail.com every 5s. Ctrl+C to stop."
echo ""

# Bắn event mỗi 3 giây
while true; do
  RESP=$(curl -sS -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Client-Fingerprint: $FINGERPRINT" \
    -d "{\"targetUserId\":\"$TARGET_USER_ID\",\"seq\":$SEQ,\"count\":1}" \
    "$BASE_URL/posts/debug/sse")

  ok "Fired seq=${SEQ} → resp: $RESP"
  SEQ=$(( SEQ + 1 ))
  sleep 3
done