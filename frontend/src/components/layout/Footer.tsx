'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Send, Facebook, Twitter, Youtube, Instagram, MessageCircle, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { publicApi } from '@/lib/api'

export default function Footer() {
  const [year, setYear] = useState<number | null>(null)
  const [settings, setSettings] = useState<any>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setYear(new Date().getFullYear())
    setMounted(true)
    publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
  }, [])

  return (
    <footer className="bg-surface border-t border-border-subtle mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4 group inline-block">
              <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={160} height={40} className="h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform" />
              <span className="font-display font-bold text-lg gradient-text">VAULT SWEEPS</span>
            </Link>
            <p className="text-muted text-sm leading-relaxed mb-5">
              {settings.site_description || 'The ultimate gaming destination. Join millions of players and experience the future of gaming.'}
            </p>
            {mounted && (
            <div className="flex gap-3">
              {[
                { icon: Send, href: settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#', color: 'hover:text-blue-400' },
                { icon: Facebook, href: settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#', color: 'hover:text-blue-600' },
                { icon: Twitter, href: '#', color: 'hover:text-sky-400' },
                { icon: Youtube, href: '#', color: 'hover:text-red-500' },
                { icon: Instagram, href: '#', color: 'hover:text-pink-500' },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                  className={`w-9 h-9 glass rounded-lg flex items-center justify-center text-muted ${s.color} transition-all hover:scale-110`}>
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
                <li key={href}><Link href={href} className="text-sm text-muted hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* User */}
          <div>
            <h4 className="font-display text-xs tracking-widest text-neon-blue uppercase mb-4">Account</h4>
            <ul className="space-y-2">
              {[['/register', 'Register'], ['/login', 'Login'], ['/dashboard', 'Dashboard'], ['/dashboard/deposits', 'Deposits'], ['/dashboard/support', 'Support']].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-muted hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-xs tracking-widest text-neon-blue uppercase mb-4">Contact Us</h4>
            {mounted ? (
            <div className="space-y-3">
              <a href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'} target="_blank" rel="noopener noreferrer"
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

        <div className="mt-12 pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600" suppressHydrationWarning>© {year ?? ''} Vault Sweeps. All rights reserved.</p>
          <div className="flex gap-6">
            {[['#', 'Privacy Policy'], ['#', 'Terms of Service'], ['#', 'Cookie Policy']].map(([href, label]) => (
              <Link key={label} href={href} className="text-xs text-slate-600 hover:text-secondary transition-colors">{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
