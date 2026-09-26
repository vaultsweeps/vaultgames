import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { redis } from '../lib/redis'
import type { AuthRequest } from './auth'

/* ───────────────────────── security event logging ─────────────────────────
 * One structured line per event, greppable with "[SECURITY]". Callers pass only non-secret
 * metadata: never passwords, tokens, cookies, API secrets or payment credentials.
 */
const TOKEN_IN_PATH = /(reset-password|verify-email|download-code)\/[^/?]+/gi

export function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

export function securityLog(event: string, req: Request, meta: Record<string, unknown> = {}) {
  const r = req as AuthRequest
  logger.warn(`[SECURITY] ${event} ${JSON.stringify({
    ip: clientIp(req),
    userId: r.user?.id,
    method: req.method,
    path: (req.originalUrl || req.url || '').split('?')[0].replace(TOKEN_IN_PATH, '$1/[REDACTED]'),
    ua: String(req.headers['user-agent'] || '').slice(0, 120),
    ...meta,
  })}`)
}

/* ───────────────────────────── rate limiting ─────────────────────────────
 * Layered, per-endpoint limits. A limiter keyed by IP is skipped when Express only sees a private /
 * loopback address (i.e. the app is behind a proxy and TRUST_PROXY is not configured): in that case
 * every visitor would share one bucket and a single attacker could lock everyone out.
 */
const PRIVATE_IP = /^(::1|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i
let warnedProxy = false

function ipUsable(req: Request): boolean {
  const ip = clientIp(req)
  if (PRIVATE_IP.test(ip) && process.env.NODE_ENV === 'production') {
    if (!warnedProxy) {
      warnedProxy = true
      logger.warn('[SECURITY] Express sees only a private/proxy IP for clients — IP-based rate limits are being skipped. Set TRUST_PROXY to the number of proxy hops in front of the API (e.g. 1 for Render or nginx, 2 for Cloudflare + nginx).')
    }
    return false
  }
  return true
}

export type LimitScope = 'ip' | 'user' | 'ip+user' | 'identity'

interface LimitOptions {
  name: string
  windowMs: number
  max: number
  scope?: LimitScope
  /** count only failed (status >= 400) responses — used for brute-force limits on login */
  failedOnly?: boolean
  /** for scope 'identity': which body field identifies the target (e.g. the email/username being logged in to) */
  identityField?: string
  message?: string
}

export function limit(o: LimitOptions) {
  const scope = o.scope ?? 'ip'
  const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 24)

  return rateLimit({
    windowMs: o.windowMs,
    max: o.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: !!o.failedOnly,
    // Identity-only buckets don't depend on the client IP, so they still work behind an unconfigured proxy.
    skip: (req) => (scope === 'ip' || (scope === 'ip+user' && !(req as AuthRequest).user?.id)) ? !ipUsable(req) : false,
    keyGenerator: (req) => {
      const uid = (req as AuthRequest).user?.id
      const ip = clientIp(req)
      if (scope === 'user') return uid ? `u:${uid}` : `ip:${ip}`
      if (scope === 'ip+user') return `${ip}|${uid ?? '-'}`
      if (scope === 'identity') {
        const raw = String((req.body && o.identityField ? req.body[o.identityField] : '') ?? '').trim().toLowerCase().slice(0, 200)
        return `${ipUsable(req) ? ip : 'shared'}|${raw ? hash(raw) : '-'}`
      }
      return `ip:${ip}`
    },
    handler: (req, res, _next, opts) => {
      securityLog('rate_limit_exceeded', req, { limiter: o.name, limit: opts.limit, windowSec: Math.round(o.windowMs / 1000) })
      res.status(429).json({ success: false, message: o.message || 'Too many requests. Please slow down and try again shortly.' })
    },
  })
}

/* ───────────────────────── per-user wallet lock ─────────────────────────
 * Serialises every request that can move a user's money (game transfers, withdrawal requests) so two
 * parallel requests can never pass the same balance check. In-process lock + Redis lock (multi-instance).
 */
const localLocks = new Set<string>()

