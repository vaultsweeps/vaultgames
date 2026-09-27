import { Router } from 'express'
import { getTickets, createTicket, getTicket, replyToTicket } from '../controllers/controllers'
import { getConversation, getMessages, sendMessage } from '../controllers/supportController'
import { authenticate } from '../middleware/auth'
import { limit } from '../middleware/security'

const router = Router()
router.use(authenticate)

// Existing Ticket System
router.get('/', getTickets)
router.post('/', limit({ name: 'ticket-create', windowMs: 60 * 60_000, max: 10, scope: 'user' }), createTicket)
router.get('/:id', getTicket)
router.post('/:id/reply', limit({ name: 'ticket-reply', windowMs: 60 * 60_000, max: 60, scope: 'user' }), replyToTicket)

// New Telegram-powered Live Chat System
router.get('/chat/conversation', getConversation)
router.get('/chat/messages/:conversationId', getMessages)
router.post('/chat/messages', limit({ name: 'chat-send', windowMs: 60_000, max: 30, scope: 'user' }), sendMessage)

export default router
