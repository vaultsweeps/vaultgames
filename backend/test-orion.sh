#!/bin/bash

# ═══════════════════════════════════════════════════════
#  Orionstar API — Terminal Diagnostic (curl + bash)
#  Usage: bash test-orion.sh
# ═══════════════════════════════════════════════════════

# ─── FILL THESE IN ─────────────────────────────────────
API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"   # plain-text password (filled in based on previous context)
# ───────────────────────────────────────────────────────

SERVICE="/ws/service.ashx"
URL="${API_BASE}${SERVICE}"

md5() { echo -n "$1" | md5sum | awk '{print $1}'; }
now()  { date +%s; }
sep()  { echo "────────────────────────────────────────────"; }

echo ""
echo "════════════════════════════════════════════"
echo "  Orionstar API Diagnostic"
echo "════════════════════════════════════════════"
echo "  Agent : $AGENT_NAME"
echo "  Pass  : $AGENT_PASS"
echo "  MD5   : $(md5 $AGENT_PASS)"
echo ""

# ── STEP 1: agentLogin ──────────────────────────────────
sep
echo "STEP 1 — agentLogin"
sep

LOGIN_TIME=$(now)
PASSWD_MD5=$(md5 "$AGENT_PASS")

echo "  agentName   : $AGENT_NAME"
echo "  agentPasswd : $PASSWD_MD5"
echo "  time        : $LOGIN_TIME"
echo ""

LOGIN_RESP=$(curl -s -X POST \
  "${URL}?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${LOGIN_TIME}" \
  -H "Content-Length: 0")

echo "  Response: $LOGIN_RESP"
echo ""

# Parse code and agentKey from JSON response (no jq needed)
CODE=$(echo "$LOGIN_RESP" | grep -o '"code":"[^"]*"' | grep -o '[0-9]*')
# Try both lowercase and mixed case field names
AGENT_KEY=$(echo "$LOGIN_RESP" | grep -o '"agentkey":"[^"]*"' | cut -d'"' -f4)
if [ -z "$AGENT_KEY" ]; then
  AGENT_KEY=$(echo "$LOGIN_RESP" | grep -o '"agentKey":"[^"]*"' | cut -d'"' -f4)
fi

if [ "$CODE" != "200" ]; then
  echo "  ❌ Login FAILED (code=$CODE)"
  echo "  → Check AGENT_NAME and AGENT_PASS at the top of this script"
  exit 1
fi

if [ -z "$AGENT_KEY" ]; then
  echo "  ❌ No agentKey found in response"
  echo "  → Full response: $LOGIN_RESP"
  exit 1
fi

echo "  ✅ Login SUCCESS"
echo "  agentKey : $AGENT_KEY"

# ── STEP 2: Wait 3 seconds ──────────────────────────────
sep
echo "STEP 2 — Waiting 3 seconds..."
sep
sleep 3

# ── STEP 3: registerUser ────────────────────────────────
sep
echo "STEP 3 — registerUser"
sep

REQ_TIME=$(now)
SIGN_INPUT=$(echo -n "${AGENT_NAME}${REQ_TIME}${AGENT_KEY}" | tr '[:upper:]' '[:lower:]')
SIGN=$(md5 "$SIGN_INPUT")
PASSWD_USER=$(md5 "Test@1234")
# Use last 6 digits of epoch as suffix — always 6+ chars, always unique
TEST_USER="tst$(echo $REQ_TIME | tail -c 7)"

echo "  Sign input  : $SIGN_INPUT"
echo "  Sign (md5)  : $SIGN"
echo "  loginTime   : $LOGIN_TIME"
echo "  reqTime     : $REQ_TIME"
echo "  Diff        : $((REQ_TIME - LOGIN_TIME)) seconds  (must be > 0)"
echo "  Test user   : $TEST_USER  (${#TEST_USER} chars)"
echo ""

REG_RESP=$(curl -s -X POST \
  "${URL}?action=registerUser&agentName=${AGENT_NAME}&account=${TEST_USER}&passwd=${PASSWD_USER}&time=${REQ_TIME}&sign=${SIGN}" \
  -H "Content-Length: 0")

echo "  Response: $REG_RESP"
echo ""

REG_CODE=$(echo "$REG_RESP" | grep -o '"code":"[^"]*"' | grep -o '[0-9]*')
REG_MSG=$(echo  "$REG_RESP" | grep -o '"msg":"[^"]*"'  | cut -d'"' -f4)

if [ "$REG_CODE" = "200" ]; then
  echo "  ✅ registerUser SUCCESS"
  echo ""
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✅ API IS WORKING CORRECTLY"
  echo "  → Your service code has a build/deploy issue"
  echo "  → Run: npm run build && pm2 restart vaultsweeps-backend"
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "  ❌ registerUser FAILED"
  echo "  code : $REG_CODE"
  echo "  msg  : $REG_MSG"
  echo ""

  MSG_LOWER=$(echo "$REG_MSG" | tr '[:upper:]' '[:lower:]')

  if echo "$MSG_LOWER" | grep -q "signature"; then
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  DIAGNOSIS: Signature mismatch"
    echo "  → agentName or agentKey in the sign is wrong"
    echo "  → Check agentId and secretKey in your DB"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  elif echo "$MSG_LOWER" | grep -q "session\|timeout"; then
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  DIAGNOSIS: Session timeout"
    echo "  → Diff between login and request must be > 0"
    echo "  → Current diff: $((REQ_TIME - LOGIN_TIME))s"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  else
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  DIAGNOSIS: Not an auth error — different issue"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
fi

# ── STEP 4: queryInfo (confirm session still alive) ─────
sep
echo "STEP 4 — queryInfo (session alive check)"
sep

Q_TIME=$(now)
Q_INPUT=$(echo -n "${AGENT_NAME}${Q_TIME}${AGENT_KEY}" | tr '[:upper:]' '[:lower:]')
Q_SIGN=$(md5 "$Q_INPUT")

QUERY_RESP=$(curl -s -X POST \
  "${URL}?action=queryAgentInfo&agentName=${AGENT_NAME}&passwd=${PASSWD_MD5}&time=${Q_TIME}&sign=${Q_SIGN}" \
  -H "Content-Length: 0")

echo "  Response: $QUERY_RESP"

echo ""
echo "════════════════════════════════════════════"
echo "  Diagnostic complete — paste output above"
echo "════════════════════════════════════════════"
echo ""
