import { Router, Request, Response, NextFunction } from 'express'
import { getPublicBanners, getPublicFeaturedGames, getPublicBonuses, getPublicFAQs, getPublicStats, sendContactForm, getPublicGameDetails, getPublicSettings } from '../controllers/controllers'

const router = Router()

// Cache-Control helper — safe only for truly public, non-user-specific endpoints
const publicCache = (maxAge: number) => (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`)
  next()
}

router.get('/banners', publicCache(60), getPublicBanners)
router.get('/games/featured', publicCache(60), getPublicFeaturedGames)
router.get('/games/:id', publicCache(120), getPublicGameDetails)
router.get('/bonuses', publicCache(120), getPublicBonuses)
router.get('/faqs', publicCache(600), getPublicFAQs)
router.get('/stats', publicCache(30), getPublicStats)
router.post('/contact', sendContactForm)
router.get('/settings', publicCache(300), getPublicSettings)

export default router
