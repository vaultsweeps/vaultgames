import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string }
}

// ─── In-memory auth cache (30-second TTL) ────────────────────────────────────
// Prevents repeated DB lookups for the same user when multiple parallel API
// calls arrive in the same short window (e.g. 3 parallel fetches on page load).
type CachedAuthUser = { id: string; role: string; email: string; isActive: boolean; isBanned: boolean; expiresAt: number }
const authCache = new Map<string, CachedAuthUser>()
const AUTH_CACHE_TTL = 30_000 // 30 seconds

function getCachedAuthUser(id: string): CachedAuthUser | null {
  const cached = authCache.get(id)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) { authCache.delete(id); return null }
  return cached
}

function setCachedAuthUser(user: { id: string; role: string; email: string; isActive: boolean; isBanned: boolean }) {
  authCache.set(user.id, { ...user, expiresAt: Date.now() + AUTH_CACHE_TTL })
}

// Evict user from auth cache (call after banning/suspending a user)
export function evictAuthCache(userId: string) {
  authCache.delete(userId)
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; email: string }

    // Layer 1: in-memory cache — avoids DB on repeated requests within 30s
    let user = getCachedAuthUser(decoded.id)

    if (!user) {
      // Layer 2: DB lookup (only when cache is cold)
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, email: true, isActive: true, isBanned: true }
      })
      if (!dbUser) return res.status(401).json({ success: false, message: 'User not found' })
      setCachedAuthUser(dbUser)
      user = getCachedAuthUser(decoded.id)!
    }

    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is suspended' })
    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account is banned' })

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
    return res.status(403).json({ success: false, message: 'Admin access required' })
  }
  next()
}

export const generateToken = (payload: { id: string; role: string; email: string }, expiresIn = '7d'): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as any)
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' } as any)
}
