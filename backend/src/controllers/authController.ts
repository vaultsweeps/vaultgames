import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { generateToken } from '../middleware/auth'
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService'
import { AuthRequest } from '../middleware/auth'

const prisma = new PrismaClient()

// POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body

  // Check existing
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] }
  })
  if (existing) {
    if (existing.email === email) throw new AppError('Email already registered', 409)
    throw new AppError('Username already taken', 409)
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const verifyToken = crypto.randomBytes(32).toString('hex')

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      verifyToken,
      profile: { create: {} }
    },
    select: { id: true, username: true, email: true, role: true, isVerified: true, createdAt: true }
  })

  // Send verification email
  try {
    await sendVerificationEmail(email, username, verifyToken)
  } catch (e) {
    console.error('Email send error:', e)
  }

  res.status(201).json({
    success: true,
    message: 'Account created! Please check your email to verify your account.',
    data: user
  })
})

// POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true }
  })

  if (!user) throw new AppError('Invalid email or password', 401)
  if (!user.isActive) throw new AppError('Account is suspended. Contact support.', 403)
  if (user.isBanned) throw new AppError('Account has been banned.', 403)

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) throw new AppError('Invalid email or password', 401)

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }
  })

  const token = generateToken({ id: user.id, role: user.role, email: user.email })

  const { password: _, verifyToken, resetToken, resetExpiry, ...safeUser } = user

  res.json({
    success: true,
    message: 'Login successful',
    data: { user: safeUser, token }
  })
})

// GET /api/auth/me
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, username: true, email: true, role: true,
      isVerified: true, isActive: true, isBanned: true,
      lastLogin: true, createdAt: true, profile: true
    }
  })

  if (!user) throw new AppError('User not found', 404)
  res.json({ success: true, data: user })
})

// POST /api/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params

  const user = await prisma.user.findFirst({ where: { verifyToken: token as string } })
  if (!user) throw new AppError('Invalid or expired verification link', 400)

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verifyToken: null }
  })

  try { await sendWelcomeEmail(user.email, user.username) } catch {}

  res.json({ success: true, message: 'Email verified successfully! You can now login.' })
})

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body

  const user = await prisma.user.findUnique({ where: { email } })
  // Don't reveal if user exists
  if (!user) {
    return res.json({ success: true, message: 'If that email is registered, you will receive reset instructions.' })
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetExpiry }
  })

  try {
    await sendPasswordResetEmail(email, user.username, resetToken)
  } catch (e) {
    throw new AppError('Failed to send reset email. Please try again.', 500)
  }

  res.json({ success: true, message: 'Password reset instructions sent to your email.' })
})

// POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params
  const { password } = req.body

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token as string,
      resetExpiry: { gt: new Date() }
    }
  })

  if (!user) throw new AppError('Invalid or expired reset link', 400)

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetToken: null, resetExpiry: null }
  })

  res.json({ success: true, message: 'Password reset successfully. You can now login.' })
})

// POST /api/auth/logout
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user?.id) {
    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'logout', ip: req.ip }
    }).catch(() => {})
  }
  res.json({ success: true, message: 'Logged out successfully' })
})
