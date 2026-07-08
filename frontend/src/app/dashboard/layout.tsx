'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, ArrowUpCircle, Gamepad2, Gift, HelpCircle, User,
  Bell, LogOut, Menu, X, Zap, ChevronRight, Settings, Users2
} from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/deposits', icon: CreditCard, label: 'Deposits' },
  { href: '/dashboard/cashouts', icon: ArrowUpCircle, label: 'Cashouts' },
  { href: '/dashboard/games', icon: Gamepad2, label: 'Games' },
  { href: '/dashboard/bonuses', icon: Gift, label: 'Bonuses' },
  { href: '/dashboard/invite', icon: Users2, label: 'Invite & Earn' },
  { href: '/dashboard/support', icon: HelpCircle, label: 'Support' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetchMe().then(() => {
      if (!isAuthenticated) router.push('/login')
    })
  }, [])

  const lastFetch = useRef(0)

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchNotifications = () => {
      const now = Date.now()
      if (now - lastFetch.current < 30000) return // Throttle to 30s
      
      notificationsApi.getUnreadCount()
        .then(res => {
          setUnreadCount(res.data.data.count)
          lastFetch.current = Date.now()
        })
        .catch(() => {})
    }

    fetchNotifications() // fetch immediately on mount if authenticated
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  if (!isAuthenticated && !user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
    </div>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border-subtle">
        <Link href="/" className="flex items-center gap-2">
          <img src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" className="h-10 w-auto object-contain drop-shadow-md" />
          <span className="font-display font-bold text-sm gradient-text">VAULT SWEEPS</span>
        </Link>
      </div>

      {/* User info */}
      <div className="p-4 m-4 glass rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.username}</p>
            <p className="text-muted text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                  : 'text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-4 h-4 ${active ? 'text-neon-blue' : 'group-hover:text-white'}`} />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          )
        })}
        {user?.role === 'admin' && (
          <Link href="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-yellow-400 hover:bg-yellow-400/5 transition-all"
          >
            <Settings className="w-4 h-4" />
            Admin Panel
          </Link>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-border-subtle">
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-secondary hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-surface border-r border-border-subtle flex-col flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)} />
            <motion.aside
              initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 left-0 w-64 bg-surface border-r border-border-subtle flex flex-col z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-sm border-b border-border-subtle px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-secondary hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-display font-bold text-white text-sm">
                  {NAV_ITEMS.find(n => n.href === pathname)?.label || 'Dashboard'}
                </h1>
                <p className="text-muted text-xs hidden sm:block">Manage your gaming account</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/notifications" className="relative w-9 h-9 glass rounded-lg flex items-center justify-center text-secondary hover:text-white border border-border-strong transition-all">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-blue rounded-full text-xs text-white flex items-center justify-center font-mono">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </Link>
              <Link href="/" className="text-xs text-muted hover:text-white transition-colors hidden sm:block">← Back to site</Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