export function serializePerUser(scope: string, ttlSec = 90) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthRequest).user?.id
    if (!userId) return next()

    const key = `lock:${scope}:${userId}`
    const busy = () => {
      securityLog('concurrent_wallet_request_blocked', req, { scope })
      return res.status(409).json({ success: false, message: 'Another wallet request is already being processed. Please wait a moment and try again.' })
    }
    if (localLocks.has(key)) return busy()
    localLocks.add(key)

    const token = crypto.randomUUID()
    let redisHeld = false
    if (redis) {
      try {
        const ok = await redis.set(key, token, { nx: true, ex: ttlSec })
        if (!ok) { localLocks.delete(key); return busy() }
        redisHeld = true
      } catch (e: any) {
        logger.warn(`[lock] Redis unavailable, using in-process lock only: ${e?.message}`)
      }
    }

    let released = false
    const release = async () => {
      if (released) return
      released = true
      localLocks.delete(key)
      if (redisHeld && redis) {
        try { if ((await redis.get(key)) === token) await redis.del(key) } catch { /* lock expires on its own */ }
      }
    }
    res.on('finish', release)
    res.on('close', release)
    next()
  }
}

/* ───────────────────────────── idempotency ─────────────────────────────
 * Opt-in: when a client sends an `Idempotency-Key` header, a repeat of the same request (retry, replay,
 * double submit) returns the original result instead of running the operation again. Without the header
 * nothing changes.
 */
type Stored = { state: 'pending' } | { state: 'done'; status: number; body: unknown }
const memStore = new Map<string, { v: Stored; exp: number }>()
const IDEM_DONE_TTL = 10 * 60
const IDEM_PENDING_TTL = 60

async function idemGet(k: string): Promise<Stored | null> {
  if (redis) { try { return ((await redis.get(k)) as Stored | null) ?? null } catch { /* fall through to memory */ } }
  const m = memStore.get(k)
  if (m && m.exp > Date.now()) return m.v
  if (m) memStore.delete(k)
  return null
}
async function idemSet(k: string, v: Stored, ttlSec: number, nx = false): Promise<boolean> {
  if (redis) {
    try { const r = await redis.set(k, v, nx ? { ex: ttlSec, nx: true } : { ex: ttlSec }); return nx ? !!r : true } catch { /* fall through */ }
  }
  const cur = memStore.get(k)
  if (nx && cur && cur.exp > Date.now()) return false
  memStore.set(k, { v, exp: Date.now() + ttlSec * 1000 })
  return true
}

export function idempotency(scope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('Idempotency-Key')
    const userId = (req as AuthRequest).user?.id
    if (!header || !userId) return next()
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(header)) {
      return res.status(400).json({ success: false, message: 'Invalid Idempotency-Key.' })
    }

    const k = `idem:${scope}:${userId}:${header}`
    const existing = await idemGet(k)
    if (existing?.state === 'done') {
      res.setHeader('Idempotent-Replay', 'true')
      return res.status(existing.status).json(existing.body)
    }
    if (existing?.state === 'pending' || !(await idemSet(k, { state: 'pending' }, IDEM_PENDING_TTL, true))) {
      securityLog('duplicate_request_blocked', req, { scope })
      return res.status(409).json({ success: false, message: 'This request is already being processed.' })
    }

    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      // Cache only definitive outcomes; a 5xx may be retried with the same key.
      if (res.statusCode < 500) void idemSet(k, { state: 'done', status: res.statusCode, body }, IDEM_DONE_TTL)
      else void idemSet(k, { state: 'pending' }, 1)
      return originalJson(body)
    }
    next()
  }
}

/* ───────────────────────── strict amount validation ───────────────────────── */
export function parseMoney(value: unknown, opts: { min?: number; max?: number } = {}): number | null {
  const min = opts.min ?? 0.01
  const max = opts.max ?? 100000
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'string' && /^\d{1,9}(\.\d{1,6})?$/.test(value.trim())) n = Number(value.trim())
  else return null
  if (!Number.isFinite(n)) return null
  n = Math.round(n * 100) / 100
  if (n < min || n > max) return null
  return n
}
