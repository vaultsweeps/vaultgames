import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getWheelConfig, spinWheel } from '../controllers/wheelController'

const router = Router()

router.use(authenticate)
router.get('/config', getWheelConfig)
router.post('/spin', spinWheel)

export default router
