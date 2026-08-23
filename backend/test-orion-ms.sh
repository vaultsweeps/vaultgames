#!/bin/bash
# POST body + milliseconds timestamp — the one combination not yet tried

API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"

md5()   { echo -n "$1" | md5sum | awk '{print $1}'; }
nowms() { date +%s%3N; }   # milliseconds
nows()  { date +%s; }       # seconds

PASSWD_MD5=$(md5 "$AGENT_PASS")
PASSWD_USER=$(md5 "Test@1234")
AGENT_LOWER=$(echo -n "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')

echo "══════════════════════════════════════════"
echo " POST Body + Milliseconds Test"
echo "══════════════════════════════════════════"

# Stop pm2 temporarily to avoid key invalidation from service
echo ""
echo "▶ Stopping pm2 service (prevents key conflicts)..."
pm2 stop vaultsweeps-backend 2>/dev/null
sleep 2

run_test() {
  local label="$1"
  local time_val="$2"   # the actual time value to use
  local sign_time="$3"  # time used in sign (may differ for testing)

  # Fresh login every time
  local T_LOGIN=$(nows)
  local LOGIN_RESP=$(curl -sk -X POST \
    "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN}" \
    -H "Content-Length: 0")
  local AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
  [ -z "$AGENT_KEY" ] && AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
  local KEY_LOWER=$(echo -n "$AGENT_KEY" | tr '[:upper:]' '[:lower:]')

  echo ""
  echo "▶ $label"
  echo "  Login: code=$(echo $LOGIN_RESP | grep -oP '"code"\s*:\s*"?\K[^",}]+') key=$AGENT_KEY"

  sleep 2

  local T=$(eval "$time_val")
  local ST=$(eval "$sign_time")
  local USER="ts$(echo $(nows) | tail -c 5)"
  local SIGN_INPUT="${AGENT_LOWER}${ST}${KEY_LOWER}"
  local SIGN=$(md5 "$SIGN_INPUT")

  echo "  time (req) : $T"
  echo "  time (sign): $ST"
  echo "  signInput  : $SIGN_INPUT"
  echo "  sign       : $SIGN"

  local RESP=$(curl -sk -X POST \
    "${API_BASE}/ws/service.ashx?action=registerUser" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "agentName=${AGENT_NAME}" \
    --data-urlencode "account=${USER}" \
    --data-urlencode "passwd=${PASSWD_USER}" \
    --data-urlencode "time=${T}" \
    --data-urlencode "sign=${SIGN}")
  echo "  Response   : $RESP"

  sleep 3
}

# Test A: POST body, ms time in request, ms time in sign
run_test "POST body | req=ms | sign=ms" "nowms" "nowms"

# Test B: POST body, ms time in request, seconds time in sign
run_test "POST body | req=ms | sign=seconds" "nowms" "nows"

# Test C: POST body, seconds in request, ms in sign (catch mismatches)
run_test "POST body | req=seconds | sign=ms" "nows" "nowms"

# Test D: POST body, seconds in request, seconds in sign (baseline we know)
run_test "POST body | req=seconds | sign=seconds" "nows" "nows"

# Test E: getDownloadCode (simpler — no account param) with ms
echo ""
echo "▶ TEST E: getDownloadCode | POST body | ms"
T_LOGIN_E=$(nows)
LOGIN_RESP_E=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN_E}" \
  -H "Content-Length: 0")
AGENT_KEY_E=$(echo "$LOGIN_RESP_E" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
KEY_LOWER_E=$(echo -n "$AGENT_KEY_E" | tr '[:upper:]' '[:lower:]')
echo "  Login: $LOGIN_RESP_E"
sleep 2
T_E=$(nowms)
SIGN_E=$(md5 "${AGENT_LOWER}${T_E}${KEY_LOWER_E}")
echo "  signInput: ${AGENT_LOWER}${T_E}${KEY_LOWER_E}"
RESP_E=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=getDownloadCode" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "time=${T_E}" \
  --data-urlencode "sign=${SIGN_E}")
echo "  Response: $RESP_E"

echo ""
echo "▶ Restarting pm2 service..."
pm2 start vaultsweeps-backend 2>/dev/null

echo ""
echo "══════════════════════════════════════════"
echo " Done — paste full output"
echo "══════════════════════════════════════════"
