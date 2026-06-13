'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Check, Star, Zap } from 'lucide-react'
import Link from 'next/link'
import { publicApi } from '@/lib/api'

const COLORS = ['#00D4FF', '#7B2FFF', '#00FFC8', '#FF2D9B', '#FFD700', '#00FF88']

const TYPE_BADGE: Record<string, string> = {
  welcome: 'NEW PLAYER',
  deposit: 'DEPOSIT BONUS',
  referral: 'REFER & EARN',
  vip: 'EXCLUSIVE VIP',
  seasonal: 'LIMITED TIME',
  cashback: 'DAILY CASHBACK',
}

interface Bonus {
  id: string
  title: string
  type: string
  description: string
  percentage: number | null
  amount: number | null
  maxBonus: number | null
  minDeposit: number | null
  requirements: string | null
  terms: string | null
  isActive: boolean
  expiresAt: string | null
}

export default function BonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicApi.getBonuses()
      .then(res => setBonuses(res.data.data || []))
      .catch(() => setBonuses([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-dark-900">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display font-black text-2xl text-white">
            NEXUS<span className="text-neon-blue">.</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/login" className="btn-neon text-xs py-2 px-4">Login</Link>
            <Link href="/register" className="btn-primary text-xs py-2 px-4">Register</Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Promotions</p>
            <h1 className="font-display font-bold text-5xl text-white mb-4">BONUSES & <span className="gradient-text">PROMOTIONS</span></h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Maximize your gaming with our incredible bonus offers. New promotions added regularly.</p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {[1,2,3].map(i => (
                <div key={i} className="glass-card p-6 h-64 animate-pulse">
                  <div className="h-4 w-24 bg-white/10 rounded mb-4" />
                  <div className="h-6 w-40 bg-white/10 rounded mb-3" />
                  <div className="h-16 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : bonuses.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Gift className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No active bonuses at the moment. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {bonuses.map((bonus, i) => {
                const color = COLORS[i % COLORS.length]
                const badge = TYPE_BADGE[bonus.type] || bonus.type.toUpperCase()
                const isExpiringSoon = bonus.expiresAt && new Date(bonus.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

                return (
                  <motion.div key={bonus.id}
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-card overflow-hidden hover:-translate-y-1 transition-all group">
                    <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full inline-block"
                          style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
                          {badge}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full text-orange-400 bg-orange-500/10 border border-orange-500/20 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> ENDING SOON
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-display font-bold text-lg text-white">{bonus.title}</h3>
                        <div className="text-right ml-3 flex-shrink-0">
                          {bonus.percentage && (
                            <p className="font-display font-black text-2xl" style={{ color }}>{bonus.percentage}%</p>
                          )}
                          {bonus.amount && !bonus.percentage && (
                            <p className="font-display font-black text-2xl" style={{ color }}>${bonus.amount}</p>
                          )}
                          {!bonus.percentage && !bonus.amount && (
                            <p className="font-display font-black text-xl text-slate-500">CUSTOM</p>
                          )}
                        </div>
                      </div>

                      {bonus.description && (
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">{bonus.description}</p>
                      )}

                      <div className="space-y-1.5 mb-4">
                        {bonus.maxBonus != null && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> Max bonus: ${bonus.maxBonus}
                          </div>
                        )}
                        {bonus.minDeposit != null && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> Min deposit: ${bonus.minDeposit}
                          </div>
                        )}
                        {bonus.requirements && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> {bonus.requirements}
                          </div>
                        )}
                        {bonus.expiresAt && (
                          <div className="flex items-center gap-2 text-xs text-orange-400">
                            <Star className="w-3 h-3 flex-shrink-0" /> Expires: {new Date(bonus.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {bonus.terms && (
                        <div className="text-xs text-slate-600 mb-4 leading-relaxed border-t border-white/5 pt-3">{bonus.terms}</div>
                      )}

                      <Link href="/register" className="btn-primary w-full text-center block py-2.5 text-xs">
                        Claim Now
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card p-8 text-center">
            <Gift className="w-10 h-10 text-neon-blue mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl text-white mb-2">More Bonuses Await</h2>
            <p className="text-slate-400 mb-5">Create your free account to see all available bonuses and promotions.</p>
            <Link href="/register" className="btn-primary inline-block py-3 px-10 text-sm">Join Free & Claim Bonus</Link>
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-slate-600 text-xs">
        © 2025 NexusGaming. All rights reserved.
      </footer>
    </div>
  )
}
