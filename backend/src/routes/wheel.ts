import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { limit } from '../middleware/security'
import { getWheelConfig, spinWheel } from '../controllers/wheelController'

const router = Router()

router.use(authenticate)
router.get('/config', getWheelConfig)
router.post('/spin', limit({ name: 'wheel-spin', windowMs: 60_000, max: 10, scope: 'user' }), spinWheel)

export default router
