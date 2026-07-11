import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Request deduplication cache for GET requests
const pendingRequests = new Map<string, Promise<any>>()
const originalGet = apiClient.get

apiClient.get = async function (url: string, config?: AxiosRequestConfig) {
  const key = `${url}_${JSON.stringify(config?.params || {})}`
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }

  const promise = originalGet.call(this, url, config).finally(() => {
    // Micro-cache: Keep the promise around for 500ms to deduplicate rapid successive calls
    setTimeout(() => {
      pendingRequests.delete(key)
    }, 500)
  })
  
  pendingRequests.set(key, promise)
  return promise
}

// Request interceptor - attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get('vaultsweeps_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('vaultsweeps_token')
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient

// Auth APIs
export const authApi = {
  login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
  register: (data: object) => apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  verifyEmail: (token: string) => apiClient.post(`/auth/verify-email/${token}`),
  resendVerification: () => apiClient.post('/auth/resend-verification'),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => apiClient.post(`/auth/reset-password/${token}`, { password }),
  getMe: () => apiClient.get('/auth/me'),
  refreshToken: () => apiClient.post('/auth/refresh'),
  getBalance: () => apiClient.get('/auth/balance'),
  /** Single bundled request: returns user + wallet balance + provider account */
  dashboardInit: (gameId?: string) => apiClient.get('/auth/dashboard-init', { params: gameId ? { gameId } : {} }),
}

// Deposit APIs
export const depositApi = {
  create: (data: object) => apiClient.post('/deposits', data),
  getAll: (params?: object) => apiClient.get('/deposits', { params }),
  getOne: (id: string) => apiClient.get(`/deposits/${id}`),
  getPaymentMethods: () => apiClient.get('/deposits/payment-methods'),
  initiatePayment: (id: string) => apiClient.post(`/deposits/${id}/initiate`),
}

