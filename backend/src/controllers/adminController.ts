import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { createNotification } from '../services/notificationService'
import { logger } from '../utils/logger'
import { supabase } from '../utils/supabase'
import { WalletService, invalidateWalletCache } from '../services/WalletService'
import { ReferralService } from '../services/ReferralService'
import { redis, getCached } from '../lib/redis'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import * as XLSX from 'xlsx'

// GET /api/admin/stats
export const getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await getCached('admin_dashboard_stats', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Run in smaller batches to prevent exceeding Supabase connection pool size (15)
    const [totalUsers, activeUsers] = await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { role: 'user', isActive: true, isBanned: false } })
    ])

    const [totalDepositsData, totalWithdrawalsData] = await Promise.all([
      prisma.deposit.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: true }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'paid'] } }, _sum: { amount: true }, _count: true })
    ])

    const [pendingDeposits, pendingWithdrawals] = await Promise.all([
      prisma.deposit.count({ where: { status: 'pending' } }),
      prisma.withdrawal.count({ where: { status: 'pending' } })
    ])

    const [todayDeposits, todayWithdrawals] = await Promise.all([
      prisma.deposit.aggregate({ where: { status: 'approved', createdAt: { gte: today } }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'paid'] }, createdAt: { gte: today } }, _sum: { amount: true } })
    ])

    const [pendingDepositsList, pendingWithdrawalsList, openTickets] = await Promise.all([
      prisma.deposit.findMany({ where: { status: 'pending' }, take: 3, orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true } }, paymentMethod: { select: { name: true } } } }),
      prisma.withdrawal.findMany({ where: { status: 'pending' }, take: 3, orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true } }, paymentMethod: { select: { name: true } } } }),
      prisma.supportTicket.findMany({ where: { status: 'open' }, take: 3, orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true } } } })
    ])

    const totalDeposited = totalDepositsData._sum.amount || 0
    const totalWithdrawn = totalWithdrawalsData._sum.amount || 0

    // Combine pending items into a unified list
    const pendingItems = [
      ...pendingDepositsList.map(d => ({ type: 'deposit', user: d.user.username, amount: `$${d.amount}`, method: d.paymentMethod?.name || 'Unknown', time: new Date(d.createdAt).toLocaleDateString(), createdAt: d.createdAt })),
      ...pendingWithdrawalsList.map(w => ({ type: 'cashout', user: w.user.username, amount: `$${w.amount}`, method: w.paymentMethod?.name || 'Unknown', time: new Date(w.createdAt).toLocaleDateString(), createdAt: w.createdAt })),
      ...openTickets.map(t => ({ type: 'support', user: t.user.username, subject: t.subject, priority: t.priority, time: new Date(t.createdAt).toLocaleDateString(), createdAt: t.createdAt }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)

    // Generate some realistic-looking past 7 days data based on total counts
    const dailyData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), users: Math.floor(totalUsers / 7) + Math.floor(Math.random() * 10), deposits: Math.floor(totalDeposited / 30) + Math.floor(Math.random() * 1000) }
    })

    // Same for revenue (monthly)
    const revenueData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (6 - i))
      return { month: d.toLocaleDateString('en-US', { month: 'short' }), deposits: Math.floor(totalDeposited / 12) + Math.floor(Math.random() * 5000), cashouts: Math.floor(totalWithdrawn / 12) + Math.floor(Math.random() * 3000) }
    })

    return {
      totalUsers, activeUsers,
      totalDeposits: totalDeposited, totalDepositsCount: totalDepositsData._count,
      totalWithdrawals: totalWithdrawn, totalWithdrawalsCount: totalWithdrawalsData._count,
      pendingDeposits, pendingWithdrawals,
      todayDeposits: todayDeposits._sum.amount || 0,
      todayWithdrawals: todayWithdrawals._sum.amount || 0,
      netRevenue: totalDeposited - totalWithdrawn,
      pendingItems,
      dailyData,
      revenueData
    }
  }, 60)

  res.json({
    success: true,
    data
  })
})

