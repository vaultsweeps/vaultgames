/**
 * Helpers for deciding whether an inbound "payment received" email may be trusted for auto-approval.
 */

/**
 * TLS options for the IMAP connection to imap.gmail.com. Certificate verification stays ON by default —
 * turning it off would let anyone who can MITM the connection (or a misconfigured/compromised network path)
 * forge "payment received" emails and self-approve fraudulent deposits, which is the exact hole this was
 * closed for. If a host's own CA trust store is stale (symptom: DEPTH_ZERO_SELF_SIGNED_CERT against the real
 * imap.gmail.com), fix that host — e.g. `apt-get install --only-upgrade ca-certificates && update-ca-certificates`
 * — rather than disabling verification. IMAP_TLS_INSECURE=1 exists only as a temporary, explicit, opt-in
 * escape hatch while that's being fixed; it must never be the default.
 */
export function imapTlsOptions(): { rejectUnauthorized: boolean } | undefined {
  if (process.env.IMAP_TLS_INSECURE === '1') {
    console.warn('[mailTrust] IMAP_TLS_INSECURE=1 set — IMAP certificate verification is DISABLED. ' +
      'This is a temporary escape hatch only; fix the host CA trust store and unset this.')
    return { rejectUnauthorized: false }
  }
  return undefined
}

/**
 * Domain of an email address, or '' if the address is not a single plain `local@domain`.
 * `From: "x@zappay.com"@evil.example` parses to `x@zappay.com@evil.example`; a naive `split('@')[1]` returns
 * "zappay.com" for it, so the LAST '@' must be used and addresses with more than one '@' are rejected.
 */
export function senderDomain(address: string): string {
  const a = String(address || '').trim().toLowerCase()
  if (!a || /[\s"'<>(),;\\]/.test(a)) return ''
  const first = a.indexOf('@')
  if (first < 1 || first !== a.lastIndexOf('@')) return ''
  return a.slice(first + 1)
}

const googleEntries = (headers: { get(name: string): unknown } | undefined): string[] => {
  const raw = headers?.get('authentication-results')
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  // Only the header added by OUR receiving server (Gmail: authserv-id mx.google.com) is trustworthy — a sender can
  // put any "Authentication-Results: ... dkim=pass" line of their own into a message.
  const authserv = (process.env.IMAP_AUTHSERV || 'mx.google.com').toLowerCase()
  return list.map(String).filter(e => e.trim().toLowerCase().startsWith(authserv))
}

/** True when the receiving server recorded an explicit DKIM or DMARC failure (SPF alone is ignored: forwarding breaks it). */
export function authResultsFailed(headers: { get(name: string): unknown } | undefined): boolean {
  return /\b(dkim|dmarc)=fail\b/i.test(googleEntries(headers).join(' '))
}

/**
 * Strict: the receiving server must have recorded dkim=pass or dmarc=pass and no dmarc=fail. Used for the big
 * domains (chime.com, paypal.com) whose mail is always DKIM-signed. Set IMAP_REQUIRE_AUTH_RESULTS=0 to disable.
 */
export function authResultsOk(headers: { get(name: string): unknown } | undefined): boolean {
  if (process.env.IMAP_REQUIRE_AUTH_RESULTS === '0') return !authResultsFailed(headers)
  const text = googleEntries(headers).join(' ')
  return !/\bdmarc=fail\b/i.test(text) && /\b(dkim|dmarc)=pass\b/i.test(text)
}
