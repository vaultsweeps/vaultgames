import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { performanceLogger } from './middleware/performanceLogger'
import { limit } from './middleware/security'
import { csrfProtect } from './middleware/csrf'

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
import providerRoutes from './routes/provider'
import referralRoutes from './routes/referral'
import couponRoutes from './routes/coupons'
import wheelRoutes from './routes/wheel'
import proxyRoutes from './routes/proxy'

// A forgeable JWT secret means anyone can mint an admin token. Refuse to start in production with a missing/very short
// secret (set ALLOW_WEAK_SECRETS=1 only as a temporary emergency escape), and warn about weak-looking / unset values.
if (process.env.NODE_ENV === 'production') {
  const weak = ['JWT_SECRET'].filter(k => (process.env[k] || '').length < 16)
  if (weak.length && process.env.ALLOW_WEAK_SECRETS !== '1') {
    logger.error(`FATAL: ${weak.join(', ')} missing or shorter than 16 characters — refusing to start. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
    process.exit(1)
  }
  for (const k of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'WEBHOOK_SECRET']) {
    const v = process.env[k] || ''
    if (!v) logger.warn(`[SECURITY] ${k} is not set`)
    else if (v.length < 32 || /change[-_ ]?me|example|your[-_ ]|default|placeholder|secret[-_]?key/i.test(v)) logger.warn(`[SECURITY] ${k} looks weak or like a placeholder — rotate it to a random 48+ byte value`)
  }
  if (!process.env.GGUSONEPAY_API_KEY || !process.env.GGUSONEPAY_MERCHANT_ID) logger.warn('[SECURITY] GGUSONEPAY_API_KEY / GGUSONEPAY_MERCHANT_ID not set — GGUSONEPAY deposits and webhooks will be rejected (fail closed)')
}

// A rejected promise nobody awaited (Telegram polling, IMAP, fire-and-forget DB work) must not take the whole API down
process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason as any)
})

const app = express()
const PORT = process.env.PORT || 5000

// Client IP awareness behind a reverse proxy. TRUST_PROXY = number of proxy hops in front of the API
// (1 = Render or nginx, 2 = Cloudflare + nginx). Never use "true": that trusts a client-supplied
// X-Forwarded-For and lets attackers dodge per-IP limits. Unset = unchanged behaviour.
const trustProxy = process.env.TRUST_PROXY
if (trustProxy && /^\d+$/.test(trustProxy)) {
  app.set('trust proxy', Number(trustProxy))
} else if (trustProxy && trustProxy !== 'true') {
  app.set('trust proxy', trustProxy) // e.g. "loopback" or a CIDR list
} else if (process.env.RENDER) {
  app.set('trust proxy', 1)
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))
// Only the DollarPay proxy page is embedded in an iframe; everything else keeps helmet's X-Frame-Options: SAMEORIGIN
app.use('/api/proxy', (_req, res, next) => { res.removeHeader('X-Frame-Options'); next() })

// Authenticated / private API responses must never be stored by a browser or shared cache
const PRIVATE_API = /^\/api\/(auth|profile|deposits|withdrawals|admin|provider|notifications|support|referral|user|wheel|bonuses)(\/|$)/
app.use((req, res, next) => {
  if (PRIVATE_API.test(req.path)) res.setHeader('Cache-Control', 'no-store')
  next()
})

// Performance logger (track slow API calls)
app.use(performanceLogger)

// CORS
const allowedOrigins = [
  (process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://vaultsweeps.vercel.app' : 'http://localhost:3000')).replace(/\/$/, ''),
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001']),
  'https://vaultsweeps.vercel.app',
  'https://vaultsweeps.com',
  'https://www.vaultsweeps.com',
]

// Extra allowed origins (custom domains, staging) — comma separated, exact match
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
const VERCEL_PREVIEW = /^https:\/\/vaultsweeps(-[a-z0-9-]+)?\.vercel\.app$/

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true)
    const cleanOrigin = origin.replace(/\/$/, '')
    // Exact allowlist + this project's own Vercel preview URLs. A bare ".endsWith('.vercel.app')" trusted EVERY Vercel
    // tenant, so anyone could host a page on Vercel that calls this API with a visitor's credentials.
    const isProd = process.env.NODE_ENV === 'production'
    if (
      allowedOrigins.includes(cleanOrigin) ||
      extraOrigins.includes(cleanOrigin) ||
      VERCEL_PREVIEW.test(cleanOrigin) ||
      (!isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin))
    ) {
      callback(null, true)
    } else {
      logger.warn(`CORS blocked origin: ${cleanOrigin}`)
      callback(null, !isProd) // Allow all in dev
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
  // Without this, browsers cache a CORS preflight for only a few seconds (or not at all), so every
  // non-simple cross-origin request (i.e. almost all of them, since the frontend and API are on different
  // subdomains and send Content-Type/Authorization/X-CSRF-Token) pays a fresh ~300ms OPTIONS round-trip on
  // top of its own response time — measured in production: 8-10 preflights on a single page load, 270-330ms
  // each, 2.5-3s of pure overhead before any real work even starts. 86400s (24h) is the spec max; Chromium
  // clamps it to 2h and Firefox honors up to 24h internally, so this is safe to set this high everywhere.
  maxAge: 86400,
}))

app.use(cookieParser())
// Global: only actually enforces anything on a request carrying the (cross-origin, SameSite=None) session
// cookie — see middleware/csrf.ts. A request authenticated the legacy way, via an Authorization header, is
// unaffected.
app.use(csrfProtect)

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', limiter)

// Payment webhooks: small bodies only, parsed first (the global parser then skips already-parsed requests) and
// rate limited — the signature check happens after parsing, so this bounds unauthenticated work.
app.use('/api/webhooks', limit({ name: 'webhooks', windowMs: 60_000, max: 120, scope: 'ip' }), express.json({ limit: '64kb' }), express.urlencoded({ extended: false, limit: '64kb' }))

// Body parsing
// Uploads use multipart (multer, own size limits); no JSON endpoint needs more than 1 MB
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(compression())

// Pagination guard for every list endpoint: page >= 1, limit within a sane cap (admin tables may ask for more)
app.use('/api', (req, _res, next) => {
  const q = req.query as Record<string, unknown>
  const cap = req.path.startsWith('/admin') ? 500 : 100
  if (q.limit !== undefined) {
    const n = parseInt(String(q.limit), 10)
    q.limit = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), cap) : 20)
  }
  if (q.page !== undefined) {
    const n = parseInt(String(q.page), 10)
    q.page = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 100000) : 1)
  }
  next()
})

// Redact one-time secret tokens (password reset / email verification) out of
// the URL before it's written to any access log
morgan.token('url', (req: express.Request) =>
  (req.originalUrl || req.url || '').replace(/(reset-password|verify-email)\/[^/?]+/gi, '$1/[REDACTED]')
)

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
app.use('/api/provider', providerRoutes)
app.use('/api/referral', referralRoutes)
app.use('/api/user/coupons', couponRoutes)
app.use('/api/wheel', wheelRoutes)
app.use('/api/proxy', limit({ name: 'payment-proxy', windowMs: 10 * 60_000, max: 40, scope: 'ip' }), proxyRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// Error handler
app.use(errorHandler)

import { TelegramSupportBot } from './services/TelegramSupportBot'
import { ImapZappayService } from './services/payment/ImapZappayService'
import { ImapChimePayPalService } from './services/payment/ImapChimePayPalService'
import prisma from './lib/prisma'

// Auto-fail stale pending crypto deposits after 8 hours
async function failStaleCryptoDeposits() {
  try {
    const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
    const stale = await prisma.deposit.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: cutoff },
        paymentMethod: { code: 'crypto' }
      },
      include: { paymentMethod: true }
    })

    for (const deposit of stale) {
      // Guarded: a webhook may have approved it since the read above
      const failed = await prisma.deposit.updateMany({
        where: { id: deposit.id, status: 'pending' },
        data: { status: 'failed', notes: 'Auto-failed after 8 hours without payment confirmation' }
      })
      if (failed.count !== 1) continue
      logger.info(`[Scheduler] Auto-failed stale crypto deposit ${deposit.id} ($${deposit.amount})`)
    }
    if (stale.length > 0) logger.info(`[Scheduler] Auto-failed ${stale.length} stale crypto deposit(s)`)
  } catch (err) {
    logger.error('[Scheduler] Failed to auto-fail stale crypto deposits:', err)
  }
}

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Vault Sweeps API running on port ${PORT}`)
  logger.info(`🌱 Environment: ${process.env.NODE_ENV || 'development'}`)
  TelegramSupportBot.getInstance().start()
  ImapZappayService.startCron()
  ImapChimePayPalService.startCron()

  // Run once on startup, then every hour
  failStaleCryptoDeposits()
  setInterval(failStaleCryptoDeposits, 60 * 60 * 1000)
})

export default app
