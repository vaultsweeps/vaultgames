import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { createNotification } from '../services/notificationService'

const router = Router()
const prisma = new PrismaClient()

// Generic webhook handler - verifies signature and processes payment events
router.post('/payment', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string
    const secret = process.env.WEBHOOK_SECRET || ''

    // Verify webhook signature
    if (secret) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex')

      if (signature !== `sha256=${expected}`) {
        return res.status(401).json({ success: false, message: 'Invalid signature' })
      }
    }

    const { event, data } = req.body

    switch (event) {
      case 'payment.completed': {
        const { reference, transactionId, amount } = data

        const deposit = await prisma.deposit.findFirst({
          where: { paymentReference: reference },
          include: { user: true }
        })

        if (!deposit) break
        if (deposit.status === 'approved') break // Already processed

        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'approved', transactionId, approvedAt: new Date(), webhookData: data }
        })

        await createNotification(deposit.userId, {
          title: '✅ Deposit Confirmed!',
          message: `Your deposit of $${deposit.amount} has been confirmed automatically.`,
          type: 'success',
          link: '/dashboard/deposits'
        })

        await prisma.transactionLog.create({
          data: { type: 'webhook_payment_completed', entityId: deposit.id, userId: deposit.userId, amount: deposit.amount, status: 'approved', metadata: data }
        })
        break
      }

      case 'payment.failed': {
        const { reference } = data
        const deposit = await prisma.deposit.findFirst({ where: { paymentReference: reference } })
        if (!deposit || deposit.status !== 'pending') break

        await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'failed', webhookData: data } })

        await createNotification(deposit.userId, {
          title: 'Payment Failed',
          message: `Your deposit of $${deposit.amount} could not be processed. Please try again.`,
          type: 'error',
          link: '/dashboard/deposits'
        })
        break
      }

      default:
        console.log(`Unhandled webhook event: ${event}`)
    }

    res.json({ success: true, received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ success: false, message: 'Webhook processing error' })
  }
})

// Crypto payment webhook (e.g. Coinbase Commerce, NOWPayments)
router.post('/crypto', async (req: Request, res: Response) => {
  try {
    const { order_id, payment_status, pay_amount, price_amount, actually_paid } = req.body

    // NOWPayments example
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      const deposit = await prisma.deposit.findFirst({ where: { paymentReference: order_id } })
      if (deposit && deposit.status === 'pending') {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'approved', approvedAt: new Date(), webhookData: req.body }
        })

        await createNotification(deposit.userId, {
          title: '₿ Crypto Payment Confirmed!',
          message: `Your crypto deposit of $${deposit.amount} has been confirmed.`,
          type: 'success',
          link: '/dashboard/deposits'
        })
      }
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false })
  }
})

export default router
