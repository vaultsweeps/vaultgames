import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'

  // Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409
    const field = err.meta?.target?.[0] || 'field'
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
  }
  if (err.code === 'P2025') {
    statusCode = 404
    message = 'Record not found'
  }
  if (err.code === 'P2003') {
    statusCode = 400
    message = 'Related record not found'
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = err.message
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.path} - ${statusCode}: ${message}`, { stack: err.stack })
  }

  // For unexpected (non-operational) 5xx errors, don't leak the raw error
  // message to the client in production — it may contain internal details
  // (file paths, DB/library internals) that weren't written with users in mind.
  const clientMessage =
    statusCode >= 500 && !err.isOperational && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next)
