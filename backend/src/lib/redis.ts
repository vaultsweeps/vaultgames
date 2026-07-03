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

/**
 * Helper function to fetch data from cache, or retrieve it via the fallback function and cache it.
 * @param key The unique cache key
 * @param fallbackFn Function that returns the fresh data if cache miss
 * @param ttlSeconds Time-to-live in seconds (default 60s)
 * @returns The cached or fresh data
 */
export async function getCached<T>(
  key: string,
  fallbackFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // If Redis is not configured, just run the fallback function directly
  if (!redis) {
    return fallbackFn();
  }

  try {
    const cachedData = await redis.get(key);
    if (cachedData) {
      // Upstash parses JSON automatically
      return cachedData as T;
    }
  } catch (error) {
    logger.error(`Redis Get Error for key ${key}:`, error);
    // If cache read fails, gracefully degrade to fetching from DB
  }

  // Cache miss or error: Fetch fresh data
  const freshData = await fallbackFn();

  try {
    // Fire and forget caching (don't await to block the response)
    redis.setex(key, ttlSeconds, JSON.stringify(freshData)).catch(err => {
      logger.error(`Redis Set Error for key ${key}:`, err);
    });
  } catch (error) {
    logger.error(`Redis Set Error for key ${key}:`, error);
  }

  return freshData;
}
