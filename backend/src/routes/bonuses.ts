import { Router } from 'express'
import { getBonuses, claimBonus } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'

const router = Router()
router.get('/', authenticate, getBonuses)
router.post('/:id/claim', authenticate, claimBonus)

export default router
