import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { createNotification } from '../services/notificationService'
import { WalletService } from '../services/WalletService'
import { TelegramService } from '../services/TelegramService'
import { logger } from '../utils/logger'

// ─── Allowed payment methods ───────────────────────────────────────────────
const ALLOWED_PAYMENT_METHODS = ['Cash App', 'Venmo', 'Zelle', 'Crypto', 'Bank Transfer', 'Chime', 'PayPal']

// ─── Atomic Request ID generator via PostgreSQL sequence ──────────────────
async function generateRequestId(): Promise<string> {
  const result = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('withdrawal_request_seq')
  `
  return `WD-${result[0].nextval}`
}

// ─── GET /api/withdrawals ─────────────────────────────────────────────────
export const getWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where: any = { userId: req.user!.id }
  if (status) where.status = status

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { paymentMethod: { select: { name: true } } }
    }),
    prisma.withdrawal.count({ where })
  ])

  res.json({
    success: true,
    data: withdrawals,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// ─── POST /api/withdrawals ────────────────────────────────────────────────
export const createWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, paymentMethodId, accountInfo, currency = 'USD' } = req.body

  if (amount < 1) throw new AppError('Minimum withdrawal is $1', 400)

  // Referral bonuses are non-withdrawable — only the real cash balance can be cashed out
  const withdrawableBalance = await WalletService.getWithdrawableBalance(req.user!.id)
  if (amount > withdrawableBalance) {
    const referralBalance = await WalletService.getReferralBonusBalance(req.user!.id)
    if (referralBalance > 0) {
      throw new AppError(
        `Insufficient cashable balance. Your balance includes $${referralBalance.toFixed(2)} in referral bonuses which can only be added to your game balance, not cashed out. Cashable balance: $${Math.max(0, withdrawableBalance).toFixed(2)}`,
        400
      )
    }
    throw new AppError(`Insufficient balance. Your cashable balance is $${Math.max(0, withdrawableBalance).toFixed(2)}`, 400)
  }

  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId, isActive: true } })
  if (!paymentMethod) throw new AppError('Invalid payment method', 400)
  if (amount < paymentMethod.minAmount) throw new AppError(`Minimum withdrawal for this method is $${paymentMethod.minAmount}`, 400)
  if (amount > paymentMethod.maxAmount) throw new AppError(`Maximum withdrawal is $${paymentMethod.maxAmount}`, 400)

  const withdrawal = await prisma.withdrawal.create({
    data: { userId: req.user!.id, amount, currency, paymentMethodId, accountInfo, status: 'pending' },
    include: { paymentMethod: true }
  })

  await createNotification(req.user!.id, {
    title: 'Cashout Submitted',
    message: `Your cashout request of $${amount} has been submitted. We'll process it within 1-24 hours.`,
    type: 'info', link: '/dashboard/cashouts'
  })

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  const username = user?.username || 'Unknown'
  const email = user?.email || req.user!.email || 'Unknown'
  
  TelegramService.sendWithdrawalRequestNotification(username, email, amount, paymentMethod.name, accountInfo).catch(console.error)

  res.status(201).json({ success: true, message: 'Withdrawal request submitted', data: withdrawal })
})

// ─── GET /api/withdrawals/:id ─────────────────────────────────────────────
export const getWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const withdrawal = await prisma.withdrawal.findFirst({
    where: { id: req.params.id as string, userId: req.user!.id },
    include: { paymentMethod: true }
  })
  if (!withdrawal) throw new AppError('Withdrawal not found', 404)
  res.json({ success: true, data: withdrawal })
})

// ─── POST /api/withdrawals/manual ────────────────────────────────────────
export const createManualWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, paymentMethodId, accountInfo } = req.body
  const numAmount = parseFloat(amount)

  if (isNaN(numAmount) || numAmount <= 0) throw new AppError('Invalid amount', 400)

  const balance = await WalletService.getWalletBalance(req.user!.id)
  if (numAmount > balance) throw new AppError('Insufficient wallet balance', 400)

  let methodName = paymentMethodId
  if (paymentMethodId && paymentMethodId.length > 10) {
    const pm = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } })
    if (pm) methodName = pm.name
  } else {
    methodName = paymentMethodId === 'chime' ? 'Chime' : paymentMethodId === 'cashapp' ? 'CashApp' : paymentMethodId
  }

  const requestId = await generateRequestId()

  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId: req.user!.id,
      amount: numAmount,
      currency: 'USD',
      paymentMethodId: paymentMethodId && paymentMethodId.length > 10 ? paymentMethodId : null,
      accountInfo: accountInfo || 'Manual request',
      status: 'pending',
      adminNotes: methodName,
      requestId,
      paymentMethodStr: methodName
    }
  })

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })

  await TelegramService.sendManualCashoutRequest({
    amount: numAmount,
    method: methodName,
    accountInfo: accountInfo || 'Not provided',
    username: user?.username || 'Unknown',
    email: user?.email || 'Unknown',
    qrCodePath: req.file?.path,
    requestId: withdrawal.requestId,
    withdrawalId: withdrawal.id
  })

  res.status(201).json({ success: true, message: 'Request submitted', data: { id: withdrawal.id, requestId: withdrawal.requestId } })
})

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED WITHDRAWAL MODULE
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /api/withdrawals/enhanced ───────────────────────────────────────
export const getEnhancedWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = {
    userId: req.user!.id,
    requestId: { not: null }
  }
  if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
    where.status = status
  }

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestId: true,
        amount: true,
        paymentMethodStr: true,
        accountDetails: true,
        status: true,
        rejectionReason: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    }),
    prisma.withdrawal.count({ where })
  ])

  res.json({
    success: true,
    data: withdrawals,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  })
})

