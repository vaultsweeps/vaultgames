'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, ArrowUpCircle, Gamepad2, Gift, HelpCircle, User,
  Bell, LogOut, Menu, X, Settings, Users2, ArrowLeft, Home
} from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import MobileBottomBar from '@/components/layout/MobileBottomBar'
import { cn } from '@/components/dashboard/ui'

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

// Routes that exist but aren't in the sidebar still deserve a proper header title.
const EXTRA_TITLES: Record<string, string> = {
  '/dashboard/notifications': 'Notifications',
  '/dashboard/withdrawals': 'Withdrawals',
  '/dashboard/wheel': 'Daily Spin',
}

const isActivePath = (pathname: string, href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))

type SidebarUser = { username?: string; email?: string; role?: string } | null

function SidebarContent({ user, pathname, onNavigate, onLogout, onClose }: {
  user: SidebarUser; pathname: string; onNavigate: () => void; onLogout: () => void; onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 min-w-0">
          <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-9 w-auto object-contain" priority />
          <span className="font-brand font-bold text-[13px] tracking-wide gradient-text whitespace-nowrap">VAULT SWEEPS</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] active:scale-95 transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile */}
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-surface-elevated border border-border-subtle p-3.5">
        <div className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-base"
          style={{ background: 'var(--ds-accent)' }}>
          {user?.username?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-primary text-[15px] font-semibold truncate leading-tight">{user?.username}</p>
          <p className="text-muted text-xs truncate mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-1" aria-label="Dashboard">
        {NAV_ITEMS.map(item => {
          const active = isActivePath(pathname, item.href)
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 h-12 lg:h-11 px-3.5 rounded-xl text-[15px] lg:text-[14.5px] font-medium transition-colors',
                active ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-[var(--ds-hover)]'
              )}
              style={active ? {
                background: 'linear-gradient(90deg, rgba(56,189,248,0.16), rgba(99,102,241,0.07))',
                boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.16), 0 10px 26px -16px rgba(56,189,248,0.55)',
              } : undefined}
            >
              <item.icon className={cn('w-[19px] h-[19px] flex-shrink-0 transition-colors', active ? 'text-sky-400' : 'text-muted group-hover:text-primary')} strokeWidth={1.9} />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" style={{ boxShadow: '0 0 10px rgba(56,189,248,0.9)' }} />}
            </Link>
          )
        })}
        {user?.role === 'admin' && (
          <>
            <div className="!mt-3 mb-1 mx-3.5 h-px bg-border-subtle" />
            <Link href="/admin" onClick={onNavigate}
              className="flex items-center gap-3 h-12 lg:h-11 px-3.5 rounded-xl text-[15px] lg:text-[14.5px] font-semibold transition-colors hover:bg-[var(--ds-hover)]"
              style={{ color: 'var(--ds-gold)' }}
            >
              <Settings className="w-[19px] h-[19px] flex-shrink-0" strokeWidth={1.9} />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border-subtle" style={{ paddingBottom: onClose ? 'calc(4.75rem + env(safe-area-inset-bottom))' : 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Link href="/" onClick={onNavigate} className="lg:hidden flex items-center gap-3 h-12 px-3.5 rounded-xl text-[15px] text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition-colors">
          <Home className="w-[19px] h-[19px]" strokeWidth={1.9} />
          Back to site
        </Link>
        <button type="button" onClick={onLogout}
          className="w-full flex items-center gap-3 h-12 lg:h-11 px-3.5 rounded-xl text-[15px] lg:text-[14.5px] font-medium text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-[19px] h-[19px]" strokeWidth={1.9} />
          Logout
        </button>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetchMe().then(() => {
      // Read fresh state from store after fetchMe resolves (avoids stale closure)
      const { isAuthenticated: freshAuth } = useAuthStore.getState()
      if (!freshAuth) router.push('/login')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Close the mobile menu on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  // Show spinner only if there is no cached user at all (first load with no persisted state)
  if (!isAuthenticated && !user) return (
    <div className="ds-scope ds-shell min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-400/25 border-t-sky-400 rounded-full animate-spin" />
    </div>
  )

  const pageTitle =
    NAV_ITEMS.find(n => isActivePath(pathname, n.href))?.label ||
    Object.entries(EXTRA_TITLES).find(([href]) => isActivePath(pathname, href))?.[1] ||
    'Dashboard'

  const closeMenu = () => setSidebarOpen(false)

  return (
    <div className="ds-scope ds-shell min-h-screen text-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[272px] bg-surface border-r border-border-subtle flex-col flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent user={user} pathname={pathname} onNavigate={closeMenu} onLogout={logout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/65 z-40 lg:hidden"
              onClick={closeMenu} />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              role="dialog" aria-modal="true" aria-label="Menu"
              className="fixed inset-y-0 left-0 w-[86%] max-w-[300px] bg-surface border-r border-border-subtle flex flex-col z-50 lg:hidden shadow-[0_0_60px_rgba(0,0,0,0.55)]"
            >
              <SidebarContent user={user} pathname={pathname} onNavigate={closeMenu} onLogout={logout} onClose={closeMenu} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 min-w-0 lg:ml-[272px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border-subtle backdrop-blur-xl"
          style={{ background: 'color-mix(in srgb, var(--bg-background) 78%, transparent)' }}>
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"
                className="lg:hidden w-10 h-10 flex-shrink-0 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-primary active:scale-95 transition">
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[17px] sm:text-lg font-bold text-primary leading-tight truncate">{pageTitle}</p>
                <p className="text-muted text-xs hidden sm:block">Manage your gaming account</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <Link href="/dashboard/notifications" aria-label="Notifications"
                className="relative w-10 h-10 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-primary hover:brightness-125 active:scale-95 transition">
                <Bell className="w-[18px] h-[18px]" strokeWidth={1.9} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
                    style={{ background: 'var(--ds-accent)', boxShadow: '0 0 0 2px var(--bg-background)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/" className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-medium text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to site
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 w-full overflow-x-clip">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 lg:pt-9 pb-28 lg:pb-9">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomBar menuOpen={sidebarOpen} onToggleMenu={() => setSidebarOpen(o => !o)} />
    </div>
  )
}
