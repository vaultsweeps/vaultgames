import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 200) {
      // Log slow endpoints (> 200ms)
      logger.warn(`[SLOW API] ${req.method} ${req.originalUrl} took ${duration}ms`);
    } else if (process.env.DEBUG_PERF === 'true') {
      logger.info(`[PERF] ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
};
