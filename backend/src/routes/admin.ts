import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { limit } from '../middleware/security'
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
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getAdminBonusCashoutRules, createBonusCashoutRule, updateBonusCashoutRule, deleteBonusCashoutRule,
  getAdminUserBonuses, getAdminBonusTransactions, getAdminBonusConversions, getAdminSundayFreeplayClaims, getAdminWalletTransactions,
  getUserSundayFreeplayStatus, grantUserSundayFreeplay
} from '../controllers/adminController'
import { listPaymentMethods, createPaymentMethod, updatePaymentMethod, togglePaymentMethod, setPaymentMethodAvailability, deletePaymentMethod } from '../controllers/paymentMethodAdminController'
import {
  getProviders, createProvider, updateProvider, deleteProvider,
  testConnection, getProviderLogs, getProviderTransactions, assignGamesToProvider,
  getGameBalanceReport, getLiveGameBalance, exportGameBalanceReport, getProviderAgentBalances,
  getUnresolvedProviderTransactions, resolveProviderTransaction
} from '../controllers/providerAdminController'

const router = Router()

router.use(authenticate, requireAdmin)
router.use(limit({ name: 'admin', windowMs: 15 * 60_000, max: 3000, scope: 'user' }))

// Dashboard
router.get('/stats', getDashboardStats)

// Users
// Heavy admin operations (full-table exports, live provider API fan-out) get their own per-admin ceiling
router.get('/users/export', limit({ name: 'admin-export-users', windowMs: 600000, max: 10, scope: 'user' }), exportUsersXLS)
router.get('/users', getUsers)
router.get('/users/:id', getUserDetails)
router.patch('/users/:id/ban', banUser)
router.patch('/users/:id/suspend', suspendUser)
router.patch('/users/:id/verify', verifyUser)
router.post('/users/:id/void-balance', voidUserBalance)
router.post('/users/:id/add-balance', addUserBalance)
router.get('/users/:id/sunday-freeplay', getUserSundayFreeplayStatus)
router.post('/users/:id/sunday-freeplay', grantUserSundayFreeplay)

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
router.get('/enhanced-withdrawals/export', limit({ name: 'admin-export-withdrawals', windowMs: 600000, max: 10, scope: 'user' }), exportEnhancedWithdrawalsCSV)
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
// FIN-7: manual reconciliation for transfers stuck in pending/unknown (an ambiguous provider outcome)
router.get('/provider-transactions/unresolved', getUnresolvedProviderTransactions)
router.patch('/provider-transactions/:id/resolve', resolveProviderTransaction)

// Game Balance Report — points added/withdrawn per user+game, over a
// selectable window (8h/24h/all-time), plus on-demand live balance and
// Excel export. Declared before any conflicting param routes wouldn't be
// needed here since none of these paths overlap with a `:id` pattern.
router.get('/game-balance-report', getGameBalanceReport)
router.get('/game-balance-report/live-balance', limit({ name: 'admin-live-balance', windowMs: 60000, max: 20, scope: 'user' }), getLiveGameBalance)
router.get('/game-balance-report/export', limit({ name: 'admin-export-balance', windowMs: 600000, max: 10, scope: 'user' }), exportGameBalanceReport)
router.get('/game-balance-report/provider-balances', limit({ name: 'admin-provider-balances', windowMs: 60000, max: 20, scope: 'user' }), getProviderAgentBalances)

// Coupons
router.get('/coupons', getCoupons)
router.post('/coupons', createCoupon)
router.put('/coupons/:id', updateCoupon)
router.delete('/coupons/:id', deleteCoupon)

// Bonus Cashout Rules (Bonus Balance system)
router.get('/bonus-cashout-rules', getAdminBonusCashoutRules)
router.post('/bonus-cashout-rules', createBonusCashoutRule)
router.put('/bonus-cashout-rules/:id', updateBonusCashoutRule)
router.delete('/bonus-cashout-rules/:id', deleteBonusCashoutRule)

// Bonus Balance reporting (read-only)
router.get('/user-bonuses', getAdminUserBonuses)
router.get('/bonus-transactions', getAdminBonusTransactions)
router.get('/bonus-conversions', getAdminBonusConversions)
router.get('/sunday-freeplay-claims', getAdminSundayFreeplayClaims)
router.get('/wallet-transactions', getAdminWalletTransactions)

// Payment Methods
router.get('/payment-methods', listPaymentMethods)
router.post('/payment-methods', createPaymentMethod)
router.put('/payment-methods/:id', updatePaymentMethod)
router.patch('/payment-methods/:id/toggle', togglePaymentMethod)
router.patch('/payment-methods/:id/availability', setPaymentMethodAvailability)
router.delete('/payment-methods/:id', deletePaymentMethod)

export default router
