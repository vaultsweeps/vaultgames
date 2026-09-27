import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { limit, serializePerUser } from '../middleware/security'
import { getWheelConfig, spinWheel } from '../controllers/wheelController'

const router = Router()

router.use(authenticate)
router.get('/config', getWheelConfig)
// serializePerUser adds a cross-instance (Redis-backed) lock on top of the in-process Set and the
// Serializable transaction inside spinWheel itself — the same three-layer pattern used for wallet transfers.
router.post('/spin', limit({ name: 'wheel-spin', windowMs: 60_000, max: 10, scope: 'user' }), serializePerUser('wheel-spin'), spinWheel)

export default router
