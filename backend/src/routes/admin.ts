import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  getDashboardStats, getUsers, banUser, suspendUser,
  getAdminDeposits, approveDeposit, rejectDeposit,
  getAdminWithdrawals, approveWithdrawal, rejectWithdrawal, markWithdrawalPaid,
  getAdminGames, createGame, updateGame, deleteGame,
  getAdminBanners, createBanner, updateBanner, deleteBanner,
  getAdminTickets, adminReplyTicket, closeAdminTicket,
  getSettings, updateSettings,
  getAdminBonuses, createBonus, updateBonus, deleteBonus,
} from '../controllers/adminController'

const router = Router()

router.use(authenticate, requireAdmin)

// Dashboard
router.get('/stats', getDashboardStats)

// Users
router.get('/users', getUsers)
router.patch('/users/:id/ban', banUser)
router.patch('/users/:id/suspend', suspendUser)

// Deposits
router.get('/deposits', getAdminDeposits)
router.patch('/deposits/:id/approve', approveDeposit)
router.patch('/deposits/:id/reject', rejectDeposit)

// Withdrawals
router.get('/withdrawals', getAdminWithdrawals)
router.patch('/withdrawals/:id/approve', approveWithdrawal)
router.patch('/withdrawals/:id/reject', rejectWithdrawal)
router.patch('/withdrawals/:id/paid', markWithdrawalPaid)

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

export default router
