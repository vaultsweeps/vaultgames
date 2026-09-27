import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { createNotification } from '../services/notificationService'
import { WalletService, invalidateWalletCache } from '../services/WalletService'
import { grantDepositBonus } from '../services/DepositBonusService'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { ZappayService } from '../services/payment/ZappayService'
import { GgusOnePayService } from '../services/payment/GgusOnePayService'
import { TelegramService } from '../services/TelegramService'
import { sendAdminNowPaymentsNotification } from '../services/emailService'
import { securityLog } from '../middleware/security'

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

        // Atomic pending -> approved. A replayed callback, or one for a failed/voided deposit, can never re-approve it.
        const claim = await prisma.deposit.updateMany({
          where: { id: deposit.id, status: 'pending' },
          data: { status: 'approved', transactionId, approvedAt: new Date(), webhookData: data }
        })
        if (claim.count !== 1) break

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
        if (!deposit) break

        const failedClaim = await prisma.deposit.updateMany({ where: { id: deposit.id, status: 'pending' }, data: { status: 'failed', webhookData: data } })
        if (failedClaim.count !== 1) break

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
  let webhookLog: any = null

  try {
    const signature = req.headers['x-nowpayments-sig'] as string | undefined

    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      console.error('NOWPAYMENTS_IPN_SECRET is not configured — rejecting crypto webhook')
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    // Unauthenticated callers never cause a database write: verify first, log after.
    if (!verifyNowPaymentsSignature(req.body, signature)) {
      securityLog('webhook_invalid_signature', req, { provider: 'nowpayments' })
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }

    try {
      webhookLog = await prisma.paymentWebhook.create({
        data: { provider: 'nowpayments', payload: req.body, status: 'received' }
      })
    } catch (logErr) {
      console.error('[NOWPayments Webhook] Failed to create webhook log:', logErr)
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

      // The invoice amount reported by the gateway must match what we created (guards against a mismatched/forged order id).
      // NaN-safe: a missing or non-numeric price_amount must not skip the comparison
      if (!(Math.abs(Number(price_amount) - deposit.amount) <= 0.01)) {
        securityLog('webhook_amount_mismatch', req, { provider: 'nowpayments', depositId: deposit.id })
        if (webhookLog) await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'price_amount does not match deposit' } }).catch(() => {})
        return res.status(400).json({ success: false, message: 'Amount mismatch' })
      }

      // FIN-6: Deposit.amount is always the real, confirmed amount — the +20% bonus is granted separately
      // below as its own DepositBonus row (idempotent on depositId), never folded into the deposit itself.
      const realAmount = deposit.amount;

      // Atomic pending -> approved: two concurrent/replayed IPNs cannot both approve.
      const claim = await prisma.deposit.updateMany({
        where: { id: deposit.id, status: 'pending' },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          transactionId: String(payment_id || ''),
          webhookData: req.body
        }
      })
      if (claim.count !== 1) {
        return res.json({ success: true, message: 'Already processed' })
      }
      invalidateWalletCache(deposit.userId)

      const bonusGranted = await grantDepositBonus({ depositId: deposit.id, userId: deposit.userId, amount: realAmount * 0.2, type: 'CRYPTO_DEPOSIT_BONUS' })
      const bonusAmount = bonusGranted ? Math.round(realAmount * 0.2 * 100) / 100 : 0
      const finalAmount = realAmount + bonusAmount // display only — never written to Deposit.amount
      if (bonusGranted) invalidateWalletCache(deposit.userId)

      await prisma.$transaction([
        prisma.transactionLog.create({
          data: {
            type: 'nowpayments_ipn_confirmed',
            entityId: deposit.id,
            userId: deposit.userId,
            amount: realAmount,
            status: 'approved',
            metadata: bonusAmount > 0 ? { ...req.body, bonusAmount, bonusType: 'CRYPTO_DEPOSIT_BONUS' } : req.body
          }
        })
      ])

      await createNotification(deposit.userId, {
        title: '₿ Crypto Payment Confirmed!',
        message: bonusAmount > 0
          ? `Your crypto deposit of $${realAmount.toFixed(2)} has been confirmed, plus a $${bonusAmount.toFixed(2)} bonus — $${finalAmount.toFixed(2)} total credited!`
          : `Your crypto deposit of $${realAmount.toFixed(2)} has been confirmed and credited.`,
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
      const failClaim = await prisma.deposit.updateMany({
        where: { id: deposit.id, status: 'pending' },
        data: { status: 'failed', webhookData: req.body }
      })
      if (failClaim.count === 1) {
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

    // Unauthenticated callers never cause a database write: verify first, log after.
    if (!signature || !ZappayService.verifyWebhookSignature(req.body, signature)) {
      securityLog('webhook_invalid_signature', req, { provider: 'zappay' });
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const webhookLog = await prisma.paymentWebhook.create({
      data: { provider: 'zappay', payload: req.body, status: 'received' }
    });

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

    // Claim the deposit atomically first so a duplicate callback can never recharge the game account twice.
    const zClaim = await prisma.deposit.updateMany({ where: { id: deposit.id, status: 'pending' }, data: { status: 'processing' } });
    if (zClaim.count !== 1) {
      // Being processed right now (or the first attempt may still revert): ask the gateway to retry instead of acking
      const cur = await prisma.deposit.findUnique({ where: { id: deposit.id }, select: { status: true } });
      if (cur?.status === 'processing') return res.status(409).json({ success: false, message: 'Deposit is being processed, retry later' });
      return res.json({ success: true, message: 'Already processed' });
    }

    // Attempt Recharge
    let rechargeResult: any;
    try {
      rechargeResult = await providerService.rechargePlayer(providerUser.providerUserId, deposit.amount, deposit.paymentReference!);
    } catch (rechargeErr) {
      await prisma.deposit.updateMany({ where: { id: deposit.id, status: 'processing' }, data: { status: 'pending' } });
      throw rechargeErr;
    }

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
      data: { provider: 'zappay', payload: req.body, status: 'error', error: String(error?.message || error).slice(0, 500) }
    }).catch(() => {});
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GgusOnePay pay-in (deposit) webhook
// Per API docs §05: gateway POSTs application/x-www-form-urlencoded
// Must return lowercase 'success' — any other response triggers retries at 0/30/60/90/120/150 s
router.post('/ggusonepay', async (req: Request, res: Response) => {
  try {
    const signature = req.body.sign as string;

    // Unauthenticated callers never cause a database write: verify first, log after.
    if (!signature || !GgusOnePayService.verifyWebhookSignature(req.body, signature)) {
      securityLog('webhook_invalid_signature', req, { provider: 'ggusonepay' });
      return res.send('fail');
    }

    const webhookLog = await prisma.paymentWebhook.create({
      data: { provider: 'ggusonepay', payload: req.body, status: 'received' }
    });

    // Coerce state to number — gateway may send string or number
    const mchOrderNo = req.body.mchOrderNo as string;
    const orderNo = req.body.orderNo as string;   // gateway order number
    const state = Number(req.body.state);          // 0=Created 1=InPayment 2=Success 3=Failed 4=Revoked 5=Refunded 6=Closed

    const deposit = await prisma.deposit.findFirst({
      where: { paymentReference: mchOrderNo },
      include: { user: true, paymentMethod: { select: { code: true } } }
    });

    if (deposit) {
      // Only deposits created for this gateway can be settled by this gateway's callback
      if (deposit.paymentMethod?.code?.toLowerCase() !== 'ggusonepay') {
        securityLog('webhook_wrong_method', req, { provider: 'ggusonepay', depositId: deposit.id });
        await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'Deposit is not a GgusOnePay deposit' } });
        return res.send('success');
      }

      // Pay-in order
      if (deposit.status === 'approved') {
        await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: 'Already approved' } });
        return res.send('success');
      }

      // The amount the gateway settled must match what we charged (cents)
      if (req.body.amount !== undefined && Number(req.body.amount) !== Math.round(deposit.amount * 100)) {
        securityLog('webhook_amount_mismatch', req, { provider: 'ggusonepay', depositId: deposit.id });
        await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'failed', error: 'Amount mismatch' } });
        return res.send('success');
      }


      if (state === 2) {
        // Payment Successful — credit the user
        // Wallet-only mode for GgusOnePay (don't push to provider automatically)
        // Credit exactly what was charged. The one intentional round-up is the $9.99 promo minimum -> $10.00
        // (a blanket Math.ceil credited up to +$1 extra per deposit, e.g. $10.01 -> $11).
        const cents = Math.round(deposit.amount * 100);
        const roundedAmount = cents === 999 ? 10 : cents / 100;

        // Atomic pending -> approved: replays, and callbacks for failed/voided deposits, can never approve again.
        const gClaim = await prisma.deposit.updateMany({
          where: { id: deposit.id, status: 'pending' },
          data: { 
            status: 'approved', 
            amount: roundedAmount,
            transactionId: orderNo || '', 
            approvedAt: new Date(), 
            webhookData: req.body 
          }
        });
        if (gClaim.count !== 1) {
          await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: 'Not pending' } });
          return res.send('success');
        }

        invalidateWalletCache(deposit.userId);

        await createNotification(deposit.userId, {
          title: '✅ Deposit Confirmed!',
          message: `Your deposit of $${roundedAmount.toFixed(2)} has been successfully credited to your wallet.`,
          type: 'success',
          link: '/dashboard/deposits'
        });

      } else if (state === 3 || state === 4 || state === 5 || state === 6) {
        // Failed / Revoked / Refunded / Closed
        const gFail = await prisma.deposit.updateMany({
          where: { id: deposit.id, status: 'pending' },
          data: { status: 'failed', webhookData: req.body }
        });
        if (gFail.count === 1) {
          await createNotification(deposit.userId, {
            title: '❌ Deposit Failed',
            message: `Your deposit of $${deposit.amount} could not be processed. Please try again.`,
            type: 'error',
            link: '/dashboard/deposits'
          });
        }
      }
      // states 0, 1 are informational — no action needed
    } else {
      // Not a deposit — check withdrawals
      const withdrawal = await prisma.withdrawal.findFirst({ where: { requestId: mchOrderNo } });
      if (withdrawal) {
        // Atomic + lock the row so staff/admin can no longer flip an already-settled payout (a later reject would refund it)
        if (state === 2) {
          await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), locked: true } });
        } else if (state === 3) {
          await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'pending' }, data: { status: 'rejected', rejectionReason: 'Payout failed at gateway', rejectedAt: new Date(), locked: true } });
        }
      } else {
        await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: 'Order not found' } });
        return res.send('success'); // Ack receipt even if unknown order
      }
    }

    await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed' } });
    res.send('success');
  } catch (error: any) {
    console.error('[GgusOnePay Webhook] Error:', error);
    res.status(500).send('fail');
  }
});

