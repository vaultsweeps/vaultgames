import { Router } from 'express'
import { getGames, getGame, downloadGame, generateDownloadCode } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'
import { limit } from '../middleware/security'

const router = Router()
router.get('/', authenticate, getGames)
router.get('/:id', authenticate, getGame)
router.post('/:id/download', authenticate, downloadGame)
router.post('/:id/download-code', authenticate, limit({ name: 'download-code', windowMs: 60_000, max: 10, scope: 'user' }), generateDownloadCode)

export default router