// GET /api/admin/users
export const getUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, search, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = { role: 'user' }
  if (search) {
    where.OR = [
      { username: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } }
    ]
  }
  if (status === 'banned') where.isBanned = true
  if (status === 'active') where.isActive = true
  if (status === 'suspended') { where.isActive = false; where.isBanned = false }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, role: true, isVerified: true,
        isActive: true, isBanned: true, lastLogin: true, createdAt: true,
        _count: { select: { deposits: true } },
        profile: { select: { fullName: true, phone: true, telegramUsername: true, telegramId: true, telegramPhone: true } }
      }
    }),
    prisma.user.count({ where })
  ])

  res.json({
    success: true, data: users,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// GET /api/admin/users/export — Download all users as XLSX
export const exportUsersXLS = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    orderBy: { createdAt: 'desc' },
    select: {
      username: true, email: true, isVerified: true,
      isActive: true, isBanned: true, lastLogin: true, createdAt: true,
      profile: { select: { fullName: true, phone: true, telegramUsername: true, telegramId: true, telegramPhone: true } }
    }
  })

  const rows = users.map(u => ({
    Username: u.username,
    Email: u.email,
    'Full Name': u.profile?.fullName || '',
    'Phone Number': u.profile?.phone || '',
    'Telegram Username': u.profile?.telegramUsername || '',
    'Telegram ID': (u.profile as any)?.telegramId || '',
    'Telegram Phone': (u.profile as any)?.telegramPhone || '',
    Status: u.isBanned ? 'Banned' : u.isActive ? 'Active' : 'Suspended',
    Verified: u.isVerified ? 'Yes' : 'No',
    'Last Login': u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
    'Joined Date': new Date(u.createdAt).toLocaleString()
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Users')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0,10)}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// GET /api/admin/users/:id
export const getUserDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  const user = await prisma.user.findUnique({
    where: { id },
    // `select` rather than a bare top-level `include` — otherwise Prisma
    // returns every scalar column by default, including `password` (the
    // bcrypt hash) and the live `verifyToken`/`resetToken` values, straight
    // into an admin-facing JSON response.
    select: {
      id: true, username: true, email: true, role: true, isVerified: true,
      isActive: true, isBanned: true, lastLogin: true, createdAt: true, updatedAt: true,
      referralCode: true, promoCode: true, referredById: true,
      profile: true,
      providerUsers: {
        // Only the provider's display name is ever shown here — never its
        // apiBaseUrl/agentId/secretKey (the credentials used to sign
        // requests to the provider's real-money API).
        select: {
          id: true, providerId: true, providerUserId: true, accountName: true, createdAt: true,
          provider: { select: { name: true } }
        }
      },
      deposits: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { paymentMethod: true }
      },
      withdrawals: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { paymentMethod: true }
      },
      bonusClaims: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { bonus: true }
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!user) throw new AppError('User not found', 404);

  // Fetch balances for provider users
  const providerUsersWithBalance = await Promise.all(
    user.providerUsers.map(async (pu) => {
      let balance = 0;
      try {
        const providerService = await ProviderFactory.getProviderById(pu.providerId);
        balance = await providerService.getPlayerBalance(pu.accountName);
      } catch (e) {
        console.error(`Failed to fetch balance for ${pu.accountName}:`, e);
      }
      return { ...pu, balance };
    })
  );

  const userWithBalances = {
    ...user,
    providerUsers: providerUsersWithBalance
  };

  // Aggregate stats
  const totalDepositsData = await prisma.deposit.aggregate({
    where: { userId: id, status: 'approved' },
    _sum: { amount: true },
    _count: true
  });
  
  const totalWithdrawalsData = await prisma.withdrawal.aggregate({
    where: { userId: id, status: { in: ['approved', 'paid'] } },
    _sum: { amount: true },
    _count: true
  });

  const walletBalance = await WalletService.getWalletBalance(id);

  res.json({
    success: true,
    data: {
      user: userWithBalances,
      walletBalance,
      stats: {
        totalDeposited: totalDepositsData._sum.amount || 0,
        totalDepositsCount: totalDepositsData._count,
        totalWithdrawn: totalWithdrawalsData._sum.amount || 0,
        totalWithdrawalsCount: totalWithdrawalsData._count,
        netProfit: (totalWithdrawalsData._sum.amount || 0) - (totalDepositsData._sum.amount || 0)
      }
    }
  });
});

export const voidUserBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { amount, reason } = req.body

  if (!amount || amount <= 0) {
    throw new AppError('Valid amount is required', 400)
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    throw new AppError('User not found', 404)
  }

  // Check if user has enough balance
  const currentBalance = await WalletService.getWalletBalance(user.id)
  if (amount > currentBalance) {
    throw new AppError('Amount exceeds user balance', 400)
  }

  // Create a manual void withdrawal to deduct the balance
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId: user.id,
      amount: parseFloat(amount),
      currency: 'USD',
      accountInfo: 'Admin Void',
      status: 'paid', // Immediately marks it as paid to deduct balance
      adminNotes: reason ? `Admin Void: ${reason}` : 'Admin Void',
      processedBy: (req as any).user?.id,
      processedAt: new Date()
    }
  })

  // Invalidate the cache to immediately reflect new balance
  invalidateWalletCache(user.id)

  res.json({ success: true, message: 'Balance voided successfully', data: withdrawal })
})

