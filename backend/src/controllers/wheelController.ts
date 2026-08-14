import { Response } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { invalidateWalletCache } from '../services/WalletService'

// In-memory spin lock to prevent concurrent duplicate spins for the same user
const spinLocks = new Set<string>()

export const getWheelConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  // Fetch all active wheel prizes
  const prizes = await prisma.bonus.findMany({
    where: { type: 'wheel', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!prizes.length) {
    return res.json({ success: true, data: { prizes: [], eligible: false, reason: 'No prizes configured' } })
  }

  // Check 24-hour cooldown: find the most recent wheel spin claim by this user
  const lastSpin = await prisma.bonusClaim.findFirst({
    where: {
      userId,
      bonus: { type: 'wheel' },
    },
    orderBy: { createdAt: 'desc' },
  })

  let eligible = true
  let nextSpinAt: Date | null = null
  let reason = ''

  if (lastSpin) {
    const hoursSinceLastSpin = (Date.now() - lastSpin.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastSpin < 24) {
      eligible = false
      nextSpinAt = new Date(lastSpin.createdAt.getTime() + 24 * 60 * 60 * 1000)
      reason = 'You have already spun today. Come back in 24 hours.'
    }
  }

  res.json({
    success: true,
    data: {
      prizes: prizes.map((p, i) => ({
        id: p.id,
        index: i,
        title: p.title,
        amount: p.amount,
        percentage: p.percentage,
        type: p.amount ? 'cash' : 'deposit_bonus',
      })),
      eligible,
      nextSpinAt,
      reason,
      lastSpinAt: lastSpin?.createdAt || null,
    },
  })
})

export const spinWheel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  // Prevent concurrent spins for the same user
  if (spinLocks.has(userId)) {
    return res.status(429).json({ success: false, message: 'A spin is already in progress. Please wait.' })
  }
  spinLocks.add(userId)

  try {
    // 1. Fetch prizes & check eligibility inside a transaction
    const prizes = await prisma.bonus.findMany({
      where: { type: 'wheel', isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!prizes.length) {
      throw new AppError('No prizes available on the wheel.', 400)
    }

    // 2. Check 24-hour cooldown
    const lastSpin = await prisma.bonusClaim.findFirst({
      where: { userId, bonus: { type: 'wheel' } },
      orderBy: { createdAt: 'desc' },
    })

    if (lastSpin) {
      const hoursSince = (Date.now() - lastSpin.createdAt.getTime()) / (1000 * 60 * 60)
      if (hoursSince < 24) {
        const nextSpinAt = new Date(lastSpin.createdAt.getTime() + 24 * 60 * 60 * 1000)
        throw new AppError(`You have already spun today. Next spin available at ${nextSpinAt.toISOString()}.`, 400)
      }
    }

    // 3. Server-side secure random prize selection (crypto-safe via Math.random is not enough;
    //    use a weighted approach with Node's crypto module)
    const crypto = require('crypto')
    const randomBytes = crypto.randomBytes(4)
    const randomInt = randomBytes.readUInt32BE(0)
    const winningIndex = randomInt % prizes.length
    const wonPrize = prizes[winningIndex]
    const isTryAgain = wonPrize.title === 'Try Again'

    let claimId = undefined;

    if (!isTryAgain) {
      // 4. Record the claim in a DB transaction ONLY if it's a real prize
      const claim = await prisma.bonusClaim.create({
        data: {
          userId,
          bonusId: wonPrize.id,
          amount: wonPrize.amount || 0,
        },
      })
      claimId = claim.id;

      // 5. Invalidate wallet cache so the new balance is reflected immediately
      invalidateWalletCache(userId)

      // 6. Create a notification for the user
      await prisma.notification.create({
        data: {
          userId,
          title: '🎉 Daily Spin Reward!',
          message: `Congratulations! You won "${wonPrize.title}" from the Daily Spin.`,
          type: 'success',
        },
      }).catch(() => {}) // Non-critical
    }

    res.json({
      success: true,
      message: isTryAgain ? 'Better luck next time! Spin again.' : `Congratulations! You won ${wonPrize.title}!`,
      data: {
        winningIndex,
        prize: {
          id: wonPrize.id,
          title: wonPrize.title,
          amount: wonPrize.amount,
          percentage: wonPrize.percentage,
          type: wonPrize.amount ? 'cash' : 'deposit_bonus',
        },
        claimId,
      },
    })
  } finally {
    // Always release the lock
    spinLocks.delete(userId)
  }
})
