'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Bell, ChevronDown, User, LogOut, Settings, LayoutDashboard, Gamepad2, Zap, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/components/ThemeProvider'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/games', label: 'Games' },
  { href: '/bonuses', label: 'Bonuses' },
  { href: '/cashout-rules', label: 'Cashout Rules' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'glass border-b border-white/5 py-3' : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-blue to-neon-purple rounded-lg animate-glow-pulse" />
              <Zap className="relative z-10 w-8 h-8 text-white p-1.5" />
            </div>
            <span className="font-display font-bold text-lg tracking-wider gradient-text group-hover:opacity-80 transition-opacity">
              NEXUS<span className="text-white">GAMING</span>
            </span>
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
                    : 'text-slate-400'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'night' : 'dark')}
              className="p-2 rounded-lg glass text-slate-400 hover:text-neon-blue transition-colors mr-2"
              title={theme === 'dark' ? "Switch to Night Mode (AMOLED)" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="btn-neon text-xs py-2 px-4 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg glass border border-white/10 hover:border-neon-blue/30 transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-slate-300">{user?.username}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
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
                        <Link href="/dashboard/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                          <User className="w-4 h-4" /> Profile
                        </Link>
                        <hr className="border-white/10 my-1" />
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
                <Link href="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors font-medium">
                  Login
                </Link>
                <Link href="/register" className="btn-primary text-xs py-2.5 px-5">
                  Join Now
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button & Theme toggle */}
          <div className="lg:hidden flex items-center gap-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'night' : 'dark')}
              className="p-2 text-slate-400 hover:text-neon-blue transition-colors"
            >
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button className="p-2 text-slate-400 hover:text-white transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
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
            className="lg:hidden glass border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === link.href ? 'text-neon-blue bg-neon-blue/10' : 'text-slate-400'
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
  )
}