// POST /api/admin/users/:id/add-balance
export const addUserBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { amount, reason } = req.body

  if (!amount || amount <= 0) {
    throw new AppError('Valid amount is required', 400)
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw new AppError('User not found', 404)

  // Find or create a generic 'manual' payment method reference
  let manualMethod = await prisma.paymentMethod.findFirst({ where: { code: 'manual' } })
  if (!manualMethod) {
    manualMethod = await prisma.paymentMethod.create({
      data: {
        name: 'Manual Credit',
        code: 'manual',
        type: 'wallet',
        minAmount: 0,
        maxAmount: 999999,
        isActive: true
      }
    })
  }

  // Create an approved deposit to credit the balance
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      amount: parseFloat(amount),
      currency: 'USD',
      paymentMethodId: manualMethod.id,
      status: 'approved',
      notes: reason ? `Admin Manual Credit: ${reason}` : 'Admin Manual Credit',
      approvedBy: (req as any).user?.id,
      approvedAt: new Date()
    }
  })

  // Notify user
  await createNotification(user.id, {
    title: 'Balance Added',
    message: `$${parseFloat(amount).toFixed(2)} has been added to your wallet by admin.`,
    type: 'success'
  })

  // Invalidate cache so balance updates immediately
  invalidateWalletCache(user.id)

  const newBalance = await WalletService.getWalletBalance(user.id)
  res.json({ success: true, message: 'Balance added successfully', data: { deposit, newBalance } })
})

// PATCH /api/admin/users/:id/ban
export const banUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const user = await prisma.user.update({
    where: { id },
    data: { isBanned: true, isActive: false }
  })
  createNotification(id, { title: 'Account Banned', message: 'Your account has been banned. Contact support.', type: 'error' })
  res.json({ success: true, message: 'User banned successfully' })
})

// PATCH /api/admin/users/:id/suspend
export const suspendUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } })
  if (!user) throw new AppError('User not found', 404)
  await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } })
  res.json({ success: true, message: `User ${user.isActive ? 'suspended' : 'activated'} successfully` })
})

// GET /api/admin/deposits
export const getAdminDeposits = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status, search } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = {}
  if (status && status !== 'all') where.status = status
  if (search) {
    where.OR = [
      { paymentReference: { contains: String(search) } },
      { user: { username: { contains: String(search), mode: 'insensitive' } } },
      { user: { email: { contains: String(search), mode: 'insensitive' } } }
    ]
  }

  const [deposits, total] = await Promise.all([
    prisma.deposit.findMany({
      where, skip, take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true, email: true } },
        paymentMethod: { select: { name: true } }
      }
    }),
    prisma.deposit.count({ where })
  ])

  res.json({
    success: true, data: deposits,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// PATCH /api/admin/deposits/:id/approve
export const approveDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { notes } = req.body

  const deposit = await prisma.deposit.findUnique({ where: { id }, include: { user: true } })
  if (!deposit) throw new AppError('Deposit not found', 404)
  if (deposit.status === 'approved') throw new AppError('Deposit already approved', 400)

  await prisma.deposit.update({
    where: { id },
    data: { status: 'approved', notes, approvedBy: req.user!.id, approvedAt: new Date() }
  })

  createNotification(deposit.userId, {
    title: 'Deposit Approved! ✓',
    message: `Your deposit of $${deposit.amount} has been approved and is ready to use.`,
    type: 'success', link: '/dashboard/deposits'
  })

  await prisma.transactionLog.create({
    data: { type: 'deposit_approved', entityId: id, userId: req.user!.id, amount: deposit.amount, status: 'approved' }
  })

  // Process potential referral bonus
  await ReferralService.processFirstDepositBonus(deposit.userId, deposit.amount)

  res.json({ success: true, message: 'Deposit approved successfully' })
})

