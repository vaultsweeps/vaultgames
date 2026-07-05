// User types
export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  isVerified: boolean
  isActive: boolean
  isBanned: boolean
  createdAt: string
  profile?: UserProfile
}

export interface UserProfile {
  id: string
  userId: string
  fullName?: string
  phone?: string
  country?: string
  avatar?: string
  telegramUsername?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Deposit types
export interface Deposit {
  id: string
  userId: string
  amount: number
  currency: string
  paymentMethod: string
  status: 'pending' | 'processing' | 'approved' | 'failed'
  transactionId?: string
  paymentReference?: string
  proofImage?: string
  notes?: string
  createdAt: string
  updatedAt: string
  user?: User
}

// Withdrawal types
export interface Withdrawal {
  id: string
  userId: string
  amount: number
  currency: string
  withdrawalMethod: string
  accountInfo: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  adminNotes?: string
  processedAt?: string
  createdAt: string
  updatedAt: string
  user?: User
}

// Game types
export interface Game {
  id: string
  name: string
  description: string
  category: string
  version: string
  downloadUrl?: string
  downloadCount: number
  isActive: boolean
  isFeatured: boolean
  thumbnailUrl?: string
  screenshots: string[]
  requirements?: string
  instructions?: string
  createdAt: string
}

// Bonus types
export interface Bonus {
  id: string
  title: string
  description: string
  type: 'welcome' | 'deposit' | 'referral' | 'vip' | 'seasonal'
  amount?: number
  percentage?: number
  minDeposit?: number
  maxBonus?: number
  requirements: string
  terms: string
  expiresAt?: string
  isActive: boolean
  bannerUrl?: string
  createdAt: string
}

// Support ticket types
export interface SupportTicket {
  id: string
  userId: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  replies?: TicketReply[]
  createdAt: string
  updatedAt: string
  user?: User
}

export interface TicketReply {
  id: string
  ticketId: string
  userId: string
  message: string
  isAdmin: boolean
  createdAt: string
  user?: User
}

// Banner types
export interface Banner {
  id: string
  title: string
  subtitle?: string
  imageUrl: string
  videoUrl?: string
  ctaText?: string
  ctaLink?: string
  order: number
  isActive: boolean
  startsAt?: string
  endsAt?: string
  createdAt: string
}

// Notification types
export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  link?: string
  createdAt: string
}

// Payment method types
export interface PaymentMethod {
  id: string
  name: string
  code: string
  type: 'crypto' | 'card' | 'wallet' | 'bank'
  isActive: boolean
  minAmount: number
  maxAmount: number
  feePercent: number
  iconUrl?: string
  instructions?: string
  fields: PaymentField[]
}

export interface PaymentField {
  name: string
  label: string
  type: 'text' | 'number' | 'select'
  required: boolean
  options?: string[]
}

// FAQ types
export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  order: number
  isActive: boolean
}

// Analytics types
export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalDeposits: number
  totalWithdrawals: number
  pendingDeposits: number
  pendingWithdrawals: number
  todayDeposits: number
  todayWithdrawals: number
  totalRevenue: number
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string>
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Form types
export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface DepositForm {
  amount: number
  paymentMethodId: string
  currency?: string
}

export interface WithdrawalForm {
  amount: number
  paymentMethodId: string
  accountInfo: string
  currency?: string
}
