import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { createNotification } from '../services/notificationService'

const prisma = new PrismaClient()

export const getWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where: any = { userId: req.user!.id }
  if (status) where.status = status

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { paymentMethod: { select: { name: true } } } }),
    prisma.withdrawal.count({ where })
  ])

  res.json({ success: true, data: withdrawals, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } })
})

export const createWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, paymentMethodId, accountInfo, currency = 'USD' } = req.body

  if (amount < 1) throw new AppError('Minimum withdrawal is $1', 400)

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

  res.status(201).json({ success: true, message: 'Withdrawal request submitted', data: withdrawal })
})

export const getWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const withdrawal = await prisma.withdrawal.findFirst({ where: { id: req.params.id as string, userId: req.user!.id }, include: { paymentMethod: true } })
  if (!withdrawal) throw new AppError('Withdrawal not found', 404)
  res.json({ success: true, data: withdrawal })
})
