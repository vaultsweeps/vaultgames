'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, CreditCard, ArrowUpCircle, Gamepad2, Gift,
  HelpCircle, Image as ImageIcon, Settings, Bell, LogOut, Menu, X,
  BarChart3, Wallet, Server, TrendingUp, ArrowLeft, UserCircle2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Badge, cn } from '@/components/dashboard/ui'

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/deposits', icon: CreditCard, label: 'Deposits' },
  { href: '/admin/cashouts', icon: ArrowUpCircle, label: 'Cashouts' },
  { href: '/admin/withdrawals', icon: Wallet, label: 'Withdrawals' },
  { href: '/admin/games', icon: Gamepad2, label: 'Games' },
  { href: '/admin/bonuses', icon: Gift, label: 'Bonuses' },
  { href: '/admin/coupons', icon: Gift, label: 'Coupons' },
  { href: '/admin/bonus-cashout-rules', icon: Wallet, label: 'Bonus Cashout Rules' },
  { href: '/admin/banners', icon: ImageIcon, label: 'Banners' },
  { href: '/admin/support', icon: HelpCircle, label: 'Support' },
  { href: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { href: '/admin/providers', icon: Server, label: 'Providers' },
  { href: '/admin/payment-methods', icon: CreditCard, label: 'Payment Methods' },
  { href: '/admin/game-balance', icon: TrendingUp, label: 'Game Balances' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
]

type SidebarUser = { username?: string; email?: string; role?: string } | null

const isActivePath = (pathname: string, href: string, exact?: boolean) =>
  exact ? pathname === href : pathname.startsWith(href)

function SidebarContent({ user, pathname, onNavigate, onLogout, onClose }: {
  user: SidebarUser; pathname: string; onNavigate: () => void; onLogout: () => void; onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 min-w-0">
          <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-9 w-auto object-contain flex-shrink-0" priority />
          <span className="font-brand font-bold text-[13px] tracking-wide gradient-text whitespace-nowrap">VAULT SWEEPS</span>
          <Badge tone="gold" className="!px-2 !py-1 !text-[11px] tracking-wide">ADMIN</Badge>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="w-10 h-10 -mr-2 flex-shrink-0 rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] active:scale-95 transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile */}
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-surface-elevated border border-border-subtle p-3.5">
        <div className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-base text-[#1F1300]"
          style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 55%, #EA580C 100%)' }}>
          {user?.username?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-primary text-[15px] font-semibold truncate leading-tight">{user?.username}</p>
          <p className="text-xs font-semibold tracking-wide mt-0.5" style={{ color: 'var(--ds-gold)' }}>Administrator</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-1" aria-label="Admin">
        {NAV_ITEMS.map(item => {
          const active = isActivePath(pathname, item.href, item.exact)
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 h-12 lg:h-10 px-3.5 rounded-xl text-[15px] lg:text-[14.5px] font-medium transition-colors',
                active ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-[var(--ds-hover)]'
              )}
              style={active ? {
                background: 'linear-gradient(90deg, rgba(251,191,36,0.17), rgba(245,158,11,0.06))',
                boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.20), 0 10px 26px -16px rgba(251,191,36,0.55)',
              } : undefined}
            >
              <item.icon className={cn('w-[19px] h-[19px] flex-shrink-0 transition-colors', !active && 'text-muted group-hover:text-primary')}
                style={active ? { color: 'var(--ds-gold)' } : undefined} strokeWidth={1.9} />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ds-gold)', boxShadow: '0 0 10px rgba(251,191,36,0.85)' }} />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border-subtle space-y-1" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Link href="/dashboard" onClick={onNavigate}
          className="flex items-center gap-3 h-12 lg:h-11 px-3.5 rounded-xl text-[15px] lg:text-[14.5px] font-semibold text-primary bg-surface-elevated border border-border-subtle hover:brightness-125 transition">
          <UserCircle2 className="w-[19px] h-[19px] text-sky-400" strokeWidth={1.9} />
          User Dashboard
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetchMe().then(() => {
      if (!isAuthenticated) router.push('/login')
      else if (user?.role !== 'admin') router.push('/dashboard')
    })
  }, [])

  // Close the mobile menu on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  if (!isAuthenticated || user?.role !== 'admin') return (
    <div className="ds-scope ds-shell min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-400/25 border-t-sky-400 rounded-full animate-spin" />
    </div>
  )

  const closeMenu = () => setSidebarOpen(false)
  const pageTitle = NAV_ITEMS.find(n => isActivePath(pathname, n.href, n.exact))?.label || 'Admin'

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
              role="dialog" aria-modal="true" aria-label="Admin menu"
              className="fixed inset-y-0 left-0 w-[88%] max-w-[320px] bg-surface border-r border-border-subtle flex flex-col z-50 lg:hidden shadow-[0_0_60px_rgba(0,0,0,0.55)]"
            >
              <SidebarContent user={user} pathname={pathname} onNavigate={closeMenu} onLogout={logout} onClose={closeMenu} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 min-w-0 lg:ml-[272px] flex flex-col min-h-screen">
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
                <p className="text-xs hidden sm:block font-medium" style={{ color: 'var(--ds-gold)' }}>Admin panel</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="relative w-10 h-10 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-primary" aria-label="Notifications">
                <Bell className="w-[18px] h-[18px]" strokeWidth={1.9} />
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center bg-red-500"
                  style={{ boxShadow: '0 0 0 2px var(--bg-background)' }}>5</span>
              </div>
              <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold text-primary bg-surface-elevated border border-border-subtle hover:brightness-125 transition">
                <UserCircle2 className="w-4 h-4 text-sky-400" />
                User Dashboard
              </Link>
              <Link href="/" className="hidden md:inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-medium text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Site
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full overflow-x-clip">
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-9">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
