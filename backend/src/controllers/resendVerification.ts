import { Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { sendVerificationEmail } from '../services/emailService'
import { AuthRequest } from '../middleware/auth'
import { markEmailVerifyTokenIssued } from '../lib/redis'

export const resendVerification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Unauthorized', 401)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)
  if (user.isVerified) return res.json({ success: true, message: 'Email is already verified.' })

  let verifyToken = user.verifyToken
  if (!verifyToken) {
    verifyToken = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: userId },
      data: { verifyToken }
    })
  }

  // Refresh the token's validity window on every resend
  await markEmailVerifyTokenIssued(verifyToken)

  await sendVerificationEmail(user.email, user.username, verifyToken)

  res.json({ success: true, message: 'Verification email sent! Please check your inbox.' })
})
