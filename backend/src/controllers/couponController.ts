import { Response } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { redeemCoupon } from '../services/CouponService'

export const claimCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code } = req.body
  if (typeof code !== 'string' || !code.trim()) throw new AppError('Coupon code is required', 400)

  // All the rules (verified email AND phone, active / unexpired / within its limit, once per user, atomic usage
  // counter, Bonus Balance grant) live in CouponService.redeemCoupon
  const { amount } = await redeemCoupon(req.user!.id, code)

  res.json({
    success: true,
    message: `Coupon claimed successfully! $${amount} freeplay added.`,
    data: { amount }
  })
})
