import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string }
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; email: string }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true, isActive: true, isBanned: true }
    })

    if (!user) return res.status(401).json({ success: false, message: 'User not found' })
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
