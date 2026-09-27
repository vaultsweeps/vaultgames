import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma';
import { getTokensRevokedBefore } from '../lib/redis';
import { extractToken } from '../utils/authCookies';
import { securityLog } from './security';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string }
}

// ─── In-memory auth cache (30-second TTL) ────────────────────────────────────
// Prevents repeated DB lookups for the same user when multiple parallel API
// calls arrive in the same short window (e.g. 3 parallel fetches on page load).
type CachedAuthUser = { id: string; role: string; email: string; isActive: boolean; isBanned: boolean; revokedBefore: number | null; tokenVersion: number; expiresAt: number }
const authCache = new Map<string, CachedAuthUser>()
const AUTH_CACHE_TTL = 30_000 // 30 seconds

function getCachedAuthUser(id: string): CachedAuthUser | null {
  const cached = authCache.get(id)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) { authCache.delete(id); return null }
  return cached
}

function setCachedAuthUser(user: { id: string; role: string; email: string; isActive: boolean; isBanned: boolean; revokedBefore: number | null; tokenVersion: number }) {
  authCache.set(user.id, { ...user, expiresAt: Date.now() + AUTH_CACHE_TTL })
}

// Evict user from auth cache (call after banning/suspending a user, logout, or password change)
export function evictAuthCache(userId: string) {
  authCache.delete(userId)
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // The HttpOnly session cookie is the primary path; the Authorization header is kept as a fallback for
    // browsers where the cross-origin cookie doesn't land (Safari/ITP and similar) — see authCookies.ts.
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as { id: string; role: string; email: string; iat: number; tokenVersion?: number }

    // Layer 1: in-memory cache — avoids DB on repeated requests within 30s
    let user = getCachedAuthUser(decoded.id)

    if (!user) {
      // Layer 2: DB + revocation-record lookup (only when cache is cold)
      const [dbUser, revokedBefore] = await Promise.all([
        prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, role: true, email: true, isActive: true, isBanned: true, tokenVersion: true }
        }),
        getTokensRevokedBefore(decoded.id)
      ])
      if (!dbUser) return res.status(401).json({ success: false, message: 'User not found' })
      setCachedAuthUser({ ...dbUser, revokedBefore })
      user = getCachedAuthUser(decoded.id)!
    }

    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is suspended' })
    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account is banned' })

    // Durable check, independent of Redis: a token signed before the account's tokenVersion was last bumped
    // (logout, password reset/change, ban/suspend) is rejected even if Redis is down, unreachable, or was
    // never configured — the `revoked_before` check below is only a faster path on top of this one. Tokens
    // signed before this field existed carry no claim; treat that as version 0, which matches every
    // pre-existing account's default and keeps them logged in across this deploy.
    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: 'Session expired, please login again' })
    }

    // Fast path only: when Redis IS reachable this catches a revocation within the same 30s cache window
    // that a cold-cache tokenVersion check would also catch, just slightly sooner. Its absence or failure
    // never weakens security — see the tokenVersion check above.
    if (user.revokedBefore && decoded.iat * 1000 < user.revokedBefore) {
      return res.status(401).json({ success: false, message: 'Session expired, please login again' })
    }

    req.user = { id: user.id, role: user.role, email: user.email }
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, message: 'Token expired, please login again' })
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token' })
  }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    securityLog('admin_access_denied', req)
    return res.status(403).json({ success: false, message: 'Admin access required' })
  }
  next()
}

export const generateToken = (payload: { id: string; role: string; email: string; tokenVersion?: number }, expiresIn = '7d'): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as any)
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' } as any)
}
