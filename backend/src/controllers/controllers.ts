import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'

const prisma = new PrismaClient()

// ─── GAMES ────────────────────────────────────────────────────────────────────
export const getGames = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { category, search, featured, page = 1, limit = 20 } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where: any = { isActive: true }
  if (category) where.category = category
  if (featured === 'true') where.isFeatured = true
  if (search) where.name = { contains: String(search), mode: 'insensitive' }

  const [games, total] = await Promise.all([
    prisma.game.findMany({ where, skip, take: Number(limit), orderBy: { downloadCount: 'desc' } }),
    prisma.game.count({ where })
  ])
  res.json({ success: true, data: games, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } })
})

export const getGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id as string, isActive: true } })
  if (!game) throw new AppError('Game not found', 404)
  res.json({ success: true, data: game })
})

export const downloadGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id as string, isActive: true } })
  if (!game) throw new AppError('Game not found', 404)
  if (!game.downloadUrl) throw new AppError('Download not available', 400)

  await prisma.$transaction([
    prisma.game.update({ where: { id: game.id }, data: { downloadCount: { increment: 1 } } }),
    prisma.gameDownload.upsert({
      where: { userId_gameId: { userId: req.user!.id, gameId: game.id } },
      create: { userId: req.user!.id, gameId: game.id },
      update: {}
    })
  ])

  res.json({ success: true, data: { downloadUrl: game.downloadUrl, name: game.name } })
})

// ─── BONUSES ─────────────────────────────────────────────────────────────────
export const getBonuses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bonuses = await prisma.bonus.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
  res.json({ success: true, data: bonuses })
})

export const claimBonus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bonus = await prisma.bonus.findUnique({ where: { id: req.params.id as string, isActive: true } })
  if (!bonus) throw new AppError('Bonus not found', 404)
  if (bonus.expiresAt && bonus.expiresAt < new Date()) throw new AppError('This bonus has expired', 400)

  const existing = await prisma.bonusClaim.findUnique({
    where: { userId_bonusId: { userId: req.user!.id, bonusId: bonus.id } }
  })
  if (existing) throw new AppError('You have already claimed this bonus', 400)

  const amount = bonus.amount || 0
  const claim = await prisma.bonusClaim.create({
    data: { userId: req.user!.id, bonusId: bonus.id, amount }
  })

  res.json({ success: true, message: 'Bonus claimed successfully!', data: claim })
})

// ─── SUPPORT ─────────────────────────────────────────────────────────────────
export const getTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: { replies: { orderBy: { createdAt: 'asc' }, include: { user: { select: { username: true, role: true } } } } }
  })
  res.json({ success: true, data: tickets })
})

export const createTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { subject, message, category = 'general', priority = 'medium' } = req.body
  const ticket = await prisma.supportTicket.create({
    data: { userId: req.user!.id, subject, message, category, priority }
  })
  res.status(201).json({ success: true, message: 'Ticket submitted. We\'ll respond within 24 hours.', data: ticket })
})

export const getTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id as string, userId: req.user!.id },
    include: { replies: { orderBy: { createdAt: 'asc' }, include: { user: { select: { username: true, role: true } } } } }
  })
  if (!ticket) throw new AppError('Ticket not found', 404)
  res.json({ success: true, data: ticket })
})

export const replyToTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id as string, userId: req.user!.id } })
  if (!ticket) throw new AppError('Ticket not found', 404)
  if (ticket.status === 'closed') throw new AppError('This ticket is closed', 400)

  const reply = await prisma.ticketReply.create({
    data: { ticketId: ticket.id, userId: req.user!.id, message: req.body.message, isAdmin: false }
  })
  res.status(201).json({ success: true, data: reply })
})

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where: { userId: req.user!.id } }),
    prisma.notification.count({ where: { userId: req.user!.id, isRead: false } })
  ])
  res.json({ success: true, data: notifications, unreadCount: unread, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } })
})

export const markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { id: req.params.id as string, userId: req.user!.id }, data: { isRead: true } })
  res.json({ success: true })
})

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id }, data: { isRead: true } })
  res.json({ success: true, message: 'All notifications marked as read' })
})

export const getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } })
  res.json({ success: true, data: { count } })
})

// ─── PROFILE ─────────────────────────────────────────────────────────────────
import bcrypt from 'bcryptjs'

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fullName, phone, country, telegramUsername } = req.body
  const profile = await prisma.userProfile.upsert({
    where: { userId: req.user!.id },
    update: { fullName, phone, country, telegramUsername },
    create: { userId: req.user!.id, fullName, phone, country, telegramUsername }
  })
  res.json({ success: true, message: 'Profile updated', data: profile })
})

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) throw new AppError('User not found', 404)

  const isMatch = await bcrypt.compare(currentPassword, user.password)
  if (!isMatch) throw new AppError('Current password is incorrect', 400)

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

  res.json({ success: true, message: 'Password changed successfully' })
})

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
export const getPublicBanners = asyncHandler(async (_req: any, res: Response) => {
  const now = new Date()
  const banners = await prisma.banner.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
    },
    orderBy: { order: 'asc' }
  })
  res.json({ success: true, data: banners })
})

export const getPublicFeaturedGames = asyncHandler(async (_req: any, res: Response) => {
  const games = await prisma.game.findMany({
    where: { isActive: true, isFeatured: true },
    take: 6, orderBy: { downloadCount: 'desc' },
    select: { id: true, name: true, category: true, version: true, downloadCount: true, thumbnailUrl: true, description: true, rating: true, isFeatured: true }
  })
  res.json({ success: true, data: games })
})

export const getPublicGameDetails = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params
  const game = await prisma.game.findUnique({
    where: { id }
  })
  if (!game || !game.isActive) throw new AppError('Game not found', 404)
  res.json({ success: true, data: game })
})

export const getPublicBonuses = asyncHandler(async (_req: any, res: Response) => {
  const bonuses = await prisma.bonus.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
    orderBy: { createdAt: 'desc' }
  })
  res.json({ success: true, data: bonuses })
})

export const getPublicFAQs = asyncHandler(async (_req: any, res: Response) => {
  const faqs = await prisma.fAQ.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { order: 'asc' }] })
  res.json({ success: true, data: faqs })
})

export const getPublicStats = asyncHandler(async (_req: any, res: Response) => {
  const [totalUsers, totalGames, totalDownloads] = await Promise.all([
    prisma.user.count({ where: { role: 'user', isActive: true } }),
    prisma.game.count({ where: { isActive: true } }),
    prisma.game.aggregate({ _sum: { downloadCount: true } })
  ])
  res.json({ success: true, data: { totalUsers, totalGames, totalDownloads: totalDownloads._sum.downloadCount || 0 } })
})

export const sendContactForm = asyncHandler(async (req: any, res: Response) => {
  const { name, email, message } = req.body
  // In production: send email via nodemailer
  console.log('Contact form:', { name, email, message })
  res.json({ success: true, message: 'Message received! We\'ll get back to you soon.' })
})

export const getPublicSettings = asyncHandler(async (_req: any, res: Response) => {
  // Only expose safe public settings
  const publicKeys = ['site_name', 'site_tagline', 'site_description', 'telegram_url', 'facebook_url', 'maintenance_mode']
  const settings = await prisma.setting.findMany({
    where: { key: { in: publicKeys } }
  })
  const obj = settings.reduce((acc: any, s) => { acc[s.key] = s.value; return acc }, {})
  res.json({ success: true, data: obj })
})
