import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { BonusService } from '../services/BonusService'
import { SundayFreeplayService } from '../services/SundayFreeplayService'

// GET /api/bonuses/balance — authenticated
export const getBonusBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const [bonusBalance, activeBonuses] = await Promise.all([
    BonusService.getBonusBalance(userId),
    BonusService.getActiveUserBonuses(userId),
  ])
  res.json({
    success: true,
    data: {
      bonusBalance,
      activeBonuses: activeBonuses.map((b) => ({
        id: b.id,
        sourceType: b.sourceType,
        originalAmount: b.originalAmount,
        remainingAmount: b.remainingAmount,
        status: b.status,
        expiresAt: b.expiresAt,
        createdAt: b.createdAt,
      })),
    },
  })
})

// GET /api/bonuses/history — authenticated. Bonus transaction ledger + conversion history, newest first.
export const getBonusHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200)

  const [transactions, conversions] = await Promise.all([
    prisma.bonusTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.bonusConversion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ])

  res.json({ success: true, data: { transactions, conversions } })
})

// GET /api/public/bonus-cashout-rules — public, cached. Only active rules, in display-friendly shape.
export const getPublicBonusCashoutRules = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const rules = await prisma.bonusCashoutRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { minAmount: 'asc' }],
    select: { id: true, sourceTypes: true, minAmount: true, maxAmount: true, walletCreditAmount: true, priority: true },
  })
  res.json({ success: true, data: rules })
})

// GET /api/bonuses/sunday-freeplay — authenticated. The customer's own eligibility for this week's Freeplay,
// shown next to the "Text us on Signal" button. Granting happens only via staff (admin endpoint).
export const getSundayFreeplayStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = await SundayFreeplayService.getStatus(req.user!.id)
  res.json({ success: true, data: status })
})
