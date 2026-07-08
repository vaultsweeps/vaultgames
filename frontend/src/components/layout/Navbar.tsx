'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Bell, ChevronDown, User, LogOut, Settings, LayoutDashboard, Moon, Sun, SunMoon, Wallet, Home, Gift, Crown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/components/ThemeProvider'
import WalletModal from '@/components/modals/WalletModal'
import { authApi, notificationsApi } from '@/lib/api'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/games', label: 'Games' },
  { href: '/bonuses', label: 'Bonuses' },
  { href: '/cashout-rules', label: 'Cashout Rules' },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (isAuthenticated) {
      authApi.getBalance().then(res => {
        if (res.data?.data?.balance !== undefined) {
          setWalletBalance(res.data.data.balance)
        }
      }).catch(console.error)

      notificationsApi.getUnreadCount()
        .then(res => setUnreadCount(res.data.data.count))
        .catch(console.error)
    }
  }, [isAuthenticated, walletOpen, pathname])

  useEffect(() => {
    setMounted(true)
    const handler = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-black/95 backdrop-blur-md border-b border-white/10 py-3 shadow-lg shadow-black/50' : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" className="h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:text-neon-blue ${
                  pathname === link.href
                    ? 'text-neon-blue bg-neon-blue/10'
                    : 'text-secondary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme Toggle — cycles dark → light → night. Only rendered after mount to avoid hydration mismatch */}
            {mounted && (
              <button 
                onClick={() => {
                  if (theme === 'dark') setTheme('light')
                  else if (theme === 'light') setTheme('night')
                  else setTheme('dark')
                }}
                className="p-2 rounded-lg glass text-secondary hover:text-neon-blue transition-colors mr-2"
                title={theme === 'dark' ? 'Switch to Light Mode' : theme === 'light' ? 'Switch to Night Mode' : 'Switch to Dark Mode'}
                suppressHydrationWarning
              >
                {theme === 'light' ? <Sun className="w-4 h-4 text-amber-400" /> : theme === 'night' ? <Moon className="w-4 h-4 text-indigo-400" /> : <SunMoon className="w-4 h-4" />}
              </button>
            )}
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setWalletOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2AC3FF]/10 text-[#2AC3FF] hover:bg-[#2AC3FF]/20 transition-colors border border-[#2AC3FF]/20"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="font-bold text-sm">${walletBalance.toFixed(2)}</span>
                </button>
                <Link href="/dashboard" className="btn-neon text-xs py-2 px-4 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link href="/dashboard/notifications" className="relative p-2 rounded-lg glass text-secondary hover:text-white transition-colors border border-border-strong hover:border-neon-blue/30">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-blue rounded-full text-xs text-white flex items-center justify-center font-mono">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg glass border border-border-strong hover:border-neon-blue/30 transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-secondary">{user?.username}</span>
                    <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 glass-card py-2 z-50"
                      >
                        {user?.role === 'admin' && (
                          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-neon-blue hover:bg-neon-blue/5 transition-colors">
                            <Settings className="w-4 h-4" /> Admin Panel
                          </Link>
                        )}
                        <Link href="/dashboard/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:text-white hover:bg-white/5 transition-colors">
                          <User className="w-4 h-4" /> Profile
                        </Link>
                        <hr className="border-border-strong my-1" />
                        <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                          <LogOut className="w-4 h-4" /> Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors font-medium">
                  Login
                </Link>
                <Link href="/register" className="btn-primary text-xs py-2.5 px-5">
                  Join Now
                </Link>
              </>
            )}
          </div>

          {/* Mobile top-right icons: Theme + Wallet + Bell + Profile */}
          <div className="lg:hidden flex items-center gap-2">
            {/* Theme Toggle Mobile — only rendered after mount */}
            {mounted && (
              <button
                onClick={() => {
                  if (theme === 'dark') setTheme('light')
                  else if (theme === 'light') setTheme('night')
                  else setTheme('dark')
                }}
                className="p-2 text-secondary hover:text-neon-blue transition-colors"
                title={theme === 'dark' ? 'Light Mode' : theme === 'light' ? 'Night Mode' : 'Dark Mode'}
                suppressHydrationWarning
              >
                {theme === 'light' ? <Sun className="w-5 h-5 text-amber-400" /> : theme === 'night' ? <Moon className="w-5 h-5 text-indigo-400" /> : <SunMoon className="w-5 h-5" />}
              </button>
            )}

            {isAuthenticated && (
              <>
                {/* Wallet Balance */}
                <button
                  onClick={() => setWalletOpen(true)}
                  className="flex items-center gap-1 bg-[#2AC3FF]/10 border border-[#2AC3FF]/20 text-[#2AC3FF] rounded-full px-2.5 py-1 text-xs font-bold"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>${walletBalance.toFixed(2)}</span>
                </button>

                {/* Bell */}
                <Link href="/dashboard/notifications" className="relative p-1.5 text-secondary hover:text-white transition-colors">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-neon-blue rounded-full text-[9px] text-white flex items-center justify-center font-mono">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile Avatar */}
                <Link href="/dashboard/profile" className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-xs border border-border-strong shrink-0">
                  {user?.username?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden glass border-t border-border-subtle overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === link.href ? 'text-neon-blue bg-neon-blue/10' : 'text-secondary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="btn-neon text-center text-xs py-2.5">
                      Dashboard
                    </Link>
                    <button onClick={logout} className="px-4 py-2.5 text-sm text-red-400 text-left">Logout</button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-neon text-center text-xs py-2.5">Login</Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary text-center text-xs py-2.5">Join Now</Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>

    {/* Mobile Bottom Navigation Bar */}
    <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 pointer-events-none w-max">
      {/* Main Nav Pill */}
      <div className="border border-border-strong rounded-full px-4 py-2.5 flex items-center gap-3 pointer-events-auto shadow-2xl shadow-black/60 bg-background/95 backdrop-blur-xl">
        {/* Home */}
        <Link href="/" className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all ${pathname === '/' ? 'bg-white/10 text-white' : 'text-secondary hover:text-white'}`}>
          <Home className="w-5 h-5" />
          {pathname === '/' && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-neon-purple rounded-full shadow-[0_0_8px_rgba(168,85,247,0.9)]" />}
        </Link>

        {/* Games (Site Logo) */}
        <Link href="/games" className={`relative flex items-center justify-center transition-all ${pathname.includes('/games') ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}>
          <div className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center bg-black/60 overflow-hidden">
            <img src="/images/vault-sweeps-logo.png" alt="Games" className="w-full h-full object-contain p-1" />
          </div>
          {pathname.includes('/games') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-neon-purple rounded-full shadow-[0_0_8px_rgba(168,85,247,0.9)]" />}
        </Link>

        {/* Gift/Bonuses */}
        <Link href="/bonuses" className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all ${pathname.includes('/bonuses') ? 'bg-white/10 text-white' : 'text-secondary hover:text-white'}`}>
          <Gift className="w-5 h-5" />
          {pathname.includes('/bonuses') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-neon-purple rounded-full shadow-[0_0_8px_rgba(168,85,247,0.9)]" />}
        </Link>

        {/* Crown/VIP */}
        <Link href="/vip" className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all ${pathname.includes('/vip') ? 'text-yellow-400' : 'text-yellow-400/60 hover:text-yellow-400'}`}>
          <Crown className="w-5 h-5" />
          {pathname.includes('/vip') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.9)]" />}
        </Link>
      </div>

      {/* Menu Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 pointer-events-auto border border-border-strong active:scale-95 transition-transform"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>
    </div>

    <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} balance={walletBalance} />
    </>
  )
}
