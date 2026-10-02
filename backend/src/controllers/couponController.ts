import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { invalidateWalletCache } from '../services/WalletService'
import { BonusLedgerService } from '../services/BonusLedgerService'

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

  // Check if user already claimed this coupon (fast path — the DB-level unique constraint on
  // CouponUsage(couponId, userId) is what actually prevents a duplicate no matter how this races)
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

  // The checks above are only a fast path: reading usedCount and later writing it in separate steps (or
  // even re-reading it inside a transaction, which was the previous approach here) does not stop two
  // concurrent claims from both passing the check before either commits — Prisma's default transaction
  // isolation (Read Committed) does not lock the row on a plain read. Same fix as the register-time claim
  // in authController.ts: the counter itself is claimed atomically, with the limit check baked into the
  // UPDATE's WHERE clause, so the database — not application logic racing itself — is what enforces the
  // limit. This is the confirmed root cause of coupons showing e.g. "2/1" used.
  const claimed = await prisma.coupon.updateMany({
    where: coupon.usageLimit !== null ? { id: coupon.id, usedCount: { lt: coupon.usageLimit } } : { id: coupon.id },
    data: { usedCount: { increment: 1 } }
  })
  if (claimed.count !== 1) throw new AppError('Coupon code usage limit reached', 400)

  try {
    await prisma.$transaction(async (tx) => {
      // Guarded by the unique constraint on (couponId, userId): a genuinely simultaneous double-submit by
      // the same user (past the fast-path check above) throws P2002 here rather than granting twice.
      const usage = await tx.couponUsage.create({ data: { userId, couponId: coupon.id } })
      await tx.bonusClaim.create({ data: { userId, bonusId: freeplayBonus.id, amount: coupon.amount } })
      // Additive: the legacy BonusClaim row above stays (existing consumers keep working), and the new Bonus
      // Balance ledger is credited in the SAME transaction so a coupon claim can never grant one without the
      // other.
      await BonusLedgerService.grantUserBonusTx(tx, {
        userId,
        sourceType: 'COUPON',
        amount: coupon.amount,
        referenceId: usage.id,
      })
    })
  } catch (err: any) {
    // Release the slot this request claimed above but couldn't actually use, and surface the same
    // friendly message the fast-path check gives — otherwise a genuine double-submit race would both
    // permanently consume a use of the coupon AND throw a raw 500.
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { decrement: 1 } } }).catch(() => {})
    if (err?.code === 'P2002') throw new AppError('You have already claimed this coupon', 400)
    throw err
  }

  // Invalidate wallet cache so next balance fetch is fresh
  await invalidateWalletCache(userId)

  res.json({
    success: true,
    message: `Coupon claimed successfully! $${coupon.amount} freeplay added.`,
    data: { amount: coupon.amount }
  })
})
