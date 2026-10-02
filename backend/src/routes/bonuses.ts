import { Router } from 'express'
import { getBonuses, claimBonus } from '../controllers/controllers'
import { getBonusBalance, getBonusHistory } from '../controllers/bonusBalanceController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.get('/', authenticate, getBonuses)
router.post('/:id/claim', authenticate, claimBonus)
router.get('/balance', authenticate, getBonusBalance)
router.get('/history', authenticate, getBonusHistory)

export default router
