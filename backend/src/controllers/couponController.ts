import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { invalidateWalletCache } from '../services/WalletService'

export const claimCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.body
  if (!code) throw new AppError('Coupon code is required', 400)
  
  const userId = req.user!.id

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() }
  })

  if (!coupon) throw new AppError('Invalid coupon code', 400)
  if (!coupon.isActive) throw new AppError('Coupon code is inactive', 400)
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Coupon code has expired', 400)
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon code usage limit reached', 400)

  // Check if user already claimed this coupon
  const existingUsage = await prisma.couponUsage.findFirst({
    where: { userId, couponId: coupon.id }
  })
  if (existingUsage) throw new AppError('You have already claimed this coupon', 400)

  // Find or create freeplay bonus definition
  let freeplayBonus = await prisma.bonus.findFirst({ where: { type: 'freeplay' } })
  if (!freeplayBonus) {
    freeplayBonus = await prisma.bonus.create({
      data: {
        title: 'Freeplay Coupon Bonus',
        description: 'Bonus granted from freeplay coupon',
        type: 'freeplay',
        requirements: 'None',
        terms: 'Cannot be cashed out directly.'
      }
    })
  }

  // Apply coupon in a transaction
  await prisma.$transaction(async (tx) => {
    // Re-check lock
    const lockedCoupon = await tx.coupon.findUnique({
      where: { id: coupon.id },
      select: { usedCount: true, usageLimit: true }
    })
    if (lockedCoupon?.usageLimit !== null && (lockedCoupon?.usedCount || 0) >= (lockedCoupon?.usageLimit || 0)) {
      throw new AppError('Coupon code usage limit reached', 400)
    }

    // 1. Create usage
    await tx.couponUsage.create({
      data: {
        userId,
        couponId: coupon.id
      }
    })

    // 2. Increment usage count
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } }
    })

    // 3. Grant freeplay bonus record
    await tx.bonusClaim.create({
      data: {
        userId,
        bonusId: freeplayBonus.id,
        amount: coupon.amount
      }
    })
  })
  
  // Invalidate wallet cache so next balance fetch is fresh
  await invalidateWalletCache(userId)

  res.json({
    success: true,
    message: `Coupon claimed successfully! $${coupon.amount} freeplay added.`,
    data: { amount: coupon.amount }
  })
})
