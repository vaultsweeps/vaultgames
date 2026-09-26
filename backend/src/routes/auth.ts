import { Router } from 'express'
import { body } from 'express-validator'
import { register, login, getMe, verifyEmail, forgotPassword, resetPassword, logout, getBalance, checkUsername, dashboardInit, verifyPhoneOTP, checkPhone } from '../controllers/authController'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validate'
import { limit } from '../middleware/security'

const FAILED_LOGIN_MSG = 'Too many failed login attempts. Please wait a few minutes and try again.'
const loginIp = limit({ name: 'login-ip', windowMs: 15 * 60_000, max: 60, scope: 'ip', failedOnly: true, message: FAILED_LOGIN_MSG })
const loginIdentity = limit({ name: 'login-identity', windowMs: 15 * 60_000, max: 10, scope: 'identity', identityField: 'email', failedOnly: true, message: FAILED_LOGIN_MSG })
const registerIp = limit({ name: 'register-ip', windowMs: 60 * 60_000, max: 15, scope: 'ip', message: 'Too many sign-up attempts from this network. Please try again later.' })
const forgotIp = limit({ name: 'forgot-password-ip', windowMs: 60 * 60_000, max: 8, scope: 'ip' })
const forgotIdentity = limit({ name: 'forgot-password-identity', windowMs: 60 * 60_000, max: 3, scope: 'identity', identityField: 'email' })
const tokenActionIp = limit({ name: 'token-actions', windowMs: 60 * 60_000, max: 30, scope: 'ip' })
const lookupIp = limit({ name: 'lookup', windowMs: 60_000, max: 60, scope: 'ip' })

const router = Router()

router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-20 chars (letters, numbers, underscores)'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  registerIp,
  register
)

router.post('/login',
  [
    body('email').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty(),
  ],
  validateRequest,
  loginIp,
  loginIdentity,
  login
)

router.get('/me', authenticate, getMe)
router.get('/balance', authenticate, getBalance)
router.get('/dashboard-init', authenticate, dashboardInit)
router.get('/check-username', lookupIp, checkUsername)
router.post('/verify-email/:token', tokenActionIp, verifyEmail)
router.post('/forgot-password', forgotIp, forgotIdentity, [body('email').isEmail()], validateRequest, forgotPassword)
router.post('/reset-password/:token',
  tokenActionIp,
  [body('password').isLength({ min: 8 })],
  validateRequest,
  resetPassword
)
import { resendVerification } from '../controllers/resendVerification'

router.post('/resend-verification', authenticate, resendVerification)
router.post('/check-phone',
  [body('phone').notEmpty().withMessage('Phone number is required')],
  validateRequest,
  lookupIp,
  authenticate,
  checkPhone
)
router.post('/verify-otp', authenticate, [body('idToken').notEmpty()], validateRequest, verifyPhoneOTP)
router.post('/logout', authenticate, logout)

export default router
