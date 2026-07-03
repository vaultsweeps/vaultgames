import { Router } from 'express'
import { getTickets, createTicket, getTicket, replyToTicket } from '../controllers/controllers'
import { getConversation, getMessages, sendMessage } from '../controllers/supportController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Existing Ticket System
router.get('/', getTickets)
router.post('/', createTicket)
router.get('/:id', getTicket)
router.post('/:id/reply', replyToTicket)

// New Telegram-powered Live Chat System
router.get('/chat/conversation', getConversation)
router.get('/chat/messages/:conversationId', getMessages)
router.post('/chat/messages', sendMessage)

export default router
