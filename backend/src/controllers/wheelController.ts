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
    if (hoursSinceLastSpin < 48) {
      eligible = false
      nextSpinAt = new Date(lastSpin.createdAt.getTime() + 48 * 60 * 60 * 1000)
      reason = 'You have already spun recently. Come back in 48 hours.'
    }
  }

  // Check deposit requirement (must have deposited >= $25 in last 24 hours)
  if (eligible) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentDeposits = await prisma.deposit.aggregate({
      where: {
        userId,
        status: 'approved',
        createdAt: { gte: twentyFourHoursAgo }
      },
      _sum: { amount: true }
    })
    
    const depositTotal = recentDeposits._sum.amount || 0;
    if (depositTotal < 25) {
      eligible = false;
      reason = 'You must have deposited at least $25 in the last 24 hours to spin the wheel.';
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
      if (hoursSince < 48) {
        const nextSpinAt = new Date(lastSpin.createdAt.getTime() + 48 * 60 * 60 * 1000)
        throw new AppError(`You have already spun recently. Next spin available at ${nextSpinAt.toISOString()}.`, 400)
      }
    }

    // 2.5. Check deposit requirement (must have deposited >= $25 in last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentDeposits = await prisma.deposit.aggregate({
      where: {
        userId,
        status: 'approved',
        createdAt: { gte: twentyFourHoursAgo }
      },
      _sum: { amount: true }
    })
    
    const depositTotal = recentDeposits._sum.amount || 0;
    if (depositTotal < 25) {
      throw new AppError('You must have deposited at least $25 in the last 24 hours to spin the wheel.', 400)
    }

    // 3. Server-side secure random prize selection according to strict patterns
    // Pattern: First 10 spins = Try Again. Then Spin 11 = Win. Then 5 Try Agains, 1 Win, repeating.
    const totalSpins = await prisma.bonusClaim.count({
      where: { userId, bonus: { type: 'wheel' } }
    })

    let isWin = false
    if (totalSpins >= 10) {
      const spinsAfterInitial = totalSpins - 10
      if (spinsAfterInitial % 6 === 0) {
        isWin = true
      }
    }

    let wonPrize;
    if (isWin) {
      // Find a prize that is exactly 1 or 1.5
      const winPrizes = prizes.filter(p => p.amount === 1 || p.amount === 1.5)
      if (winPrizes.length > 0) {
        // Pick one randomly
        const crypto = require('crypto')
        const randomInt = crypto.randomBytes(4).readUInt32BE(0)
        wonPrize = winPrizes[randomInt % winPrizes.length]
      } else {
        // Fallback to Try Again if 1 or 1.5 doesn't exist on the wheel
        const tryAgainPrizes = prizes.filter(p => p.title.toLowerCase().includes('try again') || p.amount === 0)
        wonPrize = tryAgainPrizes.length > 0 ? tryAgainPrizes[0] : prizes[0]
      }
    } else {
      // Find a "Try Again" prize
      const tryAgainPrizes = prizes.filter(p => p.title.toLowerCase().includes('try again') || p.amount === 0)
      if (tryAgainPrizes.length > 0) {
        wonPrize = tryAgainPrizes[0]
      } else {
        // Fallback to the first prize with 0 amount, or just the first prize
        wonPrize = prizes.find(p => p.amount === 0) || prizes[0]
      }
    }

    const winningIndex = prizes.findIndex(p => p.id === wonPrize.id)
    const isTryAgain = wonPrize.amount === 0 || wonPrize.title.toLowerCase().includes('try again')

    let claimId = undefined;

    // 4. Record the claim in a DB transaction ALWAYS to enforce 48h cooldown and count total spins
    const claim = await prisma.bonusClaim.create({
      data: {
        userId,
        bonusId: wonPrize.id,
        amount: wonPrize.amount || 0,
      },
    })
    claimId = claim.id;

    if (!isTryAgain) {
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
