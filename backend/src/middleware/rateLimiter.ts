import rateLimit from 'express-rate-limit'

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Allow up to 100 auth attempts per 15-minute window
  message: { success: false, message: 'Too many authentication attempts.' },
  standardHeaders: true,
  legacyHeaders: false,
})
