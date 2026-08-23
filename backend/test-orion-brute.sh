#!/bin/bash
# ═══════════════════════════════════════════════════════
# Orionstar — Fixed brute-force sign finder
# Sign and time ALWAYS computed together inside each test
# ═══════════════════════════════════════════════════════

API_BASE="https://orionstars.vip:8033"
AGENT_NAME="vaultsweeps45"
AGENT_PASS="***REDACTED***"

md5()  { echo -n "$1" | md5sum | awk '{print $1}'; }
now()  { date +%s; }
nowms(){ echo $(($(date +%s%N)/1000000)); }

PASSWD_MD5=$(md5 "$AGENT_PASS")
PASSWD_USER=$(md5 "Test@1234")
AGENT_LOWER=$(echo -n "$AGENT_NAME" | tr '[:upper:]' '[:lower:]')

echo "══════════════════════════════════════════════"
echo " Orionstar — Fixed Brute Force Sign Finder"
echo "══════════════════════════════════════════════"

# ── Step 1: Login on .ashx ─────────────────────────────
echo ""
echo "▶ Logging in (service.ashx)..."
LOGIN_TIME=$(now)
R=$(curl -sk -X POST "${API_BASE}/ws/service.ashx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${LOGIN_TIME}" -H "Content-Length: 0")
echo "  .ashx response: $R"
KEY_ASHX=$(echo "$R" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$KEY_ASHX" ] && KEY_ASHX=$(echo "$R" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
CODE_ASHX=$(echo "$R" | grep -oP '"code"\s*:\s*"?\K[^",}]+')

echo ""
echo "▶ Logging in (service.aspx)..."
LOGIN_TIME2=$(now)
R2=$(curl -sk -X POST "${API_BASE}/ws/service.aspx?action=agentLogin&agentName=${AGENT_NAME}&agentPasswd=${PASSWD_MD5}&time=${LOGIN_TIME2}" -H "Content-Length: 0")
echo "  .aspx response: $R2"
KEY_ASPX=$(echo "$R2" | grep -oP '"agentkey"\s*:\s*"\K[^"]+')
[ -z "$KEY_ASPX" ] && KEY_ASPX=$(echo "$R2" | grep -oP '"agentKey"\s*:\s*"\K[^"]+')
CODE_ASPX=$(echo "$R2" | grep -oP '"code"\s*:\s*"?\K[^",}]+')

echo ""
echo "  .ashx: code=$CODE_ASHX  key=$KEY_ASHX"
echo "  .aspx: code=$CODE_ASPX  key=$KEY_ASPX"
echo ""

# Use whichever key we got
if [ "$CODE_ASHX" = "200" ] && [ -n "$KEY_ASHX" ]; then
  AGENT_KEY="$KEY_ASHX"
  echo "  Using .ashx agentKey: $AGENT_KEY"
elif [ "$CODE_ASPX" = "200" ] && [ -n "$KEY_ASPX" ]; then
  AGENT_KEY="$KEY_ASPX"
  echo "  Using .aspx agentKey: $AGENT_KEY"
else
  echo "  ❌ Both logins failed"
  exit 1
fi

KEY_LOWER=$(echo -n "$AGENT_KEY" | tr '[:upper:]' '[:lower:]')
KEY_MD5=$(md5 "$KEY_LOWER")

echo ""
echo "▶ Waiting 4 seconds before testing..."
sleep 4
echo ""
echo "▶ Testing — sign and timestamp computed together each time"
echo ""

# ── try_combo: computes SIGN AND TIME together inside ──
try_combo() {
  local label="$1"
  local url_path="$2"
  local use_ms="$3"     # "ms" or "s"
  local formula="$4"    # the formula string, uses $T and $TMS

  # ── Capture time first
  local T=$(now)
  local TMS="${T}000"

  # ── Compute sign using same T/TMS
  local SIGN_INPUT
  case "$formula" in
    "lower_s")    SIGN_INPUT="${AGENT_LOWER}${T}${KEY_LOWER}" ;;
    "asis_s")     SIGN_INPUT="${AGENT_NAME}${T}${AGENT_KEY}" ;;
    "lower_ms")   SIGN_INPUT="${AGENT_LOWER}${TMS}${KEY_LOWER}" ;;
    "asis_ms")    SIGN_INPUT="${AGENT_NAME}${TMS}${AGENT_KEY}" ;;
    "lower_keymd5_s") SIGN_INPUT="${AGENT_LOWER}${T}${KEY_MD5}" ;;
    "lower_pass_s")   SIGN_INPUT="${AGENT_LOWER}${T}${PASSWD_MD5}" ;;
    "lower_loginT_s") SIGN_INPUT="${AGENT_LOWER}${LOGIN_TIME}${KEY_LOWER}" ;;
    "lower_loginT2_s") SIGN_INPUT="${AGENT_LOWER}${LOGIN_TIME2}${KEY_LOWER}" ;;
  esac

  local TIME_PARAM
  if [ "$use_ms" = "ms" ]; then TIME_PARAM="$TMS"; else TIME_PARAM="$T"; fi

  local SIGN=$(md5 "$SIGN_INPUT")
  local USER="ts$(echo $T | tail -c 5)$(echo $formula | head -c 2)"
  local URL="${API_BASE}/ws/${url_path}?action=registerUser&agentName=${AGENT_NAME}&account=${USER}&passwd=${PASSWD_USER}&time=${TIME_PARAM}&sign=${SIGN}"

  local RESP=$(curl -sk -X POST "$URL" -H "Content-Length: 0")
  local MSG=$(echo "$RESP"  | grep -oP '"msg"\s*:\s*"\K[^"]+')
  local RCODE=$(echo "$RESP" | grep -oP '"code"\s*:\s*"?\K[^",}]+')

  printf "  %-55s [%s]\n" "$label" "$url_path"
  printf "    time=%s  signInput=%s\n" "$TIME_PARAM" "$SIGN_INPUT"
  printf "    sign=%s  response=%s\n\n" "$SIGN" "$RESP"

  if [ "$RCODE" = "200" ]; then
    echo "  ╔══════════════════════════════════════════════════╗"
    echo "  ║  ✅✅✅  SUCCESS — FOUND THE WORKING FORMULA    ║"
    echo "  ║  Formula: $formula                              ║"
    echo "  ║  URL:     $url_path                             ║"
    echo "  ╚══════════════════════════════════════════════════╝"
    echo ""
  fi

  sleep 3
}

