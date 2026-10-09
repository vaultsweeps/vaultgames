import prisma from '../lib/prisma'
import { AppError } from '../middleware/errorHandler'
import { invalidateWalletCache, BONUS_BALANCE_CUTOVER_AT } from './WalletService'
import { BonusLedgerService } from './BonusLedgerService'
import { createNotification } from './notificationService'
import { takePendingCoupon } from '../lib/redis'
import { logger } from '../utils/logger'

/**
 * Redeems a freeplay coupon for a user. The single place coupons are redeemed (the "Redeem coupon" box and the
 * automatic redemption of a code entered at sign-up both go through here).
 *
 * A coupon can only be used by an account with BOTH its email and its phone number verified. Phone verification is
 * unique per person (one verified phone number cannot sit on two accounts), so creating new accounts to use a coupon
 * again does not work.
 */
export async function redeemCoupon(userId: string, rawCode: string): Promise<{ amount: number }> {
  const code = String(rawCode || '').trim()
  if (!code) throw new AppError('Coupon code is required', 400)

  const account = await prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true, isPhoneVerified: true } })
  if (!account) throw new AppError('User not found', 404)
  if (!account.isVerified || !account.isPhoneVerified) {
    const missing = [!account.isVerified && 'email address', !account.isPhoneVerified && 'phone number'].filter(Boolean).join(' and ')
    throw new AppError(`Please verify your ${missing} to use a coupon.`, 403)
  }

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
      // Legacy BonusClaim ledger — maintained ONLY for claims happening before the Bonus Balance cutover.
      // EVERY coupon shares this same single "freeplay" Bonus definition row per user, so upserting into it
      // past the cutover would be wrong in a subtler way than a bare create(): Prisma's `update` never
      // touches an existing row's `createdAt`, so for any account whose row was first created BEFORE the
      // cutover, every later increment — even ones happening long after the cutover — would keep re-landing
      // under that frozen pre-cutover `createdAt` and so keep passing WalletService's `createdAt < CUTOVER`
      // filter forever, double-counting every future coupon claim into Wallet Balance indefinitely. Once
      // past the cutover there is no reason to touch this table at all — only the new UserBonus ledger below
      // is the source of truth for a post-cutover grant.
      if (new Date() < BONUS_BALANCE_CUTOVER_AT) {
        await tx.bonusClaim.upsert({
          where: { userId_bonusId: { userId, bonusId: freeplayBonus.id } },
          create: { userId, bonusId: freeplayBonus.id, amount: coupon.amount },
          update: { amount: { increment: coupon.amount } },
        })
      }
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

  return { amount: coupon.amount }
}

/**
 * A coupon entered at sign-up is remembered (it cannot be used yet — the account isn't verified) and redeemed here as
 * soon as the account becomes fully verified. Call it right after email or phone verification completes. Never throws:
 * the player is told by notification either way, and can still use the code by hand from the site.
 */
export async function redeemPendingCoupon(userId: string): Promise<void> {
  try {
    const code = await takePendingCoupon(userId)
    if (!code) return
    try {
      const { amount } = await redeemCoupon(userId, code)
      await createNotification(userId, {
        title: '🎟️ Coupon redeemed!',
        message: `Your coupon ${code} has been applied — $${amount} freeplay was added to your Bonus Balance.`,
        type: 'success',
        link: '/dashboard/bonuses',
      })
    } catch (err: any) {
      await createNotification(userId, {
        title: 'Coupon could not be applied',
        message: `Your coupon ${code} could not be redeemed: ${err?.message || 'unknown error'}.`,
        type: 'warning',
        link: '/dashboard/bonuses',
      })
    }
  } catch (e) {
    logger.error('[CouponService] redeemPendingCoupon failed', e)
  }
}
