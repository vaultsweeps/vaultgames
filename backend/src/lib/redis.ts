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
