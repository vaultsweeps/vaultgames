import { Router } from 'express'
import { getTickets, createTicket, getTicket, replyToTicket } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)
router.get('/', getTickets)
router.post('/', createTicket)
router.get('/:id', getTicket)
router.post('/:id/reply', replyToTicket)

export default router
