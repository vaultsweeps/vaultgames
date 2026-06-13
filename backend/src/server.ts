import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'

import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

// Routes
import authRoutes from './routes/auth'
import depositRoutes from './routes/deposits'
import withdrawalRoutes from './routes/withdrawals'
import gameRoutes from './routes/games'
import bonusRoutes from './routes/bonuses'
import supportRoutes from './routes/support'
import notificationRoutes from './routes/notifications'
import profileRoutes from './routes/profile'
import publicRoutes from './routes/public'
import adminRoutes from './routes/admin'
import webhookRoutes from './routes/webhooks'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Increased from 20 to allow testing
  message: { success: false, message: 'Too many authentication attempts.' },
})

app.use('/api/', limiter)
app.use('/api/auth/', authLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(compression())

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }))
}

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/deposits', depositRoutes)
app.use('/api/withdrawals', withdrawalRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/bonuses', bonusRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/webhooks', webhookRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// Error handler
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 NexusGaming API running on port ${PORT}`)
  logger.info(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
