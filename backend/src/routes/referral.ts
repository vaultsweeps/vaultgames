import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { limit } from '../middleware/security'
import {
  getMyReferralInfo,
  generateReferralCode,
  setPromoCode,
  validatePromoCode,
} from '../controllers/referralController'

const router = Router()

router.use(authenticate)

// GET  /api/referral/me  - get my referral code, promo code, stats
router.get('/me', getMyReferralInfo)

// POST /api/referral/generate - generate a new referral code
router.post('/generate', limit({ name: 'referral-write', windowMs: 60 * 60_000, max: 30, scope: 'user' }), generateReferralCode)

// POST /api/referral/promo - set / update promo code
router.post('/promo', limit({ name: 'referral-write', windowMs: 60 * 60_000, max: 30, scope: 'user' }), setPromoCode)

// GET  /api/referral/validate/:code - validate any invite/promo code (public-ish but auth guarded)
router.get('/validate/:code', validatePromoCode)

export default router