# All combinations — sign and time ALWAYS in sync
try_combo "lowercase(name+time_s+key)"          "service.ashx" "s"  "lower_s"
try_combo "lowercase(name+time_s+key)"          "service.aspx" "s"  "lower_s"
try_combo "asis(name+time_s+key)"               "service.ashx" "s"  "asis_s"
try_combo "asis(name+time_s+key)"               "service.aspx" "s"  "asis_s"
try_combo "lowercase(name+time_ms+key)"         "service.ashx" "ms" "lower_ms"
try_combo "lowercase(name+time_ms+key)"         "service.aspx" "ms" "lower_ms"
try_combo "asis(name+time_ms+key)"              "service.ashx" "ms" "asis_ms"
try_combo "lowercase(name+time_s+md5(key))"    "service.ashx" "s"  "lower_keymd5_s"
try_combo "lowercase(name+time_s+md5(passwd))" "service.ashx" "s"  "lower_pass_s"
try_combo "lowercase(name+LOGIN_time+key)"      "service.ashx" "s"  "lower_loginT_s"
try_combo "lowercase(name+LOGIN_time2+key)"     "service.ashx" "s"  "lower_loginT2_s"

echo "══════════════════════════════════════════════"
echo " Done — paste full output to Claude"
echo "══════════════════════════════════════════════"
