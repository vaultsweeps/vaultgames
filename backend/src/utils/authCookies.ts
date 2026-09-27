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
  // Same lifetime and SameSite/Secure as the session cookie, but httpOnly:false — see the file comment.
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieOptions(maxAgeMs), httpOnly: false })
  return csrfToken
}

export function clearSessionCookies(res: Response) {
  const opts = { path: '/', secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax' }
  res.clearCookie(SESSION_COOKIE, opts)
  res.clearCookie(CSRF_COOKIE, opts)
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