// Withdrawal APIs
export const withdrawalApi = {
  create: (data: object) => apiClient.post('/withdrawals', data),
  getAll: (params?: object) => apiClient.get('/withdrawals', { params }),
  getOne: (id: string) => apiClient.get(`/withdrawals/${id}`),
  manualCashout: (file: FormData) => apiClient.post('/withdrawals/manual', file, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}

// Games APIs
export const gamesApi = {
  getAll: (params?: object) => apiClient.get('/games', { params }),
  getOne: (id: string) => apiClient.get(`/games/${id}`),
  download: (id: string) => apiClient.post(`/games/${id}/download`),
}

// Bonuses APIs
export const bonusesApi = {
  getAll: (params?: object) => apiClient.get('/bonuses', { params }),
  getOne: (id: string) => apiClient.get(`/bonuses/${id}`),
  claim: (id: string) => apiClient.post(`/bonuses/${id}/claim`),
}

// Support APIs
export const supportApi = {
  create: (data: object) => apiClient.post('/support', data),
  getAll: (params?: object) => apiClient.get('/support', { params }),
  getOne: (id: string) => apiClient.get(`/support/${id}`),
  reply: (id: string, message: string) => apiClient.post(`/support/${id}/reply`, { message }),
  close: (id: string) => apiClient.patch(`/support/${id}/close`),
}

// Notifications APIs
export const notificationsApi = {
  getAll: (params?: object) => apiClient.get('/notifications', { params }),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
}

// Profile APIs
export const profileApi = {
  update: (data: object) => apiClient.put('/profile', data),
  changePassword: (data: object) => apiClient.put('/profile/password', data),
  uploadAvatar: (file: FormData) => apiClient.post('/profile/avatar', file, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}

// Provider APIs
export const providerApi = {
  getAccount: (gameId?: string) => apiClient.get('/provider/account', { params: gameId ? { gameId } : {} }),
  createAccount: (gameId?: string) => apiClient.post('/provider/create-account', {}, { params: gameId ? { gameId } : {} }),
  resetPassword: (gameId?: string) => apiClient.post('/provider/reset-password', {}, { params: gameId ? { gameId } : {} }),
  getTransactions: (gameId?: string) => apiClient.get('/provider/transactions', { params: gameId ? { gameId } : {} }),
  transfer: (data: { gameId: string, amount: number, type: 'recharge' | 'withdraw' }) => apiClient.post('/provider/transfer', data),
  getAllAccounts: () => apiClient.get('/provider/accounts'),
}

// Public APIs (no auth required)
export const publicApi = {
  getBanners: () => apiClient.get('/public/banners'),
  getFeaturedGames: () => apiClient.get('/public/games/featured'),
  getGameDetails: (id: string) => apiClient.get(`/public/games/${id}`),
  getBonuses: () => apiClient.get('/public/bonuses'),
  getFAQs: () => apiClient.get('/public/faqs'),
  getStats: () => apiClient.get('/public/stats'),
  getAnnouncements: () => apiClient.get('/public/announcements'),
  sendContact: (data: object) => apiClient.post('/public/contact', data),
  getSettings: () => apiClient.get('/public/settings'),
}

// Admin APIs
export const adminApi = {
  // Dashboard
  getDashboardStats: () => apiClient.get('/admin/stats'),
  getRevenueChart: (period: string) => apiClient.get(`/admin/charts/revenue?period=${period}`),

  // Users
  getUsers: (params?: object) => apiClient.get('/admin/users', { params }),
  getUserDetails: (id: string) => apiClient.get(`/admin/users/${id}`),
  updateUser: (id: string, data: object) => apiClient.put(`/admin/users/${id}`, data),
  suspendUser: (id: string) => apiClient.patch(`/admin/users/${id}/suspend`),
  banUser: (id: string) => apiClient.patch(`/admin/users/${id}/ban`),
  verifyUser: (id: string) => apiClient.patch(`/admin/users/${id}/verify`),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  voidUserBalance: (id: string, data: { amount: number, reason?: string }) => apiClient.post(`/admin/users/${id}/void-balance`, data),

  // Deposits
  getDeposits: (params?: object) => apiClient.get('/admin/deposits', { params }),
  approveDeposit: (id: string, notes?: string) => apiClient.patch(`/admin/deposits/${id}/approve`, { notes }),
  rejectDeposit: (id: string, notes?: string) => apiClient.patch(`/admin/deposits/${id}/reject`, { notes }),
  voidDeposit: (id: string, notes?: string) => apiClient.patch(`/admin/deposits/${id}/void`, { notes }),

  // Withdrawals
  getWithdrawals: (params?: object) => apiClient.get('/admin/withdrawals', { params }),
  approveWithdrawal: (id: string, notes?: string) => apiClient.patch(`/admin/withdrawals/${id}/approve`, { notes }),
  rejectWithdrawal: (id: string, notes?: string) => apiClient.patch(`/admin/withdrawals/${id}/reject`, { notes }),
  markWithdrawalPaid: (id: string) => apiClient.patch(`/admin/withdrawals/${id}/paid`),

  // Games
  getGames: (params?: object) => apiClient.get('/admin/games', { params }),
  createGame: (data: object) => apiClient.post('/admin/games', data),
  updateGame: (id: string, data: object) => apiClient.put(`/admin/games/${id}`, data),
  deleteGame: (id: string) => apiClient.delete(`/admin/games/${id}`),

  // Bonuses
  getBonuses: (params?: object) => apiClient.get('/admin/bonuses', { params }),
  createBonus: (data: object) => apiClient.post('/admin/bonuses', data),
  updateBonus: (id: string, data: object) => apiClient.put(`/admin/bonuses/${id}`, data),
  deleteBonus: (id: string) => apiClient.delete(`/admin/bonuses/${id}`),

  // Banners
  getBanners: (params?: object) => apiClient.get('/admin/banners', { params }),
  createBanner: (data: object | FormData) => apiClient.post('/admin/banners', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
  }),
  updateBanner: (id: string, data: object) => apiClient.put(`/admin/banners/${id}`, data),
  deleteBanner: (id: string) => apiClient.delete(`/admin/banners/${id}`),

  // Support
  getTickets: (params?: object) => apiClient.get('/admin/support', { params }),
  replyTicket: (id: string, message: string) => apiClient.post(`/admin/support/${id}/reply`, { message }),
  closeTicket: (id: string) => apiClient.patch(`/admin/support/${id}/close`),
  updateTicketPriority: (id: string, priority: string) => apiClient.patch(`/admin/support/${id}/priority`, { priority }),

  // Payment Methods
  getPaymentMethods: () => apiClient.get('/admin/payment-methods'),
  createPaymentMethod: (data: object) => apiClient.post('/admin/payment-methods', data),
  updatePaymentMethod: (id: string, data: object) => apiClient.put(`/admin/payment-methods/${id}`, data),
  deletePaymentMethod: (id: string) => apiClient.delete(`/admin/payment-methods/${id}`),

  // Settings & CMS
  getSettings: () => apiClient.get('/admin/settings'),
  updateSettings: (data: object) => apiClient.put('/admin/settings', data, { timeout: 60000 }),
  getFAQs: () => apiClient.get('/admin/faqs'),
  createFAQ: (data: object) => apiClient.post('/admin/faqs', data),
  updateFAQ: (id: string, data: object) => apiClient.put(`/admin/faqs/${id}`, data),
  deleteFAQ: (id: string) => apiClient.delete(`/admin/faqs/${id}`),

  // Reports
  exportReport: (type: string, params?: object) => apiClient.get(`/admin/reports/${type}`, { params, responseType: 'blob' }),

  // Providers
  getProviders: () => apiClient.get('/admin/providers'),
  createProvider: (data: object) => apiClient.post('/admin/providers', data),
  updateProvider: (id: string, data: object) => apiClient.put(`/admin/providers/${id}`, data),
  deleteProvider: (id: string) => apiClient.delete(`/admin/providers/${id}`),
  testProviderConnection: (id: string) => apiClient.post(`/admin/providers/${id}/test`),
  assignProviderGames: (id: string, gameIds: string[]) => apiClient.put(`/admin/providers/${id}/games`, { gameIds }),
  getProviderLogs: (params?: object) => apiClient.get('/admin/provider-logs', { params }),
  getProviderTransactions: (params?: object) => apiClient.get('/admin/provider-transactions', { params }),

  // Enhanced Withdrawals (admin)
  getEnhancedWithdrawals: (params?: object) => apiClient.get('/admin/enhanced-withdrawals', { params }),
  approveEnhancedWithdrawal: (requestId: string, reason?: string) => apiClient.patch(`/admin/enhanced-withdrawals/${requestId}/approve`, { reason }),
  rejectEnhancedWithdrawal: (requestId: string, reason?: string) => apiClient.patch(`/admin/enhanced-withdrawals/${requestId}/reject`, { reason }),
  exportEnhancedWithdrawalsCSV: (params?: object) => apiClient.get('/admin/enhanced-withdrawals/export', { params, responseType: 'blob' }),
}

// ─── User Enhanced Withdrawal APIs ──────────────────────────────────────────
export const enhancedWithdrawalApi = {
  create: (data: { amount: number; paymentMethod: string; accountDetails: string }) =>
    apiClient.post('/withdrawals/enhanced', data),
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get('/withdrawals/enhanced', { params }),
}

// ─── Referral & Promo APIs ───────────────────────────────────────────────────
export const referralApi = {
  getMyInfo: () => apiClient.get('/referral/me'),
  generateCode: () => apiClient.post('/referral/generate'),
  setPromoCode: (promoCode: string) => apiClient.post('/referral/promo', { promoCode }),
  validateCode: (code: string) => apiClient.get(`/referral/validate/${code}`),
}
