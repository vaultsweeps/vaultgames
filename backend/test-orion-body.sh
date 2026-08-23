#!/bin/bash
# Tests two things:
# 1. Whether params in POST BODY (vs query string) makes a difference
# 2. Shows your server's public IP so you can whitelist it

API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"

md5()  { echo -n "$1" | md5sum | awk '{print $1}'; }

PASSWD_MD5=$(md5 "$AGENT_PASS")
PASSWD_USER=$(md5 "Test@1234")
AGENT_LOWER=$(echo -n "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')

echo "══════════════════════════════════════════"
echo " Orionstar — IP & Body Format Test"
echo "══════════════════════════════════════════"
echo ""
echo "▶ Your server's public IP addresses:"
echo "  IPv4: $(curl -s4 ifconfig.me 2>/dev/null || curl -s4 api.ipify.org)"
echo "  IPv6: $(curl -s6 ifconfig.me 2>/dev/null || echo 'none')"
echo ""
echo "  ⚠ If Orion requires IP whitelisting, share the IPv4 above"
echo "    with your Orion Stars account manager / support."
echo ""

# Login
echo "▶ Logging in..."
T_LOGIN=$(date +%s)
LOGIN_RESP=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${T_LOGIN}" \
  -H "Content-Length: 0")
echo "  Response: $LOGIN_RESP"

AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$AGENT_KEY" ] && AGENT_KEY=$(echo "$LOGIN_RESP" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
CODE=$(echo "$LOGIN_RESP" | grep -oP '"code"\s*:\s*"?\K[^",}]+')

if [ "$CODE" != "200" ] || [ -z "$AGENT_KEY" ]; then
  echo "  ❌ Login failed"; exit 1
fi
KEY_LOWER=$(echo -n "$AGENT_KEY" | tr '[:upper:]' '[:lower:]')
echo "  ✅ Login OK | key=$AGENT_KEY"
echo ""
sleep 4

T=$(date +%s)
USER="tst$(echo $T | tail -c 6)"
SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}"
SIGN=$(md5 "$SIGN_INPUT")

echo "▶ Test A — Params in QUERY STRING (what we've been doing)"
echo "  time=$T  signInput=$SIGN_INPUT  sign=$SIGN"
RESP_A=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=registerUser&agentName=${AGENT_NAME}&account=${USER}a&passwd=${PASSWD_USER}&time=${T}&sign=${SIGN}" \
  -H "Content-Length: 0")
echo "  Response: $RESP_A"
echo ""
sleep 3

T=$(date +%s)
USER="tst$(echo $T | tail -c 6)"
SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}"
SIGN=$(md5 "$SIGN_INPUT")

echo "▶ Test B — Params in POST BODY (form-encoded)"
echo "  time=$T  signInput=$SIGN_INPUT  sign=$SIGN"
RESP_B=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=registerUser" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "account=${USER}b" \
  --data-urlencode "passwd=${PASSWD_USER}" \
  --data-urlencode "time=${T}" \
  --data-urlencode "sign=${SIGN}")
echo "  Response: $RESP_B"
echo ""
sleep 3

T=$(date +%s)
USER="tst$(echo $T | tail -c 6)"
SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}"
SIGN=$(md5 "$SIGN_INPUT")

echo "▶ Test C — Action in URL + Params in POST BODY"
echo "  time=$T  signInput=$SIGN_INPUT  sign=$SIGN"
RESP_C=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "action=registerUser" \
  --data-urlencode "agentName=${AGENT_NAME}" \
  --data-urlencode "account=${USER}c" \
  --data-urlencode "passwd=${PASSWD_USER}" \
  --data-urlencode "time=${T}" \
  --data-urlencode "sign=${SIGN}")
echo "  Response: $RESP_C"
echo ""
sleep 3

T=$(date +%s)
USER="tst$(echo $T | tail -c 6)"
SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}"
SIGN=$(md5 "$SIGN_INPUT")

echo "▶ Test D — queryInfo (read-only, maybe less restricted)"
SIGN2=$(md5 "${AGENT_LOWER}${T}${KEY_LOWER}")
RESP_D=$(curl -sk -X POST \
  "${API_BASE}/ws/service.ashx?action=queryInfo&agentName=${AGENT_NAME}&account=test01&time=${T}&sign=${SIGN2}" \
  -H "Content-Length: 0")
echo "  Response: $RESP_D"
echo ""

echo "══════════════════════════════════════════"
echo " ⚠ If ALL tests above return Signature error:"
echo "   → Your server IP is NOT whitelisted by Orion."
echo "   → Contact your Orion Stars account manager and"
echo "     give them the IPv4 shown at the top."
echo "══════════════════════════════════════════"
