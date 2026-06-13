import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { createNotification } from '../services/notificationService'

const prisma = new PrismaClient()

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
  const { amount, paymentMethodId, currency = 'USD' } = req.body

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
      status: 'pending'
    },
    include: { paymentMethod: true }
  })

  // Log transaction
  await prisma.transactionLog.create({
    data: { type: 'deposit_created', entityId: deposit.id, userId: req.user!.id, amount, status: 'pending' }
  })

  // Notify user
  await createNotification(req.user!.id, {
    title: 'Deposit Submitted',
    message: `Your deposit of $${amount} via ${paymentMethod.name} has been submitted and is pending review.`,
    type: 'info',
    link: '/dashboard/deposits'
  })

  res.status(201).json({
    success: true,
    message: 'Deposit request created successfully',
    data: deposit
  })
})

// GET /api/deposits/payment-methods
export const getPaymentMethods = asyncHandler(async (req: AuthRequest, res: Response) => {
  const methods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, type: true, minAmount: true, maxAmount: true, feePercent: true, iconUrl: true, instructions: true, fields: true }
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
