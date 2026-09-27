import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { SESSION_COOKIE, CSRF_COOKIE } from '../utils/authCookies'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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

  const sessionCookie = (req as any).cookies?.[SESSION_COOKIE]
  if (!sessionCookie) return next() // Bearer-header path — not applicable

  const csrfCookie = (req as any).cookies?.[CSRF_COOKIE]
  const csrfHeader = req.headers['x-csrf-token']

  if (!csrfCookie || typeof csrfHeader !== 'string' || !timingSafeEqualStr(csrfCookie, csrfHeader)) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' })
  }
  next()
}
