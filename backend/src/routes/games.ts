import { Router } from 'express'
import { getGames, getGame, downloadGame, generateDownloadCode } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'

const router = Router()
router.get('/', authenticate, getGames)
router.get('/:id', authenticate, getGame)
router.post('/:id/download', authenticate, downloadGame)
router.post('/:id/download-code', authenticate, generateDownloadCode)

export default router
