import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  getDashboardStats, getUsers, banUser, suspendUser, verifyUser,
  getAdminDeposits, approveDeposit, rejectDeposit, voidDeposit,
  getAdminWithdrawals, approveWithdrawal, rejectWithdrawal, markWithdrawalPaid,
  getAdminGames, createGame, updateGame, deleteGame,
  getAdminBanners, createBanner, updateBanner, deleteBanner,
  getAdminTickets, adminReplyTicket, closeAdminTicket,
  getSettings, updateSettings,
  getAdminBonuses, createBonus, updateBonus, deleteBonus,
  getAdminEnhancedWithdrawals, exportEnhancedWithdrawalsCSV,
  adminApproveEnhancedWithdrawal, adminRejectEnhancedWithdrawal,
  getUserDetails, voidUserBalance, addUserBalance, exportUsersXLS,
  getCoupons, createCoupon, updateCoupon, deleteCoupon
} from '../controllers/adminController'
import {
  getProviders, createProvider, updateProvider, deleteProvider,
  testConnection, getProviderLogs, getProviderTransactions, assignGamesToProvider,
  getGameBalanceReport, getLiveGameBalance, exportGameBalanceReport, getProviderAgentBalances
} from '../controllers/providerAdminController'

const router = Router()

router.use(authenticate, requireAdmin)

// Dashboard
router.get('/stats', getDashboardStats)

// Users
router.get('/users/export', exportUsersXLS)
router.get('/users', getUsers)
router.get('/users/:id', getUserDetails)
router.patch('/users/:id/ban', banUser)
router.patch('/users/:id/suspend', suspendUser)
router.patch('/users/:id/verify', verifyUser)
router.post('/users/:id/void-balance', voidUserBalance)
router.post('/users/:id/add-balance', addUserBalance)

// Deposits
router.get('/deposits', getAdminDeposits)
router.patch('/deposits/:id/approve', approveDeposit)
router.patch('/deposits/:id/reject', rejectDeposit)
router.patch('/deposits/:id/void', voidDeposit)

// Withdrawals (legacy)
router.get('/withdrawals', getAdminWithdrawals)
router.patch('/withdrawals/:id/approve', approveWithdrawal)
router.patch('/withdrawals/:id/reject', rejectWithdrawal)
router.patch('/withdrawals/:id/paid', markWithdrawalPaid)

// Enhanced Withdrawals (new module — order matters: export before :requestId)
router.get('/enhanced-withdrawals/export', exportEnhancedWithdrawalsCSV)
router.get('/enhanced-withdrawals', getAdminEnhancedWithdrawals)
router.patch('/enhanced-withdrawals/:requestId/approve', adminApproveEnhancedWithdrawal)
router.patch('/enhanced-withdrawals/:requestId/reject', adminRejectEnhancedWithdrawal)

// Games
router.get('/games', getAdminGames)
router.post('/games', createGame)
router.put('/games/:id', updateGame)
router.delete('/games/:id', deleteGame)

// Banners
router.get('/banners', getAdminBanners)
router.post('/banners', createBanner)
router.put('/banners/:id', updateBanner)
router.delete('/banners/:id', deleteBanner)

// Support
router.get('/support', getAdminTickets)
router.post('/support/:id/reply', adminReplyTicket)
router.patch('/support/:id/close', closeAdminTicket)

// Bonuses
router.get('/bonuses', getAdminBonuses)
router.post('/bonuses', createBonus)
router.put('/bonuses/:id', updateBonus)
router.delete('/bonuses/:id', deleteBonus)

// Settings
router.get('/settings', getSettings)
router.put('/settings', updateSettings)

// Providers
router.get('/providers', getProviders)
router.post('/providers', createProvider)
router.put('/providers/:id', updateProvider)
router.delete('/providers/:id', deleteProvider)
router.post('/providers/:id/test', testConnection)
router.put('/providers/:id/games', assignGamesToProvider)
router.get('/provider-logs', getProviderLogs)
router.get('/provider-transactions', getProviderTransactions)

// Game Balance Report — points added/withdrawn per user+game, over a
// selectable window (8h/24h/all-time), plus on-demand live balance and
// Excel export. Declared before any conflicting param routes wouldn't be
// needed here since none of these paths overlap with a `:id` pattern.
router.get('/game-balance-report', getGameBalanceReport)
router.get('/game-balance-report/live-balance', getLiveGameBalance)
router.get('/game-balance-report/export', exportGameBalanceReport)
router.get('/game-balance-report/provider-balances', getProviderAgentBalances)

// Coupons
router.get('/coupons', getCoupons)
router.post('/coupons', createCoupon)
router.put('/coupons/:id', updateCoupon)
router.delete('/coupons/:id', deleteCoupon)

// Payment Methods
router.get('/payment-methods', async (req, res) => {
  try {
    const prisma = (await import('../lib/prisma')).default
    const methods = await prisma.paymentMethod.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ success: true, data: methods })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message })
  }
})
router.post('/payment-methods', async (req, res) => {
  try {
    const prisma = (await import('../lib/prisma')).default
    const { name, code, type, minAmount, maxAmount, feePercent, instructions, isActive, cashoutEnabled } = req.body
    if (!name || !code || !type) {
      res.status(400).json({ success: false, message: 'name, code, type required' })
      return
    }
    const method = await prisma.paymentMethod.create({
      data: { name, code: code.toLowerCase(), type, minAmount: minAmount ?? 10, maxAmount: maxAmount ?? 10000, feePercent: feePercent ?? 0, instructions: instructions || '', isActive: isActive ?? true, cashoutEnabled: cashoutEnabled ?? false }
    })
    res.json({ success: true, data: method })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})
router.put('/payment-methods/:id', async (req, res) => {
  try {
    const prisma = (await import('../lib/prisma')).default
    const { name, minAmount, maxAmount, feePercent, instructions, isActive, cashoutEnabled } = req.body
    const method = await prisma.paymentMethod.update({
      where: { id: req.params.id },
      data: { name, minAmount, maxAmount, feePercent, instructions, isActive, cashoutEnabled }
    })
    res.json({ success: true, data: method })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})
router.patch('/payment-methods/:id/toggle', async (req, res) => {
  try {
    const prisma = (await import('../lib/prisma')).default
    const existing = await prisma.paymentMethod.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      res.status(404).json({ success: false, message: 'Not found' })
      return
    }
    const method = await prisma.paymentMethod.update({ where: { id: req.params.id }, data: { isActive: !existing.isActive } })
    res.json({ success: true, data: method })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})
router.delete('/payment-methods/:id', async (req, res) => {
  try {
    const prisma = (await import('../lib/prisma')).default
    await prisma.paymentMethod.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})

export default router
