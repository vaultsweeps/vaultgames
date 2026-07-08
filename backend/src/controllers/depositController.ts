import { logger } from '../utils/logger'
import { Response } from 'express'
import prisma from '../lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { createNotification } from '../services/notificationService'
import { ZappayService } from '../services/payment/ZappayService'
import { TelegramService } from '../services/TelegramService'
import { TelegramSupportBot } from '../services/TelegramSupportBot'
import { sendAdminZappayNotification } from '../services/emailService'
import { ImapZappayService } from '../services/payment/ImapZappayService'
import { ImapChimePayPalService } from '../services/payment/ImapChimePayPalService'
import { invalidateWalletCache } from '../services/WalletService'


// GET /api/deposits - User's deposits
export const getDeposits = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = { userId: req.user!.id }
  if (status) where.status = status

  const [deposits, total] = await Promise.all([
    prisma.deposit.findMany({
      where, skip, take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { paymentMethod: { select: { name: true, code: true, iconUrl: true } } }
    }),
    prisma.deposit.count({ where })
  ])

  res.json({
    success: true,
    data: deposits,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// POST /api/deposits - Create deposit
export const createDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, paymentMethodId, currency = 'USD', accountName } = req.body

  if (amount < 1) throw new AppError('Minimum deposit amount is $1', 400)

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id: paymentMethodId, isActive: true }
  })
  if (!paymentMethod) throw new AppError('Invalid payment method', 400)
  if (amount < paymentMethod.minAmount) throw new AppError(`Minimum deposit for this method is $${paymentMethod.minAmount}`, 400)
  if (amount > paymentMethod.maxAmount) throw new AppError(`Maximum deposit for this method is $${paymentMethod.maxAmount}`, 400)

  const paymentReference = `DEP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`

  const deposit = await prisma.deposit.create({
    data: {
      userId: req.user!.id,
      amount,
      currency,
      paymentMethodId,
      paymentReference,
      status: 'pending',
      notes: accountName || ''
    },
    include: { paymentMethod: true, user: { select: { id: true, username: true, email: true } } }
  })

  // Log transaction
  await prisma.transactionLog.create({
    data: { type: 'deposit_created', entityId: deposit.id, userId: req.user!.id, amount, status: 'pending' }
  })

  let paymentUrl: string | null = null
  const user = deposit.user
  
  if (paymentMethod.code.toUpperCase() === 'ZAPPAY') {
    // Generate Zappay URL
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/deposits?status=pending`
    paymentUrl = ZappayService.createPaymentRequest(amount, paymentReference, returnUrl)

    // Notify Admin via Email
    sendAdminZappayNotification(amount, accountName, paymentReference).catch(console.error)

    // Trigger instant IMAP check after a short delay
    setTimeout(() => {
      ImapZappayService.parseEmailsAndVerifyDeposits().catch(console.error)
    }, 3000)

    // Also send Telegram notification for Zappay
    try {
      const bot = TelegramSupportBot.getInstance()
      bot.sendDepositNotification(deposit, user).catch((e: any) => logger.error('Telegram notification failed: ' + e.message))
    } catch (e: any) {
      logger.error('[Telegram Deposit Notification Error] ' + (e?.message || e))
    }
  } else if (['chime', 'paypal'].includes(paymentMethod.code.toLowerCase())) {
    // For Chime/PayPal: try auto-verification via IMAP first (30s window)
    // Then fall back to Telegram notification only if email not received
    const depositId = deposit.id

    setTimeout(async () => {
      try {
        // Poll IMAP for up to 30 seconds
        const autoApproved = await ImapChimePayPalService.pollForDeposit(depositId, 30000, 5000)

        if (autoApproved) {
          logger.info(`[DepositController] Deposit ${depositId} auto-approved via email — skipping Telegram`)
          // Notify user of approval
          createNotification(deposit.userId, {
            title: 'Deposit Approved!',
            message: `Your $${amount} ${paymentMethod.name} deposit was automatically verified and credited.`,
            type: 'success',
            link: '/dashboard/deposits'
          }).catch(() => {})
        } else {
          logger.info(`[DepositController] No email match for deposit ${depositId} — sending Telegram`)
          // Send Telegram notification for manual review
          const bot = TelegramSupportBot.getInstance()
          await bot.sendDepositNotification(deposit, user)
        }
      } catch (e: any) {
        logger.error('[Chime/PayPal post-deposit handler] ' + (e?.message || e))
        // Fallback: always send Telegram if something fails
        try {
          const bot = TelegramSupportBot.getInstance()
          bot.sendDepositNotification(deposit, user).catch(() => {})
        } catch {}
      }
    }, 2000) // Start polling 2 seconds after deposit creation
  } else {
    // Other methods — send Telegram notification immediately
    try {
      const bot = TelegramSupportBot.getInstance()
      bot.sendDepositNotification(deposit, user).catch((e: any) => logger.error('Telegram notification failed: ' + e.message))
    } catch (e: any) {
      logger.error('[Telegram Deposit Notification Error] ' + (e?.message || e))
    }
  }

  // Notify user that deposit was submitted
  createNotification(req.user!.id, {
    title: 'Deposit Submitted',
    message: `Your deposit of $${amount} is being processed.`,
    type: 'info',
    link: '/dashboard/deposits'
  }).catch(e => logger.error('Failed to send notification: ' + e.message))

  // Invalidate wallet cache
  invalidateWalletCache(req.user!.id)

  res.status(201).json({
    success: true,
    message: 'Deposit request created successfully',
    data: { ...deposit, paymentUrl }
  })
})

// GET /api/deposits/payment-methods
export const getPaymentMethods = asyncHandler(async (req: AuthRequest, res: Response) => {
  const methods = await prisma.paymentMethod.findMany({
    select: { id: true, name: true, code: true, type: true, minAmount: true, maxAmount: true, feePercent: true, iconUrl: true, instructions: true, fields: true, isActive: true, cashoutEnabled: true }
  })
  res.json({ success: true, data: methods })
})

// GET /api/deposits/:id
export const getDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const deposit = await prisma.deposit.findFirst({
    where: { id: req.params.id as string, userId: req.user!.id },
    include: { paymentMethod: true }
  })
  if (!deposit) throw new AppError('Deposit not found', 404)
  res.json({ success: true, data: deposit })
})



