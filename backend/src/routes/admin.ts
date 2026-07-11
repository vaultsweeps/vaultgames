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
  getUserDetails, voidUserBalance
} from '../controllers/adminController'
import {
  getProviders, createProvider, updateProvider, deleteProvider,
  testConnection, getProviderLogs, getProviderTransactions, assignGamesToProvider
} from '../controllers/providerAdminController'

const router = Router()

router.use(authenticate, requireAdmin)

// Dashboard
router.get('/stats', getDashboardStats)

// Users
router.get('/users', getUsers)
router.get('/users/:id', getUserDetails)
router.patch('/users/:id/ban', banUser)
router.patch('/users/:id/suspend', suspendUser)
router.patch('/users/:id/verify', verifyUser)
router.post('/users/:id/void-balance', voidUserBalance)

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

export default router
