'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Check, Star, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { publicApi } from '@/lib/api'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useAuthStore } from '@/store/authStore'

// Types that should NEVER be shown on the public Bonuses page
const HIDDEN_TYPES = ['wheel', 'freeplay']

const TYPE_META: Record<string, { label: string; gradient: string; glow: string; icon: string }> = {
  welcome: {
    label: 'WELCOME BONUS',
    gradient: 'from-[#00d4ff] to-[#7b2fff]',
    glow: 'rgba(0,212,255,0.35)',
    icon: '🎁',
  },
  deposit: {
    label: 'DEPOSIT BONUS',
    gradient: 'from-[#f9ca24] to-[#f0932b]',
    glow: 'rgba(249,202,36,0.35)',
    icon: '💰',
  },
  referral: {
    label: 'REFER & EARN',
    gradient: 'from-[#00ffc8] to-[#00b4d8]',
    glow: 'rgba(0,255,200,0.35)',
    icon: '🤝',
  },
  vip: {
    label: 'EXCLUSIVE VIP',
    gradient: 'from-[#ff2d9b] to-[#7b2fff]',
    glow: 'rgba(255,45,155,0.35)',
    icon: '👑',
  },
  seasonal: {
    label: 'LIMITED TIME',
    gradient: 'from-[#ff6b35] to-[#f9ca24]',
    glow: 'rgba(255,107,53,0.35)',
    icon: '⚡',
  },
  cashback: {
    label: 'DAILY CASHBACK',
    gradient: 'from-[#00ff88] to-[#00d4ff]',
    glow: 'rgba(0,255,136,0.35)',
    icon: '♻️',
  },
}

