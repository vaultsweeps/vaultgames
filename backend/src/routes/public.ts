import { Router } from 'express'
import { getPublicBanners, getPublicFeaturedGames, getPublicBonuses, getPublicFAQs, getPublicStats, sendContactForm, getPublicGameDetails, getPublicSettings } from '../controllers/controllers'

const router = Router()
router.get('/banners', getPublicBanners)
router.get('/games/featured', getPublicFeaturedGames)
router.get('/games/:id', getPublicGameDetails)
router.get('/bonuses', getPublicBonuses)
router.get('/faqs', getPublicFAQs)
router.get('/stats', getPublicStats)
router.post('/contact', sendContactForm)
router.get('/settings', getPublicSettings)

export default router
