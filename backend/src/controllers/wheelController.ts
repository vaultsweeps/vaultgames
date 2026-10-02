import { Response } from 'express'
import { Prisma } from '@prisma/client'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { invalidateWalletCache } from '../services/WalletService'
import { BonusLedgerService } from '../services/BonusLedgerService'

// Fast, in-process reject on top of the DB-level guard below (serializePerUser on the route + the
// Serializable transaction here) — this just saves a wasted round trip for the common double-click case.
const spinLocks = new Set<string>()

const WHEEL_COOLDOWN_HOURS = 48
const WHEEL_MIN_DEPOSIT_USD = 25
const WHEEL_DEPOSIT_WINDOW_HOURS = 24

function isSerializationFailure(err: any): boolean {
  return err?.code === 'P2034'
}

/**
 * Sum of successfully-confirmed deposits in the rolling window immediately before `asOf`. Uses `approvedAt`
 * (when the deposit actually became successful) rather than `createdAt` (when it was merely requested), so a
 * deposit that sat pending for days but was just approved counts from the moment it qualifies — matching
 * "successful deposits ... during the rolling 24-hour period", not "requests filed in the last 24 hours".
 * Every approval path in this codebase sets approvedAt, but the OR below tolerates a future one that doesn't.
 */
async function getQualifyingDepositTotal(userId: string, asOf: Date, client: Pick<typeof prisma, 'deposit'> = prisma): Promise<number> {
  const cutoff = new Date(asOf.getTime() - WHEEL_DEPOSIT_WINDOW_HOURS * 60 * 60 * 1000)
  const rows = await client.deposit.findMany({
    where: {
      userId,
      status: 'approved', // pending/failed/cancelled/rejected/reversed/refunded never reach this status
      OR: [
        { approvedAt: { gte: cutoff, lte: asOf } },
        { AND: [{ approvedAt: null }, { createdAt: { gte: cutoff, lte: asOf } }] },
      ],
    },
    select: { amount: true },
  })
  return rows.reduce((sum, d) => sum + d.amount, 0)
}

/** Most recent spin, or null if this user has never spun. */
async function getLastSpin(userId: string, client: Pick<typeof prisma, 'wheelSpin'> = prisma) {
  return client.wheelSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
}

function cooldownStatus(lastSpin: { createdAt: Date } | null, asOf: Date) {
  if (!lastSpin) return { onCooldown: false, nextSpinAt: null as Date | null }
  const nextSpinAt = new Date(lastSpin.createdAt.getTime() + WHEEL_COOLDOWN_HOURS * 60 * 60 * 1000)
  return { onCooldown: asOf < nextSpinAt, nextSpinAt }
}

export const getWheelConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const now = new Date()

  const prizes = await prisma.bonus.findMany({
    where: { type: 'wheel', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!prizes.length) {
    return res.json({ success: true, data: { prizes: [], eligible: false, reason: 'No prizes configured' } })
  }

  const lastSpin = await getLastSpin(userId)
  const { onCooldown, nextSpinAt } = cooldownStatus(lastSpin, now)

  let eligible = true
  let reason = ''

  if (onCooldown) {
    eligible = false
    reason = 'You have already spun recently. Come back in 48 hours.'
  } else {
    const depositTotal = await getQualifyingDepositTotal(userId, now)
    if (depositTotal < WHEEL_MIN_DEPOSIT_USD) {
      eligible = false
      reason = `You must have at least $${WHEEL_MIN_DEPOSIT_USD} in successful deposits in the last ${WHEEL_DEPOSIT_WINDOW_HOURS} hours to spin the wheel.`
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
      nextSpinAt: onCooldown ? nextSpinAt : null,
      reason,
      lastSpinAt: lastSpin?.createdAt || null,
    },
  })
})

