import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { generateToken } from '../middleware/auth'
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService'
import { AuthRequest } from '../middleware/auth'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { WalletService } from '../services/WalletService'



// POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, referralCode } = req.body

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

  let referredById = null
  if (referralCode) {
    const referrer = await prisma.user.findFirst({
      where: {
        OR: [
          { referralCode: { equals: referralCode, mode: 'insensitive' } },
          { promoCode: { equals: referralCode, mode: 'insensitive' } }
        ]
      }
    })
    if (referrer) {
      referredById = referrer.id
    }
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      verifyToken,
      referredById,
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

  // Auto-create provider account (async)
  try {
    const providerService = await ProviderFactory.getActiveProvider()
    if (providerService) {
      let newProviderData = null;
      let attempts = 0;
      let currentUsername = username;

      // Wrap in an IIFE to handle the async loop gracefully
      (async () => {
        while (!newProviderData && attempts < 5) {
          attempts++;
          try {
            newProviderData = await providerService.createPlayer(currentUsername, password);
          } catch (err: any) {
            if (err?.message?.includes('Username Already Exists') || err?.message?.includes('Username already exists')) {
              // Generate new username
              const suffix = Math.floor(Math.random() * 9000) + 1000;
              currentUsername = `${username.substring(0, 10)}_${suffix}`;
            } else {
              console.error('Provider player creation failed for user', user.id, err);
              break; // Break on other errors
            }
          }
        }

        if (newProviderData) {
          await prisma.providerUser.create({
            data: {
              userId: user.id,
              providerId: providerService.getProviderId(),
              providerUserId: newProviderData.userId,
              accountName: newProviderData.accountName
            }
          });
        }
      })();
    }
  } catch (e) {
    console.error('Provider fetch error:', e)
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

  // Sync password with provider (async)
  try {
    const providerUser = await prisma.providerUser.findFirst({ where: { userId: user.id } })
    if (providerUser) {
      const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
      if (providerService) {
        providerService.resetPlayerPassword(providerUser.providerUserId, password).catch(err => {
          console.error('Provider password sync failed for user', user.id, err)
        })
      }
    }
  } catch (e) {
    console.error('Provider password sync error:', e)
  }

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

// GET /api/auth/balance
export const getBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const balance = await WalletService.getWalletBalance(req.user!.id);
  res.json({ success: true, data: { balance } });
})

// GET /api/auth/check-username?username=xxx  (public — no auth needed)
export const checkUsername = asyncHandler(async (req: Request, res: Response) => {
  const username = (req.query.username as string || '').trim()

  // Format check first
  if (!username || username.length < 3 || username.length > 20) {
    return res.json({ available: false, reason: 'Username must be 3–20 characters.' })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.json({ available: false, reason: 'Only letters, numbers, and underscores allowed.' })
  }

  // Check our DB
  const existing = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } })
  if (existing) {
    return res.json({ available: false, reason: 'Username already taken on this platform.' })
  }

  // Check game provider (async — best effort; if it fails we still allow registration)
  try {
    const providerService = await ProviderFactory.getActiveProvider()
    if (providerService) {
      await providerService.getPlayerIdByUsername(username)
      // If no error was thrown, the username exists in the game
      return res.json({ available: false, reason: 'Username already registered in the game. Please choose another.' })
    }
  } catch (err: any) {
    // A "User not found" type error from the provider means the username IS free
    const msg = (err?.message || '').toLowerCase()
    const isFreeSignal = msg.includes('not found') || msg.includes('invalid') || msg.includes('user id') || msg.includes('8') // error code 8 = invalid user id
    if (!isFreeSignal) {
      // Provider call failed for unknown reason — allow the registration and let it fail at create time
      console.warn('[checkUsername] Provider check failed non-fatally:', err?.message)
    }
  }

  return res.json({ available: true })
})

