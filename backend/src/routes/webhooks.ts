import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { createNotification } from '../services/notificationService'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { ZappayService } from '../services/payment/ZappayService'
import { TelegramService } from '../services/TelegramService'
import { sendAdminNowPaymentsNotification } from '../services/emailService'

const router = Router()

// Generic webhook handler - verifies signature and processes payment events
router.post('/payment', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string
    const secret = process.env.WEBHOOK_SECRET || ''

    // Verify webhook signature (fail closed if secret isn't configured)
    if (!secret) {
      console.error('WEBHOOK_SECRET is not configured — rejecting webhook request')
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    const expectedBuf = Buffer.from(`sha256=${expected}`)
    const signatureBuf = Buffer.from(signature || '')
    if (
      expectedBuf.length !== signatureBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      return res.status(401).json({ success: false, message: 'Invalid signature' })
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

// NOWPayments IPN signature verification: HMAC-SHA512 over the payload with
// object keys sorted recursively (per NOWPayments IPN docs), compared to the
// `x-nowpayments-sig` header.
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortObjectKeys(obj[key])
        return acc
      }, {})
  }
  return obj
}

function verifyNowPaymentsSignature(payload: any, signature: string | undefined): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET
  if (!secret || !signature) return false

  const sortedPayload = JSON.stringify(sortObjectKeys(payload))
  const expected = crypto.createHmac('sha512', secret).update(sortedPayload).digest('hex')

  const expectedBuf = Buffer.from(expected)
  const signatureBuf = Buffer.from(signature)
  return expectedBuf.length === signatureBuf.length && crypto.timingSafeEqual(expectedBuf, signatureBuf)
}

// Crypto payment webhook (NOWPayments IPN)
router.post('/crypto', async (req: Request, res: Response) => {
  // Log raw webhook immediately so we never lose it
  let webhookLog: any = null
  try {
    webhookLog = await prisma.paymentWebhook.create({
      data: { provider: 'nowpayments', payload: req.body, status: 'received' }
    })
  } catch (logErr) {
    console.error('[NOWPayments Webhook] Failed to create webhook log:', logErr)
  }

  try {
    const signature = req.headers['x-nowpayments-sig'] as string | undefined

    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      console.error('NOWPAYMENTS_IPN_SECRET is not configured — rejecting crypto webhook')
      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'IPN secret not configured' } }).catch(() => {})
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    if (!verifyNowPaymentsSignature(req.body, signature)) {
      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'Invalid signature' } }).catch(() => {})
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }

    const {
      order_id,
      payment_id,
      payment_status,
      price_amount,
      actually_paid,
      pay_currency,
    } = req.body

    console.log(`[NOWPayments IPN] order_id=${order_id} payment_status=${payment_status} payment_id=${payment_id}`)

    const deposit = await prisma.deposit.findFirst({
      where: { paymentReference: order_id },
      include: { user: true }
    })

    if (!deposit) {
      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: `Deposit not found for order_id: ${order_id}` } }).catch(() => {})
      return res.json({ success: true, message: 'Order not found — ignored' })
    }

    // finished / confirmed → approve deposit
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      if (deposit.status !== 'pending') {
        if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: `Deposit already in state: ${deposit.status}` } }).catch(() => {})
        return res.json({ success: true, message: 'Already processed' })
      }

      await prisma.$transaction([
        prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            transactionId: String(payment_id || ''),
            webhookData: req.body
          }
        }),
        prisma.transactionLog.create({
          data: {
            type: 'nowpayments_ipn_confirmed',
            entityId: deposit.id,
            userId: deposit.userId,
            amount: deposit.amount,
            status: 'approved',
            metadata: req.body
          }
        })
      ])

      await createNotification(deposit.userId, {
        title: '₿ Crypto Payment Confirmed!',
        message: `Your crypto deposit of $${deposit.amount} has been confirmed and credited.`,
        type: 'success',
        link: '/dashboard/deposits'
      })

      // Send Telegram notification to admin
      try {
        const adminMsg = `🤑 <b>New Crypto Deposit!</b>\n\n` +
          `👤 User: <code>${deposit.user.username}</code>\n` +
          `💰 Amount: <b>$${deposit.amount}</b>\n` +
          `🪙 Coin: ${pay_currency}\n` +
          `🔗 TX: <code>${payment_id}</code>\n` +
          `✅ Status: Auto-Approved`

        await TelegramService.sendMessage(adminMsg, { parse_mode: 'HTML' })
      } catch (tgErr) {
        console.error('[NOWPayments Webhook] Failed to send Telegram notification:', tgErr)
      }

      // Send Email notification to admin
      try {
        await sendAdminNowPaymentsNotification(deposit.amount, pay_currency || 'Crypto', payment_id.toString())
      } catch (emailErr) {
        console.error('[NOWPayments Webhook] Failed to send Admin Email notification:', emailErr)
      }

      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed' } }).catch(() => {})

    } else if (payment_status === 'failed' || payment_status === 'expired') {
      // Only update if still pending — don't overwrite an already-approved deposit
      if (deposit.status === 'pending') {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'failed', webhookData: req.body }
        })

        await createNotification(deposit.userId, {
          title: '❌ Crypto Payment Failed',
          message: `Your crypto deposit of $${deposit.amount} ${payment_status === 'expired' ? 'expired' : 'failed'}. Please try again.`,
          type: 'error',
          link: '/dashboard/deposits'
        })
      }

      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed' } }).catch(() => {})

    } else if (payment_status === 'partially_paid') {
      // User paid less than required — notify them, keep pending for admin review
      await createNotification(deposit.userId, {
        title: '⚠️ Partial Crypto Payment Received',
        message: `We received a partial crypto payment for your $${deposit.amount} deposit. Please contact support.`,
        type: 'warning',
        link: '/dashboard/deposits'
      })

      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed', error: 'Partial payment — pending admin review' } }).catch(() => {})

    } else {
      // waiting / confirming / sending — informational, no action needed
      if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: `Informational status: ${payment_status}` } }).catch(() => {})
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
