'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, CreditCard, ArrowUpCircle, Gamepad2, Gift,
  HelpCircle, Image, Settings, Bell, LogOut, Menu, X, Zap,
  ChevronRight, BarChart3, Wallet, FileText
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/deposits', icon: CreditCard, label: 'Deposits' },
  { href: '/admin/cashouts', icon: ArrowUpCircle, label: 'Cashouts' },
  { href: '/admin/games', icon: Gamepad2, label: 'Games' },
  { href: '/admin/bonuses', icon: Gift, label: 'Bonuses' },
  { href: '/admin/banners', icon: Image, label: 'Banners' },
  { href: '/admin/support', icon: HelpCircle, label: 'Support' },
  { href: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
]

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

  if (!isAuthenticated || user?.role !== 'admin') return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
    </div>
  )

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-sm text-white">NEXUS</span>
            <span className="text-xs text-yellow-400 font-mono ml-1">ADMIN</span>
          </div>
        </Link>
      </div>

      <div className="p-4">
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.username}</p>
            <p className="text-yellow-400 text-xs font-mono">ADMINISTRATOR</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-yellow-400' : ''}`} />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <Link href="/dashboard" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-neon-blue hover:bg-neon-blue/5 transition-all mb-1">
          <LayoutDashboard className="w-4 h-4" /> User Dashboard
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-dark-800 border-r border-white/5 flex-col flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 left-0 w-60 bg-dark-800 border-r border-white/5 flex flex-col z-50 lg:hidden">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-dark-800/80 backdrop-blur-sm border-b border-white/5 px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-display font-bold text-white text-sm">
                  {NAV_ITEMS.find(n => isActive(n.href, n.exact))?.label || 'Admin'}
                </h1>
                <p className="text-slate-600 text-xs">Admin Panel</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-400" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-mono" style={{ fontSize: '9px' }}>5</span>
              </div>
              <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors hidden sm:block ml-2">← Site</Link>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