export const spinWheel = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  if (spinLocks.has(userId)) {
    return res.status(429).json({ success: false, message: 'A spin is already in progress. Please wait.' })
  }
  spinLocks.add(userId)

  try {
    // Prize catalog is read-only reference data — fine to read before the transaction.
    const prizes = await prisma.bonus.findMany({
      where: { type: 'wheel', isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!prizes.length) throw new AppError('No prizes available on the wheel.', 400)

    let result
    try {
      // Both eligibility conditions are re-checked here, inside a Serializable transaction, at the moment of
      // the actual spin — the getWheelConfig checks above are only a preview for the UI. Serializable makes
      // the read (last spin, recent deposits) and the write (the new WheelSpin row) atomic together: if a
      // second concurrent request for the same user tries the same thing, Postgres aborts one of the two
      // transactions with a serialization failure (P2034) rather than letting both succeed.
      result = await prisma.$transaction(async (tx) => {
        const now = new Date()
        const lastSpin = await getLastSpin(userId, tx)
        const { onCooldown, nextSpinAt } = cooldownStatus(lastSpin, now)
        if (onCooldown) {
          throw new AppError(`You have already spun recently. Next spin available at ${nextSpinAt!.toISOString()}.`, 400)
        }

        const depositTotal = await getQualifyingDepositTotal(userId, now, tx)
        if (depositTotal < WHEEL_MIN_DEPOSIT_USD) {
          throw new AppError(`You must have at least $${WHEEL_MIN_DEPOSIT_USD} in successful deposits in the last ${WHEEL_DEPOSIT_WINDOW_HOURS} hours to spin the wheel.`, 400)
        }

        // Server-side secure random prize selection according to strict patterns
        // Pattern: First 10 spins = Try Again. Then Spin 11 = Win. Then 5 Try Agains, 1 Win, repeating.
        const totalSpins = await tx.wheelSpin.count({ where: { userId } })

        let isWin = false
        if (totalSpins >= 10) {
          const spinsAfterInitial = totalSpins - 10
          if (spinsAfterInitial % 6 === 0) isWin = true
        }

        let wonPrize
        if (isWin) {
          const winPrizes = prizes.filter(p => p.amount === 1 || p.amount === 1.5)
          if (winPrizes.length > 0) {
            const crypto = require('crypto')
            const randomInt = crypto.randomBytes(4).readUInt32BE(0)
            wonPrize = winPrizes[randomInt % winPrizes.length]
          } else {
            const tryAgainPrizes = prizes.filter(p => p.title.toLowerCase().includes('try again') || p.amount === 0)
            wonPrize = tryAgainPrizes.length > 0 ? tryAgainPrizes[0] : prizes[0]
          }
        } else {
          const tryAgainPrizes = prizes.filter(p => p.title.toLowerCase().includes('try again') || p.amount === 0)
          wonPrize = tryAgainPrizes.length > 0 ? tryAgainPrizes[0] : (prizes.find(p => p.amount === 0) || prizes[0])
        }

        const winningIndex = prizes.findIndex(p => p.id === wonPrize.id)
        const isTryAgain = wonPrize.amount === 0 || wonPrize.title.toLowerCase().includes('try again')

        // ALWAYS record a spin — a "Try Again" still consumes the spin and starts the same 48h cooldown,
        // exactly like a win does. This single insert is both the audit/history record and the thing the
        // next eligibility check (this function or getWheelConfig) reads back.
        const spin = await tx.wheelSpin.create({
          data: { userId, bonusId: wonPrize.id, amount: isTryAgain ? 0 : (wonPrize.amount || 0), isWin: !isTryAgain },
        })

        // A real cash win grants Bonus Balance (FREE_SPIN) in the SAME transaction as the WheelSpin row, so
        // a win can never be recorded without also granting the bonus, or vice versa.
        if (!isTryAgain && (wonPrize.amount || 0) > 0) {
          await BonusLedgerService.grantUserBonusTx(tx, {
            userId,
            sourceType: 'FREE_SPIN',
            amount: wonPrize.amount || 0,
            referenceId: spin.id,
          })
        }

        return { wonPrize, winningIndex, isTryAgain, spinId: spin.id }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (err) {
      if (isSerializationFailure(err)) {
        throw new AppError('Another spin request is already in progress. Please try again.', 409)
      }
      throw err
    }

    const { wonPrize, winningIndex, isTryAgain, spinId } = result

    if (!isTryAgain) {
      invalidateWalletCache(userId)
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
        claimId: spinId,
      },
    })
  } finally {
    spinLocks.delete(userId)
  }
})
