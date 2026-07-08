import { Router } from 'express'
import { body } from 'express-validator'
import { register, login, getMe, verifyEmail, forgotPassword, resetPassword, logout, getBalance, checkUsername, dashboardInit } from '../controllers/authController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'

const router = Router()

router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-20 chars (letters, numbers, underscores)'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  register
)

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validateRequest,
  login
)

router.get('/me', authenticate, getMe)
router.get('/balance', authenticate, getBalance)
router.get('/dashboard-init', authenticate, dashboardInit)
router.get('/check-username', checkUsername)
router.post('/verify-email/:token', verifyEmail)
router.post('/forgot-password', [body('email').isEmail()], validateRequest, forgotPassword)
router.post('/reset-password/:token',
  [body('password').isLength({ min: 8 })],
  validateRequest,
  resetPassword
)
import { resendVerification } from '../controllers/resendVerification'

router.post('/resend-verification', authenticate, resendVerification)
router.post('/logout', authenticate, logout)

export default router