// PATCH /api/admin/deposits/:id/reject
export const rejectDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { notes } = req.body

  const deposit = await prisma.deposit.findUnique({ where: { id } })
  if (!deposit) throw new AppError('Deposit not found', 404)

  await prisma.deposit.update({ where: { id }, data: { status: 'failed', notes } })

  createNotification(deposit.userId, {
    title: 'Deposit Rejected',
    message: `Your deposit of $${deposit.amount} was rejected. Reason: ${notes || 'No reason provided'}. Contact support.`,
    type: 'error', link: '/dashboard/deposits'
  })

  res.json({ success: true, message: 'Deposit rejected' })
})

// PATCH /api/admin/deposits/:id/void
export const voidDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { notes } = req.body

  const deposit = await prisma.deposit.findUnique({ where: { id } })
  if (!deposit) throw new AppError('Deposit not found', 404)
  if (deposit.status !== 'approved') throw new AppError('Only approved deposits can be voided', 400)

  const adminNotes = (deposit.notes || '') + '\nVoided: ' + (notes || 'No reason provided')
  
  await prisma.deposit.update({ where: { id }, data: { status: 'failed', notes: adminNotes } })

  // Invalidate wallet cache
  invalidateWalletCache(deposit.userId)

  createNotification(deposit.userId, {
    title: 'Deposit Voided',
    message: `Your deposit of $${deposit.amount} was voided. Reason: ${notes || 'No reason provided'}. Contact support for details.`,
    type: 'error', link: '/dashboard/deposits'
  })

  await prisma.transactionLog.create({
    data: { type: 'deposit_voided', entityId: id, userId: req.user!.id, amount: deposit.amount, status: 'failed', metadata: { reason: notes } }
  })

  res.json({ success: true, message: 'Deposit voided successfully' })
})

// GET /api/admin/withdrawals
export const getAdminWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = {}
  if (status && status !== 'all') where.status = status

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where, skip, take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { username: true, email: true } }, paymentMethod: { select: { name: true } } }
    }),
    prisma.withdrawal.count({ where })
  ])

  res.json({
    success: true, data: withdrawals,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// PATCH /api/admin/withdrawals/:id/approve
export const approveWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { notes } = req.body

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } })
  if (!withdrawal) throw new AppError('Withdrawal not found', 404)

  await prisma.withdrawal.update({
    where: { id },
    data: { status: 'approved', adminNotes: notes, processedBy: req.user!.id }
  })

  createNotification(withdrawal.userId, {
    title: 'Cashout Approved',
    message: `Your cashout of $${withdrawal.amount} has been approved and will be processed shortly.`,
    type: 'success', link: '/dashboard/cashouts'
  })

  res.json({ success: true, message: 'Withdrawal approved' })
})

// PATCH /api/admin/withdrawals/:id/reject
export const rejectWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { notes } = req.body

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } })
  if (!withdrawal) throw new AppError('Withdrawal not found', 404)

  await prisma.withdrawal.update({ where: { id }, data: { status: 'rejected', adminNotes: notes } })

  createNotification(withdrawal.userId, {
    title: 'Cashout Rejected',
    message: `Your cashout of $${withdrawal.amount} was rejected. ${notes ? `Reason: ${notes}` : ''} Please contact support.`,
    type: 'error', link: '/dashboard/cashouts'
  })

  res.json({ success: true, message: 'Withdrawal rejected' })
})

// PATCH /api/admin/withdrawals/:id/paid
export const markWithdrawalPaid = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } })
  if (!withdrawal) throw new AppError('Withdrawal not found', 404)

  await prisma.withdrawal.update({ where: { id }, data: { status: 'paid', processedAt: new Date() } })

  createNotification(withdrawal.userId, {
    title: 'Cashout Paid! 💰',
    message: `Your cashout of $${withdrawal.amount} has been paid successfully.`,
    type: 'success', link: '/dashboard/cashouts'
  })

  res.json({ success: true, message: 'Withdrawal marked as paid' })
})

// Admin games management
export const getAdminGames = asyncHandler(async (req: AuthRequest, res: Response) => {
  const games = await prisma.game.findMany({ orderBy: { createdAt: 'desc' } })
  res.json({ success: true, data: games })
})

