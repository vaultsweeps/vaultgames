'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Gift, Shield, Zap, Headphones, ChevronDown, Send, MessageCircle, Star, ChevronRight, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { publicApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { getSignalUrl } from '@/lib/signal'

const FEATURES = [
  { icon: Shield, title: 'Enterprise Security', desc: 'Bank-grade encryption and multi-layer security protecting your account 24/7.', color: '#00D4FF' },
  { icon: Zap, title: 'Instant Processing', desc: 'Lightning-fast deposits and withdrawals processed automatically.', color: '#7B2FFF' },
  { icon: Gift, title: 'Exclusive Bonuses', desc: 'Weekly promotions, VIP rewards, and massive welcome packages for all players.', color: '#FF2D9B' },
  { icon: Headphones, title: '24/7 Support', desc: 'Round-the-clock customer support via Telegram, Messenger, and live chat.', color: '#00FFC8' },
]

const BONUS_COLORS = ['#00D4FF', '#7B2FFF', '#00FFC8', '#FF2D9B']
const TYPE_BADGE: Record<string, string> = {
  welcome: 'NEW PLAYER', deposit: 'DEPOSIT', referral: 'REFER & EARN',
  vip: 'EXCLUSIVE', seasonal: 'LIMITED TIME', cashback: 'CASHBACK'
}

const FAQS = [
  { q: 'How do I create an account?', a: 'Click "Join Now", fill in your details, verify your email, and you\'re ready to play. Registration takes less than 2 minutes.' },
  { q: 'How do I make a deposit?', a: 'Go to your Dashboard > Deposits, select your payment method, enter the amount, and follow the instructions. Deposits are processed instantly.' },
  { q: 'How long do withdrawals take?', a: 'Most withdrawals are processed within 1-24 hours after admin approval. Crypto withdrawals are typically faster.' },
  { q: 'Are my funds and data safe?', a: 'Yes. We use bank-grade SSL encryption, 2FA, and secure payment gateways to protect your funds and personal information.' },
  { q: 'How do I claim bonuses?', a: 'Navigate to Dashboard > Bonuses to see available promotions. Each bonus has clear terms and requirements displayed.' },
  { q: 'What payment methods are accepted?', a: 'We accept cryptocurrency, credit/debit cards, e-wallets, and bank transfers. Available methods depend on your region.' },
]

const TESTIMONIALS = [
  { name: 'Alex K.', rating: 5, text: 'Best gaming platform I\'ve used. Instant withdrawals and amazing game selection!', role: 'VIP Player' },
  { name: 'Maria S.', rating: 5, text: 'Customer support is incredible. Had an issue at 3am and it was resolved in minutes.', role: 'Active Member' },
  { name: 'David T.', rating: 5, text: 'The bonuses are insane. Got 500% on my first deposit and won big!', role: 'Pro Gamer' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-card overflow-hidden">
      <button aria-expanded={open} aria-controls="faq-answer" className="w-full flex items-center justify-between px-6 py-4 text-left" onClick={() => setOpen(!open)}>
        <span className="font-medium text-primary text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-secondary transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-6 pb-4 text-secondary text-sm leading-relaxed border-t border-border-subtle pt-4">{a}</div>
      )}
    </div>
  )
}

