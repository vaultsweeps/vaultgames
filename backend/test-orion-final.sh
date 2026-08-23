#!/bin/bash
# Focused test: login fresh → immediately POST body request

API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"

md5()  { echo -n "$1" | md5sum | awk '{print $1}'; }

PASSWD_MD5=$(md5 "$AGENT_PASS")
PASSWD_USER=$(md5 "Test@1234")
AGENT_LOWER=$(echo -n "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')

echo "══════════════════════════════════════════"
echo " Final Test — POST Body with fresh login"
echo "══════════════════════════════════════════"

# ── Test 1: Fresh login → immediate POST body ─────────
echo ""
echo "▶ TEST 1: Fresh login → 2s wait → POST body"

T_LOGIN=$(date +%s)
LOGIN_RESP=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN}" \
  -H "Content-Length: 0")
echo "  Login: $LOGIN_RESP"

AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$AGENT_KEY" ] && AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
KEY_LOWER=$(echo -n "$AGENT_KEY" | tr '[:upper:]' '[:lower:]')

sleep 2   # minimal wait — just enough so reqTime > loginTime

T=$(date +%s)
USER="tst$(echo $T | tail -c 6)a"
SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}"
SIGN=$(md5 "$SIGN_INPUT")

echo "  signInput: $SIGN_INPUT"
echo "  sign:      $SIGN"
echo "  time:      $T  (login was $T_LOGIN, diff=$((T-T_LOGIN))s)"

RESP=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=registerUser" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "account=${USER}" \
  --data-urlencode "passwd=${PASSWD_USER}" \
  --data-urlencode "time=${T}" \
  --data-urlencode "sign=${SIGN}")
echo "  Response: $RESP"
echo ""
sleep 4

# ── Test 2: queryInfo — even simpler (no passwd param) ─
echo "▶ TEST 2: Fresh login → queryInfo via POST body"

T_LOGIN2=$(date +%s)
LOGIN_RESP2=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN2}" \
  -H "Content-Length: 0")
echo "  Login: $LOGIN_RESP2"

AGENT_KEY2=$(echo "$LOGIN_RESP2" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$AGENT_KEY2" ] && AGENT_KEY2=$(echo "$LOGIN_RESP2" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
KEY_LOWER2=$(echo -n "$AGENT_KEY2" | tr '[:upper:]' '[:lower:]')

sleep 2

T2=$(date +%s)
SIGN2=$(md5 "${AGENT_LOWER}${T2}${KEY_LOWER2}")
echo "  signInput: ${AGENT_LOWER}${T2}${KEY_LOWER2}"
echo "  sign: $SIGN2"

RESP2=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=queryInfo" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "account=test01" \
  --data-urlencode "time=${T2}" \
  --data-urlencode "sign=${SIGN2}")
echo "  Response: $RESP2"
echo ""
sleep 4

# ── Test 3: recharge — try another endpoint ────────────
echo "▶ TEST 3: Fresh login → getDownloadCode via POST body"

T_LOGIN3=$(date +%s)
LOGIN_RESP3=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN3}" \
  -H "Content-Length: 0")
echo "  Login: $LOGIN_RESP3"

AGENT_KEY3=$(echo "$LOGIN_RESP3" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$AGENT_KEY3" ] && AGENT_KEY3=$(echo "$LOGIN_RESP3" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
KEY_LOWER3=$(echo -n "$AGENT_KEY3" | tr '[:upper:]' '[:lower:]')

sleep 2

T3=$(date +%s)
SIGN3=$(md5 "${AGENT_LOWER}${T3}${KEY_LOWER3}")
echo "  signInput: ${AGENT_LOWER}${T3}${KEY_LOWER3}"
echo "  sign: $SIGN3"

RESP3=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=getDownloadCode" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "time=${T3}" \
  --data-urlencode "sign=${SIGN3}")
echo "  Response: $RESP3"

echo ""
echo "══════════════════════════════════════════"
echo " Done"
echo "══════════════════════════════════════════"
