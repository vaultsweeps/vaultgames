import { Router } from 'express'
import { authenticate } from '../middleware/auth'
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
router.post('/generate', generateReferralCode)

// POST /api/referral/promo - set / update promo code
router.post('/promo', setPromoCode)

// GET  /api/referral/validate/:code - validate any invite/promo code (public-ish but auth guarded)
router.get('/validate/:code', validatePromoCode)

export default router
