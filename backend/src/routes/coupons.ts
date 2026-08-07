import { Router } from 'express'
import { claimCoupon } from '../controllers/couponController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.post('/claim', authenticate, claimCoupon)

export default router
