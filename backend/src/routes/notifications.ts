import { Router } from 'express'
import { getNotifications, markNotificationRead, markAllRead, getUnreadCount } from '../controllers/controllers'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)
router.get('/', getNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markNotificationRead)

export default router
