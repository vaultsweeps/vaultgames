import { Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'

// ─── Helper ─────────────────────────────────────────────────────────────────

function generateCode(prefix: string, username: string): string {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase()
  const clean = username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
  return `${prefix}${clean}${random}`
}

// ─── GET /api/referral/me ────────────────────────────────────────────────────

export const getMyReferralInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  // Ensure user has a referral code; auto-generate if missing
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      referralCode: true,
      promoCode: true,
      referrals: {
        select: {
          id: true,
          username: true,
          createdAt: true,
          deposits: {
            where: { status: 'approved' },
            select: { amount: true },
          },
        },
      },
    },
  })

  if (!user) throw new AppError('User not found', 404)

  // Auto-generate referral code on first access
  if (!user.referralCode) {
    const code = generateCode('VS', user.username)
    user = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: {
        id: true,
        username: true,
        referralCode: true,
        promoCode: true,
        referrals: {
          select: {
            id: true,
            username: true,
            createdAt: true,
            deposits: {
              where: { status: 'approved' },
              select: { amount: true },
            },
          },
        },
      },
    }) as any
  }

  // Build stats
  const totalReferrals = user.referrals.length
  const activeReferrals = user.referrals.filter((r: any) => r.deposits.length > 0).length
  const totalEarnings = user.referrals.reduce((sum: number, r: any) => {
    return sum + r.deposits.reduce((s: number, d: any) => s + d.amount * 0.05, 0) // 5% bonus
  }, 0)

  const referralLink = `https://vaultsweeps.com/register?ref=${user.referralCode}`

  res.json({
    success: true,
    data: {
      referralCode: user.referralCode,
      promoCode: user.promoCode || null,
      referralLink,
      stats: {
        totalReferrals,
        activeReferrals,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      },
      referrals: user.referrals.map((r: any) => ({
        id: r.id,
        username: r.username,
        joinedAt: r.createdAt,
        hasDeposited: r.deposits.length > 0,
        totalDeposited: r.deposits.reduce((s: number, d: any) => s + d.amount, 0),
      })),
    },
  })
})

// ─── POST /api/referral/generate ────────────────────────────────────────────

export const generateReferralCode = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, referralCode: true },
  })

  if (!user) throw new AppError('User not found', 404)

  const code = generateCode('VS', user.username)

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code },
    select: { referralCode: true },
  })

  res.json({
    success: true,
    message: 'Referral code generated successfully',
    data: {
      referralCode: updated.referralCode,
      referralLink: `https://vaultsweeps.com/register?ref=${updated.referralCode}`,
    },
  })
})

// ─── POST /api/referral/promo ────────────────────────────────────────────────

export const setPromoCode = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { promoCode } = req.body

  if (!promoCode || typeof promoCode !== 'string') {
    throw new AppError('Promo code is required', 400)
  }

  // Only allow alphanumeric + hyphens, 4-20 chars
  const clean = promoCode.toUpperCase().trim()
  if (!/^[A-Z0-9\-]{4,20}$/.test(clean)) {
    throw new AppError('Promo code must be 4-20 alphanumeric characters (hyphens allowed)', 400)
  }

  // Check uniqueness (exclude self)
  const existing = await prisma.user.findFirst({
    where: {
      promoCode: clean,
      NOT: { id: userId },
    },
  })

  if (existing) {
    throw new AppError('That promo code is already taken, please choose another', 409)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { promoCode: clean },
    select: { promoCode: true },
  })

  res.json({
    success: true,
    message: 'Promo code set successfully',
    data: { promoCode: updated.promoCode },
  })
})

// ─── GET /api/referral/validate/:code ───────────────────────────────────────

export const validatePromoCode = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.params
  const upper = String(code).toUpperCase().trim()

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ referralCode: upper }, { promoCode: upper }],
    },
    select: { id: true, username: true, referralCode: true, promoCode: true },
  })

  if (!user) {
    return res.json({ success: true, data: { valid: false, message: 'Code not found' } })
  }

  res.json({
    success: true,
    data: {
      valid: true,
      type: user.referralCode === upper ? 'referral' : 'promo',
      owner: user.username,
    },
  })
})
