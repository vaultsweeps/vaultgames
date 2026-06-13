import { Router } from 'express'
import { updateProfile, changePassword } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)
router.put('/', updateProfile)
router.put('/password', changePassword)

export default router