// ─── POST /api/withdrawals/enhanced ──────────────────────────────────────
export const createEnhancedWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, paymentMethod, accountDetails } = req.body
  const numAmount = parseFloat(String(amount))

  // ── Validation ──────────────────────────────────────────────
  if (isNaN(numAmount) || numAmount < 1) {
    throw new AppError('Minimum withdrawal amount is $1', 400)
  }
  if (numAmount > 100000) {
    throw new AppError('Maximum withdrawal amount is $100,000', 400)
  }
  if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError(`Invalid payment method. Allowed: ${ALLOWED_PAYMENT_METHODS.join(', ')}`, 400)
  }
  if (!accountDetails || String(accountDetails).trim().length < 3) {
    throw new AppError('Account details are required (minimum 3 characters)', 400)
  }

  const userId = req.user!.id

  // ── Check user balance ──────────────────────────────────────
  const currentBalance = await WalletService.getWalletBalance(userId)
  if (numAmount > currentBalance) {
    throw new AppError(
      `Insufficient balance. Your current balance is $${currentBalance.toFixed(2)}, but you requested $${numAmount.toFixed(2)}.`,
      400
    )
  }

  // ── Check for pending duplicate (same user + same method + amount within 5 min) ─
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const duplicate = await prisma.withdrawal.findFirst({
    where: {
      userId,
      requestId: { not: null },
      paymentMethodStr: paymentMethod,
      amount: numAmount,
      status: 'pending',
      createdAt: { gte: fiveMinutesAgo }
    }
  })
  if (duplicate) {
    throw new AppError(`Duplicate submission detected. Request ${duplicate.requestId} is already pending.`, 409)
  }

  // ── Generate atomic Request ID ──────────────────────────────
  const requestId = await generateRequestId()

  // ── Create withdrawal record ────────────────────────────────
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId,
      amount: numAmount,
      currency: 'USD',
      accountInfo: String(accountDetails).trim(),
      status: 'pending',
      locked: false,
      requestId,
      paymentMethodStr: paymentMethod,
      accountDetails: String(accountDetails).trim(),
    }
  })

  // ── Fetch user info for notifications ──────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true }
  })

  // ── Log creation to TransactionLog ─────────────────────────
  await prisma.transactionLog.create({
    data: {
      type: 'withdrawal_created',
      entityId: withdrawal.id,
      userId,
      amount: numAmount,
      status: 'pending',
      metadata: { requestId, paymentMethod, accountDetails: String(accountDetails).trim() }
    }
  }).catch(e => logger.error('Failed to create TransactionLog for withdrawal:', e))

  // ── Create in-app notification ──────────────────────────────
  await createNotification(userId, {
    title: '📤 Withdrawal Submitted',
    message: `Your withdrawal request ${requestId} for $${numAmount.toFixed(2)} via ${paymentMethod} has been submitted and is pending review.`,
    type: 'info',
    link: '/dashboard/withdrawals'
  })

  // ── Send Telegram notification (non-blocking) ────────────────
  const bot = await import('../services/TelegramSupportBot').then(m => m.TelegramSupportBot.getInstance())
  bot.sendWithdrawalNotification(withdrawal, user).catch(e =>
    logger.error(`Telegram notification failed for ${requestId}:`, e)
  )

  logger.info(`Withdrawal created: ${requestId} by user ${userId} for $${numAmount}`)

  res.status(201).json({
    success: true,
    message: `Withdrawal request ${requestId} submitted successfully`,
    data: {
      id: withdrawal.id,
      requestId: withdrawal.requestId,
      amount: withdrawal.amount,
      paymentMethodStr: withdrawal.paymentMethodStr,
      accountDetails: withdrawal.accountDetails,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt
    }
  })
})