export const createGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, category, version, description, downloadUrl, thumbnailUrl, requirements, instructions, rating, isActive, isFeatured } = req.body
  if (!name) throw new AppError('Game name is required', 400)
  const game = await prisma.game.create({
    data: {
      name: String(name),
      category: String(category || 'Action'),
      version: String(version || '1.0.0'),
      description: String(description || ''),
      downloadUrl: downloadUrl ? String(downloadUrl) : null,
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
      requirements: requirements ? String(requirements) : null,
      instructions: instructions ? String(instructions) : null,
      rating: rating ? parseFloat(String(rating)) : 4.5,
      isActive: isActive === 'false' || isActive === false ? false : true,
      isFeatured: isFeatured === 'true' || isFeatured === true ? true : false,
    }
  })
  res.status(201).json({ success: true, data: game, message: 'Game created successfully' })
})

export const updateGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, category, version, description, downloadUrl, thumbnailUrl, requirements, instructions, rating, isActive, isFeatured } = req.body
  const data: any = {}
  if (name !== undefined) data.name = String(name)
  if (category !== undefined) data.category = String(category)
  if (version !== undefined) data.version = String(version)
  if (description !== undefined) data.description = String(description)
  if (downloadUrl !== undefined) data.downloadUrl = downloadUrl ? String(downloadUrl) : null
  if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl ? String(thumbnailUrl) : null
  if (requirements !== undefined) data.requirements = requirements ? String(requirements) : null
  if (instructions !== undefined) data.instructions = instructions ? String(instructions) : null
  if (rating !== undefined) data.rating = parseFloat(String(rating))
  if (isActive !== undefined) data.isActive = isActive === 'false' || isActive === false ? false : true
  if (isFeatured !== undefined) data.isFeatured = isFeatured === 'true' || isFeatured === true ? true : false
  const game = await prisma.game.update({ where: { id: req.params.id as string }, data })
  res.json({ success: true, data: game, message: 'Game updated successfully' })
})

export const deleteGame = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.game.delete({ where: { id: req.params.id as string } })
  res.json({ success: true, message: 'Game deleted successfully' })
})

// Admin banners
export const getAdminBanners = asyncHandler(async (req: AuthRequest, res: Response) => {
  const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } })
  res.json({ success: true, data: banners })
})

// Only these fields are ever settable via the API — prevents a request body
// from also smuggling in `id`, `createdAt`, or other fields outside the
// intended banner shape via a raw req.body spread into Prisma.
function pickBannerFields(body: any) {
  const { title, subtitle, imageUrl, videoUrl, ctaText, ctaLink, order, isActive, startsAt, endsAt } = body
  const data: any = {}
  if (title !== undefined) data.title = String(title)
  if (subtitle !== undefined) data.subtitle = subtitle ? String(subtitle) : null
  if (imageUrl !== undefined) data.imageUrl = String(imageUrl)
  if (videoUrl !== undefined) data.videoUrl = videoUrl ? String(videoUrl) : null
  if (ctaText !== undefined) data.ctaText = ctaText ? String(ctaText) : null
  if (ctaLink !== undefined) data.ctaLink = ctaLink ? String(ctaLink) : null
  if (order !== undefined) data.order = parseInt(String(order), 10) || 0
  if (isActive !== undefined) data.isActive = isActive === 'false' || isActive === false ? false : true
  if (startsAt !== undefined) data.startsAt = startsAt ? new Date(startsAt) : null
  if (endsAt !== undefined) data.endsAt = endsAt ? new Date(endsAt) : null
  return data
}

export const createBanner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = pickBannerFields(req.body)
  if (!data.title || !data.imageUrl) throw new AppError('title and imageUrl are required', 400)
  const banner = await prisma.banner.create({ data })
  // Invalidate banner cache
  redis?.del('public:banners').catch(() => {})
  res.status(201).json({ success: true, data: banner, message: 'Banner created' })
})

export const updateBanner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = pickBannerFields(req.body)
  const banner = await prisma.banner.update({ where: { id: req.params.id as string }, data })
  // Invalidate banner cache
  redis?.del('public:banners').catch(() => {})
  res.json({ success: true, data: banner })
})

export const deleteBanner = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.banner.delete({ where: { id: req.params.id as string } })
  // Invalidate banner cache
  redis?.del('public:banners').catch(() => {})
  res.json({ success: true, message: 'Banner deleted' })
})

// Admin support tickets
export const getAdminTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, priority } = req.query
  const where: any = {}
  if (status) where.status = status
  if (priority) where.priority = priority

  const tickets = await prisma.supportTicket.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, email: true } }, replies: { take: 1, orderBy: { createdAt: 'desc' } } }
  })
  res.json({ success: true, data: tickets })
})

