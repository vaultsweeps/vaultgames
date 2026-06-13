import { Router } from 'express'
import { body } from 'express-validator'
import { getWithdrawals, createWithdrawal, getWithdrawal } from '../controllers/withdrawalController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'

const router = Router()
router.use(authenticate)

router.get('/', getWithdrawals)
router.get('/:id', getWithdrawal)
router.post('/',
  [
    body('amount').isFloat({ min: 1 }),
    body('paymentMethodId').notEmpty(),
    body('accountInfo').notEmpty().withMessage('Account info is required'),
  ],
  validateRequest,
  createWithdrawal
)

export default router
