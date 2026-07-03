import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { createNotification } from '../services/notificationService'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { ZappayService } from '../services/payment/ZappayService'

const router = Router()

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

// Zappay webhook
router.post('/zappay', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-zappay-signature'] as string || req.query.signature as string;
    const { order_id, amount, status, transaction_id } = req.body;

    // Save raw webhook log
    const webhookLog = await prisma.paymentWebhook.create({
      data: { provider: 'zappay', payload: req.body, status: 'received' }
    });

    if (!signature || !ZappayService.verifyWebhookSignature(req.body, signature)) {
      await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'Invalid signature' } });
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    if (status !== 'success' && status !== 'approved') {
      await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: 'Status not approved' } });
      return res.json({ success: true, message: 'Status not approved' });
    }

    const deposit = await prisma.deposit.findFirst({
      where: { paymentReference: order_id },
      include: { user: true }
    });

    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    if (deposit.status === 'approved') {
      return res.json({ success: true, message: 'Already processed' });
    }

    // Call Provider Recharge API
    const providerUser = await prisma.providerUser.findFirst({ where: { userId: deposit.userId } });
    if (!providerUser) {
      return res.status(400).json({ success: false, message: 'User has no provider account' });
    }

    const providerService = await ProviderFactory.getProviderById(providerUser.providerId);
    if (!providerService) {
      return res.status(400).json({ success: false, message: 'Provider not found' });
    }

    // Attempt Recharge
    const rechargeResult = await providerService.rechargePlayer(providerUser.providerUserId, deposit.amount, deposit.paymentReference!);

    // If successful, update local deposit
    await prisma.$transaction([
      prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: 'approved', transactionId: transaction_id || rechargeResult.pay_order_id, approvedAt: new Date() }
      }),
      prisma.providerTransaction.create({
        data: {
          providerId: providerUser.providerId,
          userId: deposit.userId,
          type: 'recharge',
          amount: deposit.amount,
          orderId: deposit.paymentReference!,
          providerOrderId: rechargeResult.pay_order_id,
          status: 'success'
        }
      })
    ]);

    await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed' } });

    await createNotification(deposit.userId, {
      title: '✅ Deposit Confirmed!',
      message: `Your deposit of $${deposit.amount} has been successfully credited to your game account.`,
      type: 'success',
      link: '/dashboard/deposits'
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Zappay Webhook Error:', error);
    await prisma.paymentWebhook.create({
      data: { provider: 'zappay', payload: req.body, status: 'error', error: error.message }
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router
