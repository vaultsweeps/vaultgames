'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Bell, ChevronDown, ChevronRight, User, LogOut, Settings, LayoutDashboard, Moon, Sun, SunMoon, Wallet, Home, Gift, Crown, Users, Gamepad2, Headset, FileText } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/components/ThemeProvider'
import dynamic from 'next/dynamic'
import { authApi, notificationsApi } from '@/lib/api'

const WalletModal = dynamic(() => import('@/components/modals/WalletModal'), { ssr: false })
const AuthModal = dynamic(() => import('@/components/modals/AuthModal'), { ssr: false })
const ExpandableContactFab = dynamic(() => import('@/components/ui/ExpandableContactFab'), { ssr: false })

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
  const { user, isAuthenticated, logout, balance, fetchBalance, authModalOpen, authModalView, openAuthModal, closeAuthModal } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const [walletOpen, setWalletOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const lastNotifFetch = useRef(0)

  // Fetch balance once on auth, and again whenever wallet modal closes
  // We also set up a 10-second polling interval so if an admin approves a deposit in Telegram,
  // the balance updates instantly for the logged-in user.
  useEffect(() => {
    if (!isAuthenticated) return
    
    if (fetchBalance) fetchBalance()
    
    const balanceInterval = setInterval(() => {
      if (fetchBalance) fetchBalance()
    }, 2000)
    return () => clearInterval(balanceInterval)
  }, [isAuthenticated, walletOpen, fetchBalance]) // walletOpen allows immediate refresh after modal closes

  // Poll notifications every 30s, throttled — don't re-fetch on every route change
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchNotifications = () => {
      const now = Date.now()
      if (now - lastNotifFetch.current < 30000) return
      notificationsApi.getUnreadCount()
        .then(res => {
          setUnreadCount(res.data.data.count)
          lastNotifFetch.current = Date.now()
        })
        .catch(() => {})
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  useEffect(() => {
    setMounted(true)
    const handler = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      mounted && isScrolled
        ? 'py-2.5 backdrop-blur-xl bg-[#0a0a1a]/80 border-b border-purple-500/20 shadow-[0_4px_32px_rgba(139,92,246,0.15),0_1px_0_rgba(99,102,241,0.25)]'
        : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform" priority />
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
                aria-label="Toggle Theme"
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
                    <span className="font-bold text-white text-[15px] sm:text-base">${balance.toFixed(2)}</span>
                </button>
                <Link href="/dashboard" className="btn-neon text-xs py-2 px-4 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link href="/dashboard/notifications" aria-label="Notifications" className="relative p-2 rounded-lg glass text-secondary hover:text-white transition-colors border border-border-strong hover:border-neon-blue/30">
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
                    aria-label="Toggle profile menu"
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
                <button onClick={() => openAuthModal('login')} className="btn-liquid btn-signin-liquid text-sm py-2 px-5">
                  <span className="btn-liquid-content">Sign In</span>
                </button>
                <button onClick={() => openAuthModal('register')} className="btn-liquid btn-signup-beam text-sm py-2 px-6">
                  <span className="btn-liquid-content">Sign Up</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile top-right icons: Theme + Wallet + Bell + Profile */}
          {/* Mobile top-right: premium redesigned */}
          <div className="lg:hidden flex items-center gap-1.5">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => {
                  if (theme === 'dark') setTheme('light')
                  else if (theme === 'light') setTheme('night')
                  else setTheme('dark')
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all border border-white/8"
                aria-label="Toggle Theme"
                suppressHydrationWarning
              >
                {theme === 'light'
                  ? <Sun className="w-4 h-4 text-amber-400" />
                  : theme === 'night'
                  ? <Moon className="w-4 h-4 text-indigo-400" />
                  : <SunMoon className="w-4 h-4" />}
              </button>
            )}

            {isAuthenticated && (
              <>
                {/* Wallet — premium glass card */}
                <button
                  onClick={() => setWalletOpen(true)}
                  className="flex items-center gap-0 rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a1e]/80 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/20 transition-all active:scale-95"
                  style={{ boxShadow: '0 0 0 1px rgba(37,99,235,0.15), 0 4px 20px rgba(37,99,235,0.1)' }}
                >
                  {/* Dollar circle */}
                  <div className="flex items-center justify-center w-10 h-10 ml-1.5 rounded-full bg-gradient-to-br from-[#1a2a4a] to-[#0d1a35] border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                    <span className="text-[#3B82F6] font-black text-base" style={{ textShadow: '0 0 10px rgba(59,130,246,0.8)' }}>$</span>
                  </div>
                  {/* Balance text */}
                  <div className="flex flex-col items-center px-3">
                    <span className="text-[9px] font-bold tracking-[0.15em] text-white/40 uppercase">Balance</span>
                    <span className="text-white font-black text-base leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{balance.toFixed(2)}</span>
                  </div>
                  {/* Divider */}
                  <div className="w-px h-8 bg-white/10" />
                  {/* Wallet icon */}
                  <div className="flex items-center justify-center w-10 h-10 mr-1.5 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-[0_0_14px_rgba(37,99,235,0.5)]">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                </button>

                {/* Bell */}
                <Link
                  href="/dashboard/notifications"
                  aria-label="Notifications"
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all border border-white/8"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-[#FF3D6E] rounded-full text-[9px] text-white flex items-center justify-center font-bold shadow-[0_0_8px_rgba(255,61,110,0.6)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile Avatar */}
                <Link
                  href="/dashboard/profile"
                  aria-label="Profile"
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] flex items-center justify-center text-white font-black text-sm border border-white/15 shadow-[0_0_12px_rgba(124,58,237,0.4)] hover:scale-105 transition-transform shrink-0"
                >
                  {user?.username?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </Link>
              </>
            )}

            {!isAuthenticated && (
              <div className="flex items-center gap-1.5 ml-1">
                <button onClick={() => openAuthModal('login')} className="btn-liquid btn-signin-liquid text-xs py-1.5 px-3">
                  <span className="btn-liquid-content">Sign In</span>
                </button>
                <button onClick={() => openAuthModal('register')} className="btn-liquid btn-signup-beam text-xs py-1.5 px-4">
                  <span className="btn-liquid-content">Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </nav>

    {/* Mobile Sidebar Overlay & Drawer */}
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[80vw] max-w-[320px] bg-[#12141d] z-[70] lg:hidden flex flex-col shadow-2xl"
          >
            {/* Sidebar Header */}
            <div className="p-5 flex items-center justify-between">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex-shrink-0 flex items-center gap-2">
                <span className="font-display font-black text-2xl text-white tracking-tight" style={{ fontFamily: 'cursive' }}>Vault Sweeps</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="text-secondary hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              
              {/* Free Cash Banner */}
              <Link 
                href="/bonuses" 
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-between bg-gradient-to-r from-[#7a5af8] to-[#6042ef] rounded-xl p-3 shadow-lg shadow-purple-500/20 group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl filter drop-shadow-md relative -top-0.5 transform -rotate-12 group-hover:scale-110 transition-transform">💸</div>
                  <span className="font-bold text-white text-sm tracking-wide">FREE CASH</span>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70" />
              </Link>

              {/* User Info Box */}
              {isAuthenticated && user ? (
                <div className="bg-[#1c1e2b] rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] flex items-center justify-center text-white font-bold text-lg shadow-inner">
                      {user?.username?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                    <p className="text-sm font-medium text-secondary">{user.username}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#272b3d] flex items-center justify-center">
                        <span className="text-[#38bdf8] font-black text-sm">$</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">Balance</p>
                        <p className="text-base font-black text-white">${balance.toFixed(2)}</p>
                      </div>
                    </div>
                    <button onClick={() => { setMobileOpen(false); setWalletOpen(true); }} className="w-10 h-10 rounded-full bg-[#0ea5e9] hover:bg-[#38bdf8] flex items-center justify-center transition-colors shadow-lg shadow-sky-500/20">
                      <Wallet className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1c1e2b] rounded-2xl p-4 space-y-3">
                  <p className="text-sm text-secondary text-center mb-1">Sign in to play and win!</p>
                  <button onClick={() => { setMobileOpen(false); openAuthModal('login'); }} className="btn-liquid btn-signin-liquid text-sm py-3 w-full">
                    <span className="btn-liquid-content">Sign In</span>
                  </button>
                  <button onClick={() => { setMobileOpen(false); openAuthModal('register'); }} className="btn-liquid btn-signup-beam text-sm py-3 w-full">
                    <span className="btn-liquid-content">Sign Up</span>
                  </button>
                </div>
              )}

              {/* Navigation Links */}
              <div className="bg-[#1c1e2b] rounded-2xl py-2">
                {[
                  { href: '/', label: 'Home', icon: Home },
                  { href: '/dashboard/invite', label: 'Invite', icon: Users },
                  { href: '/games', label: 'Games', icon: Gamepad2 },
                  { href: '/bonuses', label: 'Bonuses', icon: Gift },
                ].map((link, i) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm font-bold text-secondary hover:text-white transition-colors"
                  >
                    <link.icon className={`w-5 h-5 ${pathname === link.href ? 'text-[#8b5cf6]' : 'text-secondary opacity-70'}`} />
                    <span className={pathname === link.href ? 'text-white' : ''}>{link.label}</span>
                  </Link>
                ))}
              </div>

              {/* Live Operator (Contact Us) */}
              <div className="bg-[#1c1e2b] rounded-xl overflow-hidden">
                <a
                  href={process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-4 px-5 py-4 border-l-4 border-l-[#8b5cf6] text-sm font-bold text-white hover:bg-white/5 transition-colors"
                >
                  <Headset className="w-5 h-5 text-white" />
                  Live Operator
                </a>
              </div>

              {/* Logout Button */}
              {isAuthenticated && (
                <button 
                  onClick={() => { setMobileOpen(false); logout(); }} 
                  className="w-full bg-[#2a1a24] hover:bg-[#3a202a] text-[#ef4444] py-4 rounded-xl text-sm font-bold transition-colors mt-2"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Mobile Bottom Navigation Bar */}
    <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-50 flex justify-between items-center pointer-events-none">

      {/* Menu Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="w-[52px] h-[52px] rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] flex items-center justify-center text-white shadow-lg pointer-events-auto transition-all active:scale-95"
      >
        <AnimatePresence mode="wait" initial={false}>
          {mobileOpen
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.span>
            : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-5 h-5" /></motion.span>
          }
        </AnimatePresence>
      </button>

      {/* Main Nav Pill */}
      <div className="border border-white/5 rounded-3xl px-1.5 py-1.5 flex items-center gap-1 pointer-events-auto shadow-xl bg-[#0b0f19] backdrop-blur-md">

        {/* Home */}
        <Link href="/" aria-label="Home" className={`relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl transition-all duration-200 group ${
          pathname === '/'
            ? 'bg-white/10 text-white'
            : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}>
          <Home className="w-5 h-5" strokeWidth={pathname === '/' ? 2.5 : 1.8} />
          {pathname === '/' && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
        </Link>

        {/* Games */}
        <Link href="/games" aria-label="Games" className={`relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl transition-all duration-200 ${
          pathname.includes('/games') ? 'bg-white/10' : 'hover:bg-white/5'
        }`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <Image src="/images/vault-sweeps-logo.png" alt="Games" width={32} height={32} className={`w-full h-full object-contain ${!pathname.includes('/games') && 'opacity-60 grayscale-[50%]'}`} />
          </div>
          {pathname.includes('/games') && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
        </Link>

        {/* Bonuses */}
        <Link href="/bonuses" aria-label="Bonuses" className={`relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl transition-all duration-200 ${
          pathname.includes('/bonuses')
            ? 'bg-[#2a1f1a] text-[#FBBF24]'
            : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}>
          <Gift className="w-5 h-5" strokeWidth={pathname.includes('/bonuses') ? 2.5 : 1.8} />
          {pathname.includes('/bonuses') && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#FBBF24] rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />}
        </Link>

        {/* Contact FAB inside pill */}
        <div className="w-[52px] h-[52px] flex items-center justify-center">
          <ExpandableContactFab inlinePill />
        </div>

      </div>
    </div>

    {/* Desktop Contact FAB */}
    <div className="hidden lg:block fixed bottom-6 right-6 z-50">
      <ExpandableContactFab />
    </div>

      <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} balance={balance} />
      <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} initialView={authModalView} />
    </>
  )
}