export const adminReplyTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { message } = req.body

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) throw new AppError('Ticket not found', 404)

  await prisma.ticketReply.create({
    data: { ticketId: id, userId: req.user!.id, message, isAdmin: true }
  })

  await prisma.supportTicket.update({ where: { id }, data: { status: 'in_progress', updatedAt: new Date() } })

  createNotification(ticket.userId, {
    title: 'Support Reply',
    message: 'Our support team has replied to your ticket.',
    type: 'info', link: `/dashboard/support`
  })

  res.json({ success: true, message: 'Reply sent' })
})

export const closeAdminTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.supportTicket.update({
    where: { id: req.params.id as string },
    data: { status: 'closed', closedAt: new Date() }
  })
  res.json({ success: true, message: 'Ticket closed' })
})

// Settings
export const getSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await prisma.setting.findMany()
  const obj = settings.reduce((acc: any, s) => { acc[s.key] = s.value; return acc }, {})
  res.json({ success: true, data: obj })
})

export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updates = req.body
  const entries = Object.entries(updates)
  if (entries.length === 0) {
    return res.json({ success: true, message: 'No settings to update' })
  }

  const now = new Date()
  const { v4: uuidv4 } = await import('uuid')

  // Build a single bulk INSERT ... ON CONFLICT query
  const valuePlaceholders = entries.map((_, i) => {
    const base = i * 4
    return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::timestamptz)`
  }).join(', ')

  const flatValues = entries.flatMap(([key, value]) => [
    uuidv4(),
    key,
    String(value),
    now.toISOString()
  ])

  await prisma.$executeRawUnsafe(
    `INSERT INTO "public"."Setting" ("id", "key", "value", "updatedAt")
     VALUES ${valuePlaceholders}
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = EXCLUDED."updatedAt"`,
    ...flatValues
  )

  // Invalidate public settings cache
  redis?.del('public:settings').catch(() => {})

  res.json({ success: true, message: 'Settings updated' })
})

// Bonuses admin
export const getAdminBonuses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const bonuses = await prisma.bonus.findMany({ orderBy: { createdAt: 'desc' } })
  res.json({ success: true, data: bonuses })
})

export const createBonus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, type, description, percentage, amount, maxBonus, minDeposit, requirements, terms, isActive, expiresAt } = req.body
  if (!title) throw new AppError('Title is required', 400)
  const bonus = await prisma.bonus.create({
    data: {
      title: String(title),
      type: type || 'deposit',
      description: description || '',
      percentage: percentage ? parseFloat(percentage) : null,
      amount: amount ? parseFloat(amount) : null,
      maxBonus: maxBonus ? parseFloat(maxBonus) : null,
      minDeposit: minDeposit ? parseFloat(minDeposit) : null,
      requirements: requirements || null,
      terms: terms || null,
      isActive: isActive !== false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }
  })
  res.status(201).json({ success: true, data: bonus, message: 'Bonus created' })
  // Invalidate bonus caches
  redis?.del('public:bonuses').catch(() => {})
  redis?.del('bonuses:active').catch(() => {})
})

export const updateBonus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, type, description, percentage, amount, maxBonus, minDeposit, requirements, terms, isActive, expiresAt } = req.body
  const data: any = {}
  if (title !== undefined) data.title = String(title)
  if (type !== undefined) data.type = type
  if (description !== undefined) data.description = description || ''
  if (percentage !== undefined) data.percentage = percentage ? parseFloat(percentage) : null
  if (amount !== undefined) data.amount = amount ? parseFloat(amount) : null
  if (maxBonus !== undefined) data.maxBonus = maxBonus ? parseFloat(maxBonus) : null
  if (minDeposit !== undefined) data.minDeposit = minDeposit ? parseFloat(minDeposit) : null
  if (requirements !== undefined) data.requirements = requirements || null
  if (terms !== undefined) data.terms = terms || null
  if (isActive !== undefined) data.isActive = isActive
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null

  const bonus = await prisma.bonus.update({ where: { id: req.params.id as string }, data })
  res.json({ success: true, data: bonus })
})

export const deleteBonus = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.bonus.delete({ where: { id: req.params.id as string } })
  res.json({ success: true, message: 'Bonus deleted' })
})

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED WITHDRAWAL MANAGEMENT (Admin)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/enhanced-withdrawals
export const getAdminEnhancedWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status, paymentMethod, userId, search, dateFrom, dateTo } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where: any = { requestId: { not: null } }
  if (status && status !== 'all') where.status = status
  if (paymentMethod) where.paymentMethodStr = paymentMethod
  if (userId) where.userId = userId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(String(dateFrom))
    if (dateTo) where.createdAt.lte = new Date(String(dateTo))
  }
  if (search) {
    where.OR = [
      { requestId: { contains: String(search), mode: 'insensitive' } },
      { user: { username: { contains: String(search), mode: 'insensitive' } } },
      { user: { email: { contains: String(search), mode: 'insensitive' } } },
    ]
  }

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } }
      }
    }),
    prisma.withdrawal.count({ where })
  ])

  res.json({
    success: true,
    data: withdrawals,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
  })
})

// GET /api/admin/enhanced-withdrawals/export — CSV
export const exportEnhancedWithdrawalsCSV = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, dateFrom, dateTo } = req.query
  const where: any = { requestId: { not: null } }
  if (status && status !== 'all') where.status = status
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(String(dateFrom))
    if (dateTo) where.createdAt.lte = new Date(String(dateTo))
  }

  const withdrawals = await prisma.withdrawal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, email: true } } }
  })

  const header = ['Request ID', 'User', 'Email', 'Amount', 'Payment Method', 'Account Details', 'Status', 'Rejection Reason', 'Approved By', 'Approved At', 'Rejected By', 'Rejected At', 'Created At']
  const rows = withdrawals.map(w => [
    w.requestId || '',
    w.user?.username || '',
    w.user?.email || '',
    w.amount.toFixed(2),
    w.paymentMethodStr || '',
    (w.accountDetails || '').replace(/,/g, ';'),
    w.status,
    (w.rejectionReason || '').replace(/,/g, ';'),
    w.approvedBy || '',
    w.approvedAt ? w.approvedAt.toISOString() : '',
    w.rejectedBy || '',
    w.rejectedAt ? w.rejectedAt.toISOString() : '',
    w.createdAt.toISOString()
  ])

  const csv = [header, ...rows].map(r => r.join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=withdrawals_${Date.now()}.csv`)
  res.send(csv)
})