const DEFAULT_META = {
  label: 'PROMOTION',
  gradient: 'from-[#a78bfa] to-[#7c3aed]',
  glow: 'rgba(167,139,250,0.35)',
  icon: '🎉',
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
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    publicApi.getBonuses()
      .then(res => {
        const all: Bonus[] = res.data.data || []
        // Filter out wheel/freeplay bonuses — those are handled by the Daily Spin popup
        setBonuses(all.filter(b => !HIDDEN_TYPES.includes(b.type)))
      })
      .catch(() => setBonuses([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="font-mono text-xs tracking-[0.35em] text-neon-blue uppercase mb-3">
              Promotions
            </p>
            <h1 className="font-display font-bold text-5xl md:text-6xl text-white mb-5">
              BONUSES &{' '}
              <span className="bg-gradient-to-r from-[#f9ca24] to-[#ff4e50] bg-clip-text text-transparent">
                PROMOTIONS
              </span>
            </h1>
            <p className="text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
              Maximize your gaming with our incredible bonus offers. New promotions added regularly.
            </p>
          </motion.div>

          {/* ── Bonus Grid ── */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-6 h-72 animate-pulse">
                  <div className="h-4 w-24 bg-white/10 rounded mb-4" />
                  <div className="h-6 w-40 bg-white/10 rounded mb-3" />
                  <div className="h-16 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : bonuses.length === 0 ? (
            <div className="text-center py-24 text-muted">
              <Gift className="w-14 h-14 mx-auto mb-5 opacity-20" />
              <p className="text-lg font-medium">No active bonuses at the moment.</p>
              <p className="text-sm mt-1 opacity-60">Check back soon for exciting promotions!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {bonuses.map((bonus, i) => {
                const meta = TYPE_META[bonus.type] || DEFAULT_META
                const isExpiringSoon =
                  bonus.expiresAt &&
                  new Date(bonus.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

                return (
                  <motion.div
                    key={bonus.id}
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.45 }}
                    className="group relative rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-300"
                    style={{
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5)`,
                    }}
                  >
                    {/* Top gradient accent bar */}
                    <div
                      className={`h-1.5 w-full bg-gradient-to-r ${meta.gradient}`}
                    />

                    {/* Subtle glow pulse on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{
                        boxShadow: `inset 0 0 60px ${meta.glow}`,
                      }}
                    />

                    <div className="relative p-7">
                      {/* Type badge + Expiry */}
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`text-[10px] font-black tracking-[0.22em] px-3 py-1 rounded-full bg-gradient-to-r ${meta.gradient} text-black shadow-md`}
                        >
                          {meta.label}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-orange-300 bg-orange-500/10 border border-orange-500/25 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            ENDING SOON
                          </span>
                        )}
                      </div>

                      {/* Icon + Amount row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {/* Large icon */}
                          <div
                            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}
                            style={{ boxShadow: `0 8px 24px ${meta.glow}` }}
                          >
                            {meta.icon}
                          </div>
                          <h3 className="font-display font-bold text-lg text-white leading-tight">
                            {bonus.title}
                          </h3>
                        </div>

                        {/* Prize amount — now large, vivid, and on its own right */}
                        <div className="text-right flex-shrink-0 ml-3">
                          {bonus.percentage && (
                            <p
                              className={`font-display font-black text-4xl bg-gradient-to-b ${meta.gradient} bg-clip-text text-transparent drop-shadow-lg leading-none`}
                            >
                              {bonus.percentage}%
                            </p>
                          )}
                          {bonus.amount && !bonus.percentage && (
                            <p
                              className={`font-display font-black text-4xl bg-gradient-to-b ${meta.gradient} bg-clip-text text-transparent drop-shadow-lg leading-none`}
                            >
                              ${bonus.amount}
                            </p>
                          )}
                          {!bonus.percentage && !bonus.amount && (
                            <p className="font-display font-bold text-xl text-white/40">
                              FREE
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {bonus.description && (
                        <p className="text-white/60 text-sm mb-5 leading-relaxed">
                          {bonus.description}
                        </p>
                      )}

                      {/* Requirements list */}
                      <div className="space-y-2 mb-5">
                        {bonus.maxBonus != null && (
                          <div className="flex items-center gap-2.5 text-xs text-white/50">
                            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            Max bonus: <span className="text-white/80 font-semibold">${bonus.maxBonus}</span>
                          </div>
                        )}
                        {bonus.minDeposit != null && (
                          <div className="flex items-center gap-2.5 text-xs text-white/50">
                            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            Min deposit: <span className="text-white/80 font-semibold">${bonus.minDeposit}</span>
                          </div>
                        )}
                        {bonus.requirements && (
                          <div className="flex items-center gap-2.5 text-xs text-white/50">
                            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            {bonus.requirements}
                          </div>
                        )}
                        {bonus.expiresAt && (
                          <div className="flex items-center gap-2.5 text-xs text-orange-400/80">
                            <Star className="w-3.5 h-3.5 flex-shrink-0" />
                            Expires: {new Date(bonus.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Terms */}
                      {bonus.terms && (
                        <div className="text-xs text-white/25 mb-5 leading-relaxed border-t border-white/8 pt-3">
                          {bonus.terms}
                        </div>
                      )}

                      {/* CTA */}
                      <Link
                        href={isAuthenticated ? '/dashboard/deposits' : '/register'}
                        className={`group/btn w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm text-black bg-gradient-to-r ${meta.gradient} hover:opacity-90 active:scale-95 transition-all shadow-lg`}
                        style={{ boxShadow: `0 6px 20px ${meta.glow}` }}
                      >
                        {isAuthenticated ? 'Deposit & Claim' : 'Claim Now'}
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* ── Unauthenticated CTA ── */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl p-10 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(249,202,36,0.08) 0%, rgba(255,78,80,0.05) 100%)',
                border: '1px solid rgba(249,202,36,0.2)',
                boxShadow: '0 0 60px rgba(249,202,36,0.06)',
              }}
            >
              <Gift className="w-12 h-12 mx-auto mb-4 text-[#f9ca24]" />
              <h2 className="font-display font-bold text-3xl text-white mb-3">
                More Bonuses Await
              </h2>
              <p className="text-white/60 mb-7 max-w-md mx-auto leading-relaxed">
                Create your free account to unlock all exclusive bonuses and promotions.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 py-3.5 px-12 rounded-xl font-bold text-base text-black bg-gradient-to-r from-[#f9ca24] to-[#f0932b] hover:opacity-90 active:scale-95 transition-all shadow-[0_8px_24px_rgba(249,202,36,0.35)]"
              >
                Join Free & Claim Bonus
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