// GgusOnePay transfer (payout) webhook
// Per API docs §08: Asynchronous Transfer Notification — POST {notifyUrl}, application/x-www-form-urlencoded
router.post('/ggusonepay/transfer', async (req: Request, res: Response) => {
  try {
    const signature = req.body.sign as string;

    if (!signature || !GgusOnePayService.verifyWebhookSignature(req.body, signature)) {
      securityLog('webhook_invalid_signature', req, { provider: 'ggusonepay_transfer' });
      return res.send('fail');
    }

    const webhookLog = await prisma.paymentWebhook.create({
      data: { provider: 'ggusonepay_transfer', payload: req.body, status: 'received' }
    });

    const mchOrderNo = req.body.mchOrderNo as string;
    const state = Number(req.body.state); // 0=Created 1=Transferring 2=Successful 3=Failed 4=Cancelled

    const withdrawal = await prisma.withdrawal.findFirst({ where: { requestId: mchOrderNo } });
    if (!withdrawal) {
      await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'ignored', error: 'Withdrawal not found' } });
      return res.send('success');
    }

    if (state === 2) {
      await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), locked: true } })
    } else if (state === 3 || state === 4) {
      await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'pending' }, data: { status: 'rejected', rejectionReason: state === 4 ? 'Transfer cancelled' : 'Transfer failed at gateway', rejectedAt: new Date(), locked: true } })
    }

    await prisma.paymentWebhook.update({ where: { id: webhookLog.id }, data: { status: 'processed' } });
    res.send('success');
  } catch (error: any) {
    console.error('[GgusOnePay Transfer Webhook] Error:', error);
    res.status(500).send('fail');
  }
});

export default router
