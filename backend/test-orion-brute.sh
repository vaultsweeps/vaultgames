#!/bin/bash
# ═══════════════════════════════════════════════════════
# Orionstar — brute-force sign formula finder
# Logs in ONCE then tries every combination automatically
# ═══════════════════════════════════════════════════════

API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"

md5()  { echo -n "$1" | md5sum | awk '{print $1}'; }
now()  { date +%s; }

PASSWD_MD5=$(md5 "$AGENT_PASS")
PASSWD_USER=$(md5 "Test@1234")

echo "══════════════════════════════════════════════"
echo " Orionstar — Brute Force Sign Finder"
echo "══════════════════════════════════════════════"
echo ""

# ── Step 1: Login ───────────────────────────────────────
echo "▶ Logging in..."
LOGIN_TIME=$(now)
LOGIN_RESP=$(curl -sk -X POST \
  "${API_BASE}/ws/service.aspx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${LOGIN_TIME}" \
  -H "Content-Length: 0")

echo "  Response: $LOGIN_RESP"

CODE=$(echo "$LOGIN_RESP" | grep -oP '"code"\s*:\s*"?\K[^",}]+')
AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$AGENT_KEY" ] && AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')

if [ "$CODE" != "200" ] || [ -z "$AGENT_KEY" ]; then
  echo "  ❌ Login failed — stopping"
  exit 1
fi

KEY_LOWER=$(echo -n "$AGENT_KEY" | tr '[:upper:]' '[:lower:]')
AGENT_LOWER=$(echo -n "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')
KEY_MD5=$(md5 "$KEY_LOWER")

echo "  ✅ Login OK | agentKey = $AGENT_KEY"
echo ""

# ── Step 2: Wait 3s ─────────────────────────────────────
echo "▶ Waiting 4 seconds..."
sleep 4
echo ""

# ── Step 3: Try every combination ───────────────────────
try_sign() {
  local label="$1"
  local sign="$2"
  local url_path="$3"    # .aspx or .ashx
  local REQ_TIME=$(now)
  local USER="tst$(echo $REQ_TIME | tail -c 5)"

  local RESP=$(curl -sk -X POST \
    "${API_BASE}/ws/${url_path}?action=registerUser&agentName=${AGENT_NAME}&account=${USER}&passwd=${PASSWD_USER}&time=${REQ_TIME}&sign=${sign}" \
    -H "Content-Length: 0")

  local MSG=$(echo "$RESP" | grep -oP '"msg"\s*:\s*"\K[^"]+')
  local RCODE=$(echo "$RESP" | grep -oP '"code"\s*:\s*"?\K[^",}]+')

  if [ "$RCODE" = "200" ]; then
    echo "  ✅✅✅  SUCCESS — [${url_path}] ${label}"
    echo "         sign input: $SIGN_DBG"
    echo "         sign:       $sign"
    echo "         response:   $RESP"
  else
    echo "  ❌  [${url_path}] ${label} → $MSG"
  fi
  sleep 2  # respect rate limit
}

T=$(now)
TMS="${T}000"

echo "▶ Trying all sign combinations on service.aspx and service.ashx..."
echo "  (2s delay between each to respect rate limit)"
echo ""

# All formula variants — each tested on BOTH .aspx and .ashx

SIGN_DBG="${AGENT_LOWER}${T}${KEY_LOWER}"
try_sign "lowercase(agentName+time+agentKey) secs" "$(md5 ${AGENT_LOWER}${T}${KEY_LOWER})" "service.aspx"
SIGN_DBG="${AGENT_LOWER}${T}${KEY_LOWER}"
try_sign "lowercase(agentName+time+agentKey) secs" "$(md5 ${AGENT_LOWER}${T}${KEY_LOWER})" "service.ashx"

T=$(now); TMS="${T}000"
SIGN_DBG="${AGENT_NAME}${T}${AGENT_KEY}"
try_sign "as-is agentName+time+agentKey secs" "$(md5 ${AGENT_NAME}${T}${AGENT_KEY})" "service.aspx"
SIGN_DBG="${AGENT_NAME}${T}${AGENT_KEY}"
try_sign "as-is agentName+time+agentKey secs" "$(md5 ${AGENT_NAME}${T}${AGENT_KEY})" "service.ashx"

T=$(now); TMS="${T}000"
SIGN_DBG="${AGENT_LOWER}${TMS}${KEY_LOWER}"
try_sign "lowercase(agentName+time+agentKey) ms" "$(md5 ${AGENT_LOWER}${TMS}${KEY_LOWER})" "service.aspx"
SIGN_DBG="${AGENT_LOWER}${TMS}${KEY_LOWER}"
try_sign "lowercase(agentName+time+agentKey) ms" "$(md5 ${AGENT_LOWER}${TMS}${KEY_LOWER})" "service.ashx"

T=$(now); TMS="${T}000"
SIGN_DBG="${AGENT_LOWER}${T}${KEY_MD5}"
try_sign "lowercase(agentName+time+md5(agentKey)) secs" "$(md5 ${AGENT_LOWER}${T}${KEY_MD5})" "service.aspx"
SIGN_DBG="${AGENT_LOWER}${T}${KEY_MD5}"
try_sign "lowercase(agentName+time+md5(agentKey)) secs" "$(md5 ${AGENT_LOWER}${T}${KEY_MD5})" "service.ashx"

T=$(now); TMS="${T}000"
SIGN_DBG="${AGENT_LOWER}${T}${PASSWD_MD5}"
try_sign "lowercase(agentName+time+md5(password)) secs" "$(md5 ${AGENT_LOWER}${T}${PASSWD_MD5})" "service.aspx"
SIGN_DBG="${AGENT_LOWER}${T}${PASSWD_MD5}"
try_sign "lowercase(agentName+time+md5(password)) secs" "$(md5 ${AGENT_LOWER}${T}${PASSWD_MD5})" "service.ashx"

T=$(now); TMS="${T}000"
SIGN_DBG="${AGENT_LOWER}${LOGIN_TIME}${KEY_LOWER}"
try_sign "lowercase(agentName+LOGIN_time+agentKey) secs" "$(md5 ${AGENT_LOWER}${LOGIN_TIME}${KEY_LOWER})" "service.aspx"
SIGN_DBG="${AGENT_LOWER}${LOGIN_TIME}${KEY_LOWER}"
try_sign "lowercase(agentName+LOGIN_time+agentKey) secs" "$(md5 ${AGENT_LOWER}${LOGIN_TIME}${KEY_LOWER})" "service.ashx"

echo ""
echo "══════════════════════════════════════════════"
echo " Done — paste full output to Claude"
echo "══════════════════════════════════════════════"
