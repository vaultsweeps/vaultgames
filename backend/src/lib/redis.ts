import { Redis } from '@upstash/redis'
import { logger } from '../utils/logger'

// Initialize Upstash Redis client
// If the credentials are not provided (e.g. during development/testing),
// we fall back to a mock that just bypasses the cache.
const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

if (redis) {
  logger.info('Upstash Redis initialized');
} else {
  logger.warn('Upstash Redis credentials missing. Caching will be disabled.');
}

// In-memory cache layer to make repeated queries instant (0ms latency)
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Helper function to fetch data from cache, or retrieve it via the fallback function and cache it.
 * Layer 1: Memory (Instant)
 * Layer 2: Redis (Fast, across instances)
 * Layer 3: Database (Slow, fallback)
 */
export async function getCached<T>(
  key: string,
  fallbackFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const now = Date.now();

  // Layer 1: In-Memory Cache
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.data as T;
  }

  // Layer 2: Upstash Redis
  if (redis) {
    try {
      const cachedData = await redis.get(key);
      if (cachedData) {
        // Hydrate memory cache so next request is 0ms
        memoryCache.set(key, { data: cachedData, expiresAt: now + ttlSeconds * 1000 });
        return cachedData as T;
      }
    } catch (error) {
      logger.error(`Redis Get Error for key ${key}:`, error);
    }
  }

  // Layer 3: Database Fallback
  const freshData = await fallbackFn();

  // Store in Memory Cache
  memoryCache.set(key, { data: freshData, expiresAt: Date.now() + ttlSeconds * 1000 });

  // Store in Redis (Fire and Forget)
  if (redis) {
    try {
      redis.setex(key, ttlSeconds, JSON.stringify(freshData)).catch(err => {
        logger.error(`Redis Set Error for key ${key}:`, err);
      });
    } catch (error) {
      logger.error(`Redis Set Error for key ${key}:`, error);
    }
  }

  return freshData;
}

/**
 * Invalidates a cached key in both Memory and Redis.
 */
export async function invalidateCached(key: string): Promise<void> {
  // Clear Memory Cache
  memoryCache.delete(key);

  // Clear Redis
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`Redis Delete Error for key ${key}:`, error);
    }
  }
}

// ─── Token revocation ───────────────────────────────────────────────────────
// JWTs are stateless, so "logout" and "password changed" need an explicit
// revocation record: any token issued (by `iat`) before this timestamp for a
// given user is treated as invalid, even though it hasn't expired yet.
// Stored in Redis rather than the DB to avoid a schema migration.
const REVOCATION_TTL_SECONDS = 8 * 24 * 60 * 60 // slightly longer than the 7-day access token lifetime

export async function revokeTokensIssuedBefore(userId: string, atMs: number = Date.now()): Promise<void> {
  if (!redis) return
  try {
    await redis.setex(`revoked_before:${userId}`, REVOCATION_TTL_SECONDS, atMs)
  } catch (error) {
    logger.error(`Redis Set Error for revocation of user ${userId}:`, error)
  }
}

export async function getTokensRevokedBefore(userId: string): Promise<number | null> {
  if (!redis) return null
  try {
    const value = await redis.get(`revoked_before:${userId}`)
    return value ? Number(value) : null
  } catch (error) {
    logger.error(`Redis Get Error for revocation of user ${userId}:`, error)
    return null
  }
}

// ─── Email-verification token expiry ───────────────────────────────────────
// The User model has no verifyTokenExpiry column, so expiry is tracked here
// via Redis TTL instead of requiring a schema migration: a token is valid
// only while its Redis marker key still exists (24h).
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60

export async function markEmailVerifyTokenIssued(token: string): Promise<void> {
  if (!redis) return
  try {
    await redis.setex(`email_verify_token:${token}`, EMAIL_VERIFY_TTL_SECONDS, '1')
  } catch (error) {
    logger.error('Redis Set Error for email verify token:', error)
  }
}

/** Returns true if the token is still within its validity window, or if Redis
 *  is unavailable (graceful degrade — same as the rest of this cache layer). */
export async function isEmailVerifyTokenValid(token: string): Promise<boolean> {
  if (!redis) return true
  try {
    const value = await redis.get(`email_verify_token:${token}`)
    return value !== null
  } catch (error) {
    logger.error('Redis Get Error for email verify token:', error)
    return true
  }
}

export async function clearEmailVerifyToken(token: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(`email_verify_token:${token}`)
  } catch (error) {
    logger.error('Redis Delete Error for email verify token:', error)
  }
}

// ─── Telegram account-linking token ────────────────────────────────────────
// The `/start <payload>` deep link used to link a user's Telegram account
// used to embed the raw user ID, which is not secret — anyone who learned a
// victim's ID could DM the bot and hijack their Telegram link. A random,
// short-lived, single-use token stored here (instead of the ID itself)
// closes that off without needing a schema change.
import crypto from 'crypto'

const TELEGRAM_LINK_TTL_SECONDS = 30 * 60

export async function createTelegramLinkToken(userId: string): Promise<string | null> {
  if (!redis) return null
  const token = crypto.randomBytes(24).toString('hex')
  try {
    await redis.setex(`telegram_link:${token}`, TELEGRAM_LINK_TTL_SECONDS, userId)
    return token
  } catch (error) {
    logger.error('Redis Set Error for telegram link token:', error)
    return null
  }
}

export async function resolveTelegramLinkToken(token: string): Promise<string | null> {
  if (!redis) return null
  try {
    const userId = await redis.get(`telegram_link:${token}`)
    if (userId) await redis.del(`telegram_link:${token}`) // single-use
    return (userId as string) || null
  } catch (error) {
    logger.error('Redis Get Error for telegram link token:', error)
    return null
  }
}
