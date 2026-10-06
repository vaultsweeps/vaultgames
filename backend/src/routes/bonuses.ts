import { Router } from 'express'
import { getBonuses, claimBonus } from '../controllers/controllers'
import { getBonusBalance, getBonusHistory, getSundayFreeplayStatus } from '../controllers/bonusBalanceController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.get('/', authenticate, getBonuses)
router.post('/:id/claim', authenticate, claimBonus)
router.get('/balance', authenticate, getBonusBalance)
router.get('/history', authenticate, getBonusHistory)
router.get('/sunday-freeplay', authenticate, getSundayFreeplayStatus)

export default router
