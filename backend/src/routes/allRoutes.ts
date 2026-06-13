// games.ts
import { Router as GRouter } from 'express'
import { getGames, getGame, downloadGame } from './controllers'
import { authenticate } from '../middleware/auth'

const gamesRouter = GRouter()
gamesRouter.get('/', authenticate, getGames)
gamesRouter.get('/:id', authenticate, getGame)
gamesRouter.post('/:id/download', authenticate, downloadGame)
export { gamesRouter }

// bonuses.ts
import { Router as BRouter } from 'express'
import { getBonuses, claimBonus } from './controllers'

const bonusesRouter = BRouter()
bonusesRouter.get('/', authenticate, getBonuses)
bonusesRouter.post('/:id/claim', authenticate, claimBonus)
export { bonusesRouter }

// support.ts
import { Router as SRouter } from 'express'
import { getTickets, createTicket, getTicket, replyToTicket } from './controllers'

const supportRouter = SRouter()
supportRouter.use(authenticate)
supportRouter.get('/', getTickets)
supportRouter.post('/', createTicket)
supportRouter.get('/:id', getTicket)
supportRouter.post('/:id/reply', replyToTicket)
export { supportRouter }

// notifications.ts
import { Router as NRouter } from 'express'
import { getNotifications, markNotificationRead, markAllRead, getUnreadCount } from './controllers'

const notificationsRouter = NRouter()
notificationsRouter.use(authenticate)
notificationsRouter.get('/', getNotifications)
notificationsRouter.get('/unread-count', getUnreadCount)
notificationsRouter.patch('/:id/read', markNotificationRead)
notificationsRouter.patch('/read-all', markAllRead)
export { notificationsRouter }

// profile.ts
import { Router as PRouter } from 'express'
import { updateProfile, changePassword } from './controllers'

const profileRouter = PRouter()
profileRouter.use(authenticate)
profileRouter.put('/', updateProfile)
profileRouter.put('/password', changePassword)
export { profileRouter }

// public.ts
import { Router as PubRouter } from 'express'
import { getPublicBanners, getPublicFeaturedGames, getPublicBonuses, getPublicFAQs, getPublicStats, sendContactForm } from './controllers'

const publicRouter = PubRouter()
publicRouter.get('/banners', getPublicBanners)
publicRouter.get('/games/featured', getPublicFeaturedGames)
publicRouter.get('/bonuses', getPublicBonuses)
publicRouter.get('/faqs', getPublicFAQs)
publicRouter.get('/stats', getPublicStats)
publicRouter.post('/contact', sendContactForm)
export { publicRouter }
