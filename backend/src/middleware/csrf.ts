import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { SESSION_COOKIE, CSRF_COOKIE } from '../utils/authCookies'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Endpoints that authenticate from a credential in the request BODY or URL (password, email OTP, a mailed
// token) rather than from the `authenticate` middleware trusting an ambient cookie — CSRF protection exists
// to stop a forged request from riding a victim's EXISTING session, which does not apply to any of these:
// they don't use or need the caller's current cookie at all to decide what to do. (Contrast with
// resend-verification/check-phone/verify-otp/logout in routes/auth.ts, which all go through `authenticate`
// and DO rely on the ambient session — those stay protected.) Exempting them also fixes a real lockout: a
// browser holding a stale/expired session cookie (e.g. from before a logout, or from before the cookie-domain
// fix in authCookies.ts shipped) would otherwise get "Invalid or missing CSRF token" on login itself, since
// the stale cookie's mere presence triggered the check below with no way for a fresh login attempt to supply
// a matching pair for a session that doesn't exist yet.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'])
// verify-email/:token and reset-password/:token carry the credential as a URL segment — matched by pattern,
// each anchored with [^/]+ (no slashes) and $ so a path-traversal-style suffix can't slip through as exempt.
const CSRF_EXEMPT_PATTERNS = [/^\/api\/auth\/verify-email\/[^/]+$/, /^\/api\/auth\/reset-password\/[^/]+$/]

export function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.has(path) || CSRF_EXEMPT_PATTERNS.some(p => p.test(path))
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Double-submit CSRF check. Only applies when the request actually carries the session cookie — a request
 * authenticated the old way, via an `Authorization: Bearer` header, has no ambient credential a cross-site
 * page could have made the browser attach automatically, so there is nothing for CSRF to protect there.
 * Runs before `authenticate` (and independent of it): a forged cross-site request is rejected on the
 * mismatched/missing token alone, without spending a JWT verification or DB lookup on it.
 */
export function csrfProtect(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next()
  if (isCsrfExempt(req.path)) return next()

  const sessionCookie = (req as any).cookies?.[SESSION_COOKIE]
  if (!sessionCookie) return next() // Bearer-header path — not applicable

  const csrfCookie = (req as any).cookies?.[CSRF_COOKIE]
  const csrfHeader = req.headers['x-csrf-token']

  if (!csrfCookie || typeof csrfHeader !== 'string' || !timingSafeEqualStr(csrfCookie, csrfHeader)) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' })
  }
  next()
}
