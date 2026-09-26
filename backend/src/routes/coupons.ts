import { Router } from 'express'
import { claimCoupon } from '../controllers/couponController'
import { authenticate } from '../middleware/auth'
import { limit } from '../middleware/security'

const router = Router()
router.post('/claim', authenticate, limit({ name: 'coupon-claim', windowMs: 60 * 60_000, max: 30, scope: 'ip+user' }), claimCoupon)

export default router