export default function HomePageClient() {
  const [bonuses, setBonuses] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})
  const [mounted, setMounted] = useState(false)
  const [signalUrl, setSignalUrl] = useState('')
  const { isAuthenticated, openAuthModal } = useAuthStore()

  const handleFeatureClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
    }
  }

  useEffect(() => {
    setMounted(true)
    setSignalUrl(getSignalUrl())
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    publicApi.getBonuses()
      .then(res => setBonuses((res.data.data || []).slice(0, 4)))
      .catch(() => {})
      
    publicApi.getSettings()
      .then(res => setSettings(res.data.data || {}))
      .catch(() => {})

    return () => clearInterval(t)
  }, [])

  return (
    <>
      {/* Why Choose Us */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-purple/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Why Us</p>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-primary">WHY <span className="gradient-text">VAULT SWEEPS</span></h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -5 }} style={{ willChange: 'transform' }} className="glass-card p-6 text-center group">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-display text-sm font-bold text-primary mb-2">{f.title}</h3>
                <p className="text-muted text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bonuses */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Promotions</p>
              <h2 className="font-display font-bold text-4xl sm:text-5xl text-primary">HOT <span className="gradient-text">BONUSES</span></h2>
            </motion.div>
            <Link href="/bonuses" onClick={handleFeatureClick} className="btn-neon text-xs flex items-center gap-2">View All <ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bonuses.length > 0 ? bonuses.map((b: any, i: number) => {
              const color = BONUS_COLORS[i % BONUS_COLORS.length]
              const badge = TYPE_BADGE[b.type] || b.type?.toUpperCase()
              const amountDisplay = b.percentage ? `${b.percentage}%` : b.amount ? `$${b.amount}` : 'CUSTOM'
              return (
                <motion.div key={b.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -5 }} style={{ willChange: 'transform' }} className="glass-card p-6 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                  <div className="text-xs font-mono mb-3 px-2 py-0.5 rounded-full inline-block" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>{badge}</div>
                  <div className="font-display font-black text-4xl mb-2" style={{ color }}>{amountDisplay}</div>
                  <h3 className="font-display text-sm font-bold text-primary mb-2">{b.title}</h3>
                  <p className="text-muted text-xs mb-3">{b.description || b.requirements}</p>
                  {b.minDeposit && <p className="text-xs text-secondary flex items-center gap-1"><Check className="w-3 h-3" />Min deposit ${b.minDeposit}</p>}
                </motion.div>
              )
            }) : (
              // Skeleton placeholders while loading
              [0,1,2,3].map(i => (
                <div key={i} className="glass-card p-6 h-48 animate-pulse">
                  <div className="h-4 w-20 bg-white/10 rounded mb-4" />
                  <div className="h-10 w-24 bg-white/10 rounded mb-3" />
                  <div className="h-4 bg-white/5 rounded" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/5 via-transparent to-neon-purple/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Community</p>
            <h2 className="font-display font-bold text-4xl text-primary">PLAYER <span className="gradient-text">REVIEWS</span></h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass-card p-6">
                <div className="flex gap-1 mb-4">{Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 text-yellow-400 fill-current" />)}</div>
                <p className="text-secondary text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white text-xs font-bold">{t.name.charAt(0)}</div>
                  <div><p className="text-primary text-sm font-medium">{t.name}</p><p className="text-muted text-xs">{t.role}</p></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Help</p>
            <h2 className="font-display font-bold text-4xl text-primary">FREQUENTLY <span className="gradient-text">ASKED</span></h2>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="glass-card p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-blue/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Ready to play?</p>
              <h2 className="font-display font-black text-5xl text-primary mb-4">JOIN <span className="gradient-text">VAULT SWEEPS</span> TODAY</h2>
              <p className="text-secondary text-lg mb-8 max-w-xl mx-auto">Start your gaming journey with the best bonuses, fastest withdrawals, and premium games.</p>
              <div className="flex flex-wrap justify-center gap-4">
                {mounted && isAuthenticated ? (
                  <Link href="/dashboard" className="btn-primary py-3 px-10 text-sm">Go to Dashboard</Link>
                ) : (
                  <button onClick={() => openAuthModal('register')} className="btn-primary py-3 px-10 text-sm font-medium">Create Free Account</button>
                )}
                <a href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'} target="_blank" rel="noopener noreferrer" className="btn-neon py-3 px-8 text-sm flex items-center gap-2"><Send className="w-4 h-4" /> Contact Us</a>
                <Link href="/dashboard/cashouts" onClick={handleFeatureClick} className="btn-neon py-3 px-8 text-sm flex items-center gap-2" style={{ color: '#F59E0B', borderColor: '#F59E0B' }}>Crypto Withdrawal</Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating contact buttons */}
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col gap-3">
        {/* Signal – FIRST: fastest, auto-routes by time of day */}
        {signalUrl && (
          <a href={signalUrl} target="_blank" rel="noopener noreferrer"
            aria-label="Signal Support"
            className="btn-signal-beam w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-[#3a76f0]/40 hover:scale-110 transition-transform relative"
            title={signalUrl.includes('Vaulter') ? 'Signal (Day Shift 4 AM–4 PM)' : 'Signal (Night Shift 4 PM–4 AM)'}>
            <svg viewBox="0 0 48 48" className="w-6 h-6 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
              <path d="M19 23h10M19 27h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {/* Live shift badge */}
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center z-10" style={{ background: signalUrl.includes('Vaulter') ? '#f59e0b' : '#6366f1' }}>
              {signalUrl.includes('Vaulter') ? 'D' : 'N'}
            </span>
          </a>
        )}
        <a href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'} target="_blank" rel="noopener noreferrer"
          aria-label="Telegram Support"
          className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform hover:shadow-blue-500/40"
          title="Telegram Support">
          <Send className="w-5 h-5 text-white" aria-hidden="true" />
        </a>
        <a href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'} target="_blank" rel="noopener noreferrer"
          aria-label="Facebook Messenger Support"
          className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform hover:shadow-blue-600/40"
          title="Facebook Messenger">
          <MessageCircle className="w-5 h-5 text-white" aria-hidden="true" />
        </a>
      </div>
    </>
  )
}
