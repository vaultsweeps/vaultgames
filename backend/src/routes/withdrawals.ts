import { Router } from 'express'
import { body, query } from 'express-validator'
import {
  getWithdrawals,
  createWithdrawal,
  getWithdrawal,
  createManualWithdrawal,
  getEnhancedWithdrawals,
  createEnhancedWithdrawal
} from '../controllers/withdrawalController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { upload } from '../middleware/upload'
import { limit, idempotency, serializePerUser } from '../middleware/security'

const router = Router()

const withdrawLimiter = limit({ name: 'withdraw-create', windowMs: 60 * 60_000, max: 15, scope: 'user' })
router.use(authenticate)

// ─── Enhanced Withdrawal Module ───────────────────────────────────────────
router.get('/enhanced',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
  ],
  validateRequest,
  getEnhancedWithdrawals
)

router.post('/enhanced',
  withdrawLimiter, idempotency('withdraw'), serializePerUser('wallet'),
  [
    body('amount').isFloat({ min: 1, max: 100000 }).withMessage('Amount must be at least $1'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('accountDetails').notEmpty().trim().isLength({ min: 3 }).withMessage('Account details are required (min 3 characters)'),
  ],
  validateRequest,
  createEnhancedWithdrawal
)

// ─── Legacy Withdrawal Routes (untouched) ─────────────────────────────────
router.get('/', getWithdrawals)
router.get('/:id', getWithdrawal)
router.post('/',
  withdrawLimiter, idempotency('withdraw'), serializePerUser('wallet'),
  [
    body('amount').isFloat({ min: 1, max: 100000 }),
    body('paymentMethodId').notEmpty(),
    body('accountInfo').notEmpty().withMessage('Account info is required'),
  ],
  validateRequest,
  createWithdrawal
)
router.post('/manual', withdrawLimiter, idempotency('withdraw'), serializePerUser('wallet'), upload.single('qrCode'), createManualWithdrawal)

export default router
