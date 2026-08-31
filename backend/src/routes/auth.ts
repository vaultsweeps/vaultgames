import { Router } from 'express'
import { body } from 'express-validator'
import { register, login, getMe, verifyEmail, forgotPassword, resetPassword, logout, getBalance, checkUsername, dashboardInit, verifyPhoneOTP, checkPhone } from '../controllers/authController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { authLimiter } from '../middleware/rateLimiter'

const router = Router()

router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-20 chars (letters, numbers, underscores)'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  authLimiter,
  register
)

router.post('/login',
  [
    body('email').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty(),
  ],
  validateRequest,
  authLimiter,
  login
)

router.get('/me', authenticate, getMe)
router.get('/balance', authenticate, getBalance)
router.get('/dashboard-init', authenticate, dashboardInit)
router.get('/check-username', checkUsername)
router.post('/verify-email/:token', verifyEmail)
router.post('/forgot-password', authLimiter, [body('email').isEmail()], validateRequest, forgotPassword)
router.post('/reset-password/:token',
  authLimiter,
  [body('password').isLength({ min: 8 })],
  validateRequest,
  resetPassword
)
import { resendVerification } from '../controllers/resendVerification'

router.post('/resend-verification', authenticate, resendVerification)
router.post('/check-phone',
  [body('phone').notEmpty().withMessage('Phone number is required')],
  validateRequest,
  authLimiter,
  authenticate,
  checkPhone
)
router.post('/verify-otp', authenticate, [body('idToken').notEmpty()], validateRequest, verifyPhoneOTP)
router.post('/logout', authenticate, logout)

export default router
