import { Router } from 'express'
import { body } from 'express-validator'
import { getDeposits, createDeposit, getPaymentMethods, getDeposit, getCryptoCurrencies, getCryptoCoinsForAmount, getCoinMinAmount } from '../controllers/depositController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.get('/', getDeposits)
router.get('/payment-methods', getPaymentMethods)
router.get('/crypto-currencies', getCryptoCurrencies)
router.get('/crypto-coins', getCryptoCoinsForAmount)
router.get('/crypto-min-amount', getCoinMinAmount)
router.get('/:id', getDeposit)
router.post('/',
  [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
    body('paymentMethodId').notEmpty().withMessage('Payment method is required'),
  ],
  validateRequest,
  createDeposit
)

export default router
