'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Send, Facebook, Twitter, Youtube, Instagram, MessageCircle, Mail, Gift, Tag, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { publicApi, userApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { getSignalUrl } from '@/lib/signal'

export default function Footer() {
  const [year, setYear] = useState<number | null>(null)
  const [settings, setSettings] = useState<any>({})
  const [mounted, setMounted] = useState(false)
  const [signalUrl, setSignalUrl] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const { user } = useAuthStore()

  const handleClaimCoupon = async () => {
    if (!user) {
      toast.error('Please login or register to claim coupons')
      // Let AuthModal handle it via UI navigation if needed, or redirect
      return
    }
    if (!couponCode) return toast.error('Enter a coupon code')
    
    setClaiming(true)
    try {
      const res = await userApi.claimCoupon({ code: couponCode })
      toast.success(res.data.message || 'Coupon claimed!')
      setCouponCode('')
      // Update balance globally if possible, or force reload
      useAuthStore.getState().fetchUser()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to claim coupon')
    } finally {
      setClaiming(false)
    }
  }

  useEffect(() => {
    setYear(new Date().getFullYear())
    setMounted(true)
    setSignalUrl(getSignalUrl())
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
    return () => clearInterval(t)
  }, [])

  return (
    <footer className="bg-surface border-t border-border-subtle mt-auto">
      {/* Promotional Banner */}
      {mounted && (
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <div className="bg-[#1a1f35] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
            {/* Decorative background shapes */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl" />
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center text-center sm:text-left gap-6 z-10 w-full md:w-auto">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 animate-bounce-slow flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-600 to-purple-600 rounded-xl transform -rotate-12 shadow-[0_0_15px_rgba(219,39,119,0.5)] transition-transform group-hover:rotate-0" />
                <Gift className="w-8 h-8 sm:w-10 sm:h-10 text-white relative z-10" />
              </div>
              <div>
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-white mb-2 tracking-tight">Claim 100% Signup Bonus</h3>
                <p className="text-slate-300 text-sm sm:text-base">Make a deposit now and take a bonus of up to 1 000 USD to your deposit</p>
              </div>
            </div>
            <div className="z-10 w-full md:w-auto flex-shrink-0">
              <Link href="/verify" className="block w-full md:w-auto text-center bg-[#4fb0ff] hover:bg-[#3ea0ff] text-white font-semibold py-3 sm:py-4 px-8 sm:px-10 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(79,176,255,0.3)]">
                Claim now
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Claim Banner */}
      {mounted && (
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-8">
          <div className="bg-[#13131a]/80 backdrop-blur-sm border border-[#00D4FF]/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center text-center sm:text-left gap-6 z-10 w-full md:w-auto">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#00D4FF] to-blue-600 rounded-xl transform rotate-6 shadow-[0_0_15px_rgba(0,212,255,0.3)]" />
                <Tag className="w-7 h-7 sm:w-8 sm:h-8 text-white relative z-10" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl sm:text-2xl text-white mb-1 tracking-tight">Have a Coupon Code?</h3>
                <p className="text-slate-400 text-sm">Enter it below to claim your freeplay balance.</p>
              </div>
            </div>
            <div className="z-10 w-full md:w-auto flex-shrink-0 flex gap-2">
              <input 
                type="text" 
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE" 
                className="w-full md:w-64 bg-black/40 border border-white/10 focus:border-[#00D4FF]/50 rounded-xl px-4 py-3 sm:py-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all uppercase font-bold tracking-wider"
              />
              <button 
                onClick={handleClaimCoupon}
                disabled={claiming || !couponCode}
                className="flex-shrink-0 bg-gradient-to-r from-[#00D4FF] to-blue-600 hover:from-blue-500 hover:to-[#00D4FF] text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:shadow-[0_0_20px_rgba(0,212,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {claiming ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4 group inline-block">
              <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform" />
              <span className="font-display font-bold text-lg gradient-text">VAULT SWEEPS</span>
            </Link>
            <p className="text-secondary text-sm leading-relaxed mb-5">
              {settings.site_description || 'The ultimate gaming destination. Join millions of players and experience the future of gaming.'}
            </p>
            {mounted && (
            <div className="flex gap-3">
              {[
                { icon: Send, href: getTelegramUrl(settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/vaultsweeps', user), color: 'hover:text-blue-400', label: 'Telegram' },
                { icon: Facebook, href: settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#', color: 'hover:text-blue-600', label: 'Facebook' },
                { icon: Twitter, href: '#', color: 'hover:text-sky-400', label: 'Twitter' },
                { icon: Youtube, href: '#', color: 'hover:text-red-500', label: 'YouTube' },
                { icon: Instagram, href: '#', color: 'hover:text-pink-500', label: 'Instagram' },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className={`w-9 h-9 glass rounded-lg flex items-center justify-center text-secondary ${s.color} transition-all hover:scale-110`}>
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            )}
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-xs tracking-widest text-neon-blue uppercase mb-4">Navigation</h4>
            <ul className="space-y-2">
              {[['/', 'Home'], ['/games', 'Games'], ['/bonuses', 'Bonuses'], ['/cashout-rules', 'Cashout Rules'], ['/about', 'About Us'], ['/contact', 'Contact Us']].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-secondary hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* User */}
          <div>
            <h4 className="font-display text-xs tracking-widest text-neon-blue uppercase mb-4">Account</h4>
            <ul className="space-y-2">
              {[['/register', 'Register'], ['/login', 'Login'], ['/dashboard', 'Dashboard'], ['/dashboard/deposits', 'Deposits'], ['/dashboard/support', 'Support']].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-secondary hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-xs tracking-widest text-neon-blue uppercase mb-4">Contact Us</h4>
            {mounted ? (
            <div className="space-y-3">
              {signalUrl && (
                <a href={signalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 glass rounded-lg px-4 py-3 text-sm text-secondary hover:text-[#3a76f0] hover:border-[#3a76f0]/30 border border-transparent transition-all relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[#3a76f0]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <svg viewBox="0 0 48 48" className="w-4 h-4 text-[#3a76f0]" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="20" fill="currentColor"/>
                    <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
                    <path d="M19 23h10M19 27h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="flex-1">Signal Support</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded ml-auto">FASTEST</span>
                </a>
              )}
              <a href={getTelegramUrl(settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/vaultsweeps', user)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 glass rounded-lg px-4 py-3 text-sm text-secondary hover:text-neon-blue hover:border-neon-blue/30 border border-transparent transition-all">
                <Send className="w-4 h-4 text-blue-400" />
                Telegram Support
              </a>
              <a href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 glass rounded-lg px-4 py-3 text-sm text-secondary hover:text-neon-blue hover:border-neon-blue/30 border border-transparent transition-all">
                <MessageCircle className="w-4 h-4 text-blue-600" />
                Facebook Messenger
              </a>
              <a href="mailto:supportvaultsweeps@gmail.com"
                className="flex items-center gap-3 glass rounded-lg px-4 py-3 text-sm text-secondary hover:text-neon-blue hover:border-neon-blue/30 border border-transparent transition-all">
                <Mail className="w-4 h-4 text-purple-400" />
                Email Support
              </a>
              <Link href="/dashboard/support"
                className="flex items-center gap-3 glass rounded-lg px-4 py-3 text-sm text-secondary hover:text-neon-blue hover:border-neon-blue/30 border border-transparent transition-all">
                <MessageCircle className="w-4 h-4 text-neon-blue" />
                Support Tickets
              </Link>
            </div>
            ) : (
            <div className="space-y-3">
              <div className="h-12 glass rounded-lg" />
              <div className="h-12 glass rounded-lg" />
              <div className="h-12 glass rounded-lg" />
              <div className="h-12 glass rounded-lg" />
            </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-xs text-slate-400" suppressHydrationWarning>© {year ?? ''} Vault Sweeps. All rights reserved.</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center font-bold text-[8px]">18+</span>
              You must be at least 18 years old to use this platform. Please play responsibly.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookies', 'Cookie Policy']].map(([href, label]) => (
              <Link key={label} href={href} className="text-xs text-slate-400 hover:text-white transition-colors">{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