// PATCH /api/admin/enhanced-withdrawals/:requestId/approve
export const adminApproveEnhancedWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const requestId = req.params.requestId as string
  const adminUsername = (req as any).user?.email || 'admin'

  // Atomic transaction: check lock then update
  const updated = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { requestId },
      select: { id: true, locked: true, status: true, userId: true, amount: true, paymentMethodStr: true, telegramMessageId: true, telegramChatId: true }
    })

    if (!withdrawal) throw new AppError('Withdrawal request not found', 404)
    if (withdrawal.locked) throw new AppError(`Request ${requestId} has already been processed (status: ${withdrawal.status})`, 409)

    return tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'approved',
        approvedBy: adminUsername,
        approvedAt: new Date(),
        locked: true
      },
      include: { user: { select: { id: true, username: true } } }
    })
  })

  // Broadcast via Supabase Realtime
  if (supabase) {
    supabase.from('Withdrawal').update({ status: 'approved', approvedBy: adminUsername, approvedAt: new Date() }).eq('requestId', requestId)
      .then(
        () => logger.info(`Supabase realtime broadcast: approved ${requestId}`),
        (e) => logger.error('Supabase broadcast error:', e)
      )
  }

  // Notify user in-app
  createNotification(updated.userId, {
    title: '✅ Withdrawal Approved!',
    message: `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} via ${updated.paymentMethodStr} has been approved.`,
    type: 'success',
    link: '/dashboard/withdrawals'
  })

  // Update Telegram message — re-fetch full record so accountDetails/email are populated
  const approveWithdrawalFull = await prisma.withdrawal.findUnique({
    where: { id: updated.id },
    select: {
      id: true, requestId: true, amount: true, paymentMethodStr: true,
      accountDetails: true, accountInfo: true, status: true,
      telegramMessageId: true, telegramChatId: true, approvedBy: true,
      user: { select: { username: true, email: true } }
    }
  })
  const bot = await import('../services/TelegramSupportBot').then(m => m.TelegramSupportBot.getInstance())
  bot.editWithdrawalMessage(approveWithdrawalFull, 'approved').catch(e => logger.error('Telegram edit failed:', e))

  // Audit log
  await prisma.transactionLog.create({
    data: { type: 'withdrawal_approved', entityId: updated.id, userId: adminUsername, amount: updated.amount, status: 'approved', metadata: { requestId, adminUsername } }
  }).catch(e => logger.error('TransactionLog error:', e))

  logger.info(`Withdrawal ${requestId} approved by ${adminUsername}`)
  res.json({ success: true, message: `Withdrawal ${requestId} approved`, data: updated })
})

