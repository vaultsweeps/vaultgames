import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { limit, idempotency, serializePerUser, parseMoney } from '../middleware/security'
import { Request, Response, NextFunction } from 'express'
import { createProviderAccount, getProviderAccount, resetProviderPassword, getProviderTransactions, transferFunds, getAllProviderAccounts } from '../controllers/providerController'

const router = Router()

const transferLimiter = limit({ name: 'transfer', windowMs: 60_000, max: 15, scope: 'user' })
const accountLimiter = limit({ name: 'provider-account', windowMs: 60 * 60_000, max: 20, scope: 'user' })

// Server-side validation of everything the browser sends for a money movement.
function validateTransfer(req: Request, res: Response, next: NextFunction) {
  const b = req.body
  const amount = parseMoney(b?.amount)
  const okGame = typeof b?.gameId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(b.gameId)
  const okType = b?.type === 'recharge' || b?.type === 'withdraw'
  if (!b || typeof b !== 'object' || amount === null || !okGame || !okType) {
    return res.status(400).json({ success: false, message: 'Invalid transfer parameters' })
  }
  req.body.amount = amount
  next()
}

router.use(authenticate)

router.post('/create-account', accountLimiter, createProviderAccount)
router.get('/account', getProviderAccount)
router.post('/reset-password', accountLimiter, resetProviderPassword)
router.get('/transactions', getProviderTransactions)
// Order matters: limit -> validate -> replay guard -> one wallet operation per user at a time
router.post('/transfer', transferLimiter, validateTransfer, idempotency('transfer'), serializePerUser('wallet'), transferFunds)
router.get('/accounts', getAllProviderAccounts)

export default router
