import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array().reduce((acc: any, e: any) => {
        acc[e.path] = e.msg
        return acc
      }, {})
    })
  }
  next()
}
