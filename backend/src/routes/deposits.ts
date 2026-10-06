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
    body('amount').isFloat({ min: 1, max: 100000 }).withMessage('Amount must be between $1 and $100,000').toFloat(),
    body('paymentMethodId').isString().withMessage('Payment method is required').bail().trim().notEmpty().withMessage('Payment method is required').isLength({ max: 64 }),
    // The sender name goes into the plain-text Telegram deposit alert — one line, no control characters
    body('accountName').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 100 }).withMessage('Name is too long')
      // eslint-disable-next-line no-control-regex
      .custom(v => !/[\u0000-\u001F\u007F]/.test(v)).withMessage('Name contains invalid characters'),
  ],
  validateRequest,
  createDeposit
)

export default router