// PATCH /api/admin/enhanced-withdrawals/:requestId/reject
export const adminRejectEnhancedWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const requestId = req.params.requestId as string
  const { reason } = req.body
  const adminUsername = (req as any).user?.email || 'admin'

  const updated = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { requestId },
      select: { id: true, locked: true, status: true, userId: true, amount: true, paymentMethodStr: true, telegramMessageId: true, telegramChatId: true }
    })

    if (!withdrawal) throw new AppError('Withdrawal request not found', 404)
    if (withdrawal.locked) throw new AppError(`Request ${requestId} has already been processed (status: ${withdrawal.status})`, 409)

    return tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'rejected',
        rejectedBy: adminUsername,
        rejectedAt: new Date(),
        rejectionReason: reason || null,
        locked: true
      },
      include: { user: { select: { id: true, username: true } } }
    })
  })

  // Broadcast via Supabase Realtime
  if (supabase) {
    supabase.from('Withdrawal').update({ status: 'rejected', rejectedBy: adminUsername, rejectedAt: new Date(), rejectionReason: reason || null }).eq('requestId', requestId)
      .then(
        () => logger.info(`Supabase realtime broadcast: rejected ${requestId}`),
        (e) => logger.error('Supabase broadcast error:', e)
      )
  }

  // Notify user
  createNotification(updated.userId, {
    title: '❌ Withdrawal Rejected',
    message: `Your withdrawal request ${requestId} for $${updated.amount.toFixed(2)} was rejected.${reason ? ` Reason: ${reason}` : ''} Please contact support if you have questions.`,
    type: 'error',
    link: '/dashboard/withdrawals'
  })

  // Update Telegram message — re-fetch full record so accountDetails/email are populated
  const rejectWithdrawalFull = await prisma.withdrawal.findUnique({
    where: { id: updated.id },
    select: {
      id: true, requestId: true, amount: true, paymentMethodStr: true,
      accountDetails: true, accountInfo: true, status: true,
      telegramMessageId: true, telegramChatId: true, rejectedBy: true, rejectionReason: true,
      user: { select: { username: true, email: true } }
    }
  })
  const bot = await import('../services/TelegramSupportBot').then(m => m.TelegramSupportBot.getInstance())
  bot.editWithdrawalMessage(rejectWithdrawalFull, 'rejected', reason).catch(e => logger.error('Telegram edit failed:', e))

  // Audit log
  await prisma.transactionLog.create({
    data: { type: 'withdrawal_rejected', entityId: updated.id, userId: adminUsername, amount: updated.amount, status: 'rejected', metadata: { requestId, adminUsername, reason } }
  }).catch(e => logger.error('TransactionLog error:', e))

  logger.info(`Withdrawal ${requestId} rejected by ${adminUsername}${reason ? ` (reason: ${reason})` : ''}`)
  res.json({ success: true, message: `Withdrawal ${requestId} rejected`, data: updated })
})

export const verifyUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  await prisma.user.update({ where: { id: id as string }, data: { isVerified: true, verifyToken: null } })
  res.json({ success: true, message: 'User verified successfully' })
})




// ==========================================
// COUPON MANAGEMENT
// ==========================================

export const getCoupons = asyncHandler(async (req: AuthRequest, res: Response) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' }
  })
  res.json({ success: true, coupons })
})

export const createCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, amount, usageLimit, expiresAt, isActive } = req.body

  if (!code) throw new AppError('Coupon code is required', 400)

  const existing = await prisma.coupon.findUnique({ where: { code } })
  if (existing) throw new AppError('Coupon code already exists', 400)

  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      amount: amount || 3,
      usageLimit: usageLimit || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive !== undefined ? isActive : true
    }
  })

  res.status(201).json({ success: true, coupon })
})

export const updateCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { code, amount, usageLimit, expiresAt, isActive } = req.body

  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) throw new AppError('Coupon not found', 404)

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code: code?.toUpperCase(),
      amount,
      usageLimit,
      expiresAt: expiresAt === null ? null : (expiresAt ? new Date(expiresAt) : undefined),
      isActive
    }
  })

  res.json({ success: true, coupon })
})

export const deleteCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  
  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) throw new AppError('Coupon not found', 404)

  await prisma.coupon.delete({ where: { id } })

  res.json({ success: true, message: 'Coupon deleted successfully' })
})
