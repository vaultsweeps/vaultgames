import { Request, Response } from 'express'
import crypto from 'crypto'

/**
 * Two-cookie session model, replacing the plain JS-readable JWT cookie:
 *  - `vaultsweeps_session`: the JWT itself, HttpOnly (invisible to page JavaScript, so an XSS bug can no
 *    longer read and exfiltrate it — the risk AUTH-12/FE-2 flagged).
 *  - `vaultsweeps_csrf`: a random value, deliberately NOT HttpOnly — the double-submit CSRF pattern in
 *    middleware/csrf.ts relies on legitimate frontend JS being ABLE to read this one and echo it back as a
 *    header; a cross-site attacker page cannot read it (Same-Origin Policy), so it can't forge that header.
 *
 * Frontend/backend are cross-origin (Vercel vs Render) today, so a cookie set by the API only reaches the
 * browser's automatic "send with every request" behaviour with SameSite=None — Lax/Strict are simply never
 * sent cross-site at all. SameSite=None requires Secure, so both are non-negotiable in production; outside
 * production (same-machine http dev) SameSite=Lax + non-Secure is used instead, matching how dev actually runs.
 */
const isProd = process.env.NODE_ENV === 'production'

export const SESSION_COOKIE = 'vaultsweeps_session'
export const CSRF_COOKIE = 'vaultsweeps_csrf'

// The CSRF cookie must be readable via `document.cookie` by frontend JS (frontend/src/lib/api.ts echoes it
// back as the X-CSRF-Token header — that's the whole double-submit design) — but it's set by a response
// from the API's own (sub)domain, a DIFFERENT origin from the frontend page reading it. With no explicit
// Domain attribute a cookie defaults to host-only (visible only to the exact host that set it), which
// `document.cookie` on the frontend's origin can never see, so the header was never actually sent and
// csrfProtect rejected every non-GET request once the primary cookie session was in play — not a Safari/ITP
// edge case, the common case. Scoping it to the shared parent domain fixes that. The session cookie itself
// stays host-only (kept narrower on purpose): only the backend ever needs to receive it, and it's HttpOnly
// regardless, so widening its scope would add no capability, only a marginally larger blast radius.
// COOKIE_DOMAIN lets this be overridden without a code change if the production domain ever changes.
const COOKIE_ROOT_DOMAIN = process.env.COOKIE_DOMAIN || (isProd ? '.vaultsweeps.com' : undefined)

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeMs,
  }
}

/** Sets the session + CSRF cookies after a successful login. `maxAgeMs` must match the JWT's own expiry
 *  (12h for admin, 7d otherwise) so the cookie never outlives — or expires before — the token it carries. */
export function setSessionCookies(res: Response, token: string, maxAgeMs: number): string {
  const csrfToken = crypto.randomBytes(32).toString('hex')
  res.cookie(SESSION_COOKIE, token, cookieOptions(maxAgeMs))
  // Same lifetime and SameSite/Secure as the session cookie, but httpOnly:false and domain-scoped so the
  // frontend can actually read it — see the file comment above.
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions(maxAgeMs), httpOnly: false, domain: COOKIE_ROOT_DOMAIN })
  return csrfToken
}

export function clearSessionCookies(res: Response) {
  const opts = { path: '/', secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax' }
  res.clearCookie(SESSION_COOKIE, opts)
  // Must match the domain it was SET with (browsers key cookies by name+domain+path), or the real cookie
  // in the browser is left behind uncleared after logout.
  res.clearCookie(CSRF_COOKIE, { ...opts, domain: COOKIE_ROOT_DOMAIN })
}

/** The JWT from the cookie if present, else the legacy `Authorization: Bearer` header (used by clients where
 *  the cookie never lands — see middleware/auth.ts's fallback note — and by non-browser API callers). */
export function extractToken(req: Request): string | null {
  const cookieToken = (req as any).cookies?.[SESSION_COOKIE]
  if (cookieToken) return cookieToken
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return null
}
