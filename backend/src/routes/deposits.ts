import { Router } from 'express'
import { body } from 'express-validator'
import { getDeposits, createDeposit, getPaymentMethods, getDeposit, getCryptoCurrencies, getCryptoCoinsForAmount, getCoinMinAmount } from '../controllers/depositController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { limit, idempotency } from '../middleware/security'

const router = Router()

router.use(authenticate)

// These fan out to the NOWPayments API (1 + N calls per request): cap them per user so one account cannot exhaust the gateway's rate limit
const cryptoLookup = limit({ name: 'crypto-lookup', windowMs: 60_000, max: 30, scope: 'user' })

router.get('/', getDeposits)
router.get('/payment-methods', getPaymentMethods)
router.get('/crypto-currencies', cryptoLookup, getCryptoCurrencies)
router.get('/crypto-coins', cryptoLookup, getCryptoCoinsForAmount)
router.get('/crypto-min-amount', cryptoLookup, getCoinMinAmount)
router.get('/:id', getDeposit)
router.post('/',
  limit({ name: 'deposit-create', windowMs: 10 * 60_000, max: 20, scope: 'user' }),
  idempotency('deposit'),
  [
    body('amount').isFloat({ min: 1, max: 100000 }).withMessage('Amount must be between $1 and $100,000'),
    body('paymentMethodId').notEmpty().withMessage('Payment method is required'),
  ],
  validateRequest,
  createDeposit
)

export default router
