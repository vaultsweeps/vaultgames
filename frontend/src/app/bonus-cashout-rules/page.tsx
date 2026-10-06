'use client'
import { useState, useEffect } from 'react'
import Footer from '@/components/layout/Footer'
import { Shield, AlertCircle, Gift, Ticket, Users, Coins, Sparkles, Wallet } from 'lucide-react'
import { publicApi } from '@/lib/api'
import SundayFreeplayCard from '@/components/bonuses/SundayFreeplayCard'

interface BonusCashoutRule {
  id: string
  sourceTypes: string[]
  minAmount: number
  maxAmount: number
  walletCreditAmount: number
  priority: number
}

const SOURCE_TYPES = [
  { key: 'CRYPTO_BONUS', label: 'Crypto Bonus', icon: Coins, color: '#F59E0B' },
  { key: 'FREEPLAY', label: 'Freeplay (Sunday $3)', icon: Gift, color: '#00D4FF' },
  { key: 'REFERRAL_BONUS', label: 'Referral Bonus', icon: Users, color: '#7B2FFF' },
  { key: 'COUPON', label: 'Coupon', icon: Ticket, color: '#34D399' },
  { key: 'FREE_SPIN', label: 'Free Spin', icon: Sparkles, color: '#F472B6' },
]

const TERMS = [
  'Bonus Cashout Rules apply ONLY to money that originated as a bonus — Crypto Bonus, Freeplay, Referral Bonus, Coupon, and Free Spin winnings. Normal Wallet Balance follows the regular Cashout Rules instead.',
  'Only the listed amount converts to real, withdrawable Wallet Balance — any winnings above that are not carried over.',
  'The rule is matched by your total winnings for that bonus-funded session at the moment you cash out.',
  'Once converted, the resulting Wallet Balance is real money and follows the normal withdrawal process.',
  'Vault Sweeps may update these rules at any time; a rule already applied to a past cashout is never changed retroactively.',
]

function describeSourceTypes(sourceTypes: string[]): string {
  if (!sourceTypes || sourceTypes.length === 0 || sourceTypes.includes('ALL')) return 'All bonus types'
  return sourceTypes
    .map((s) => SOURCE_TYPES.find((t) => t.key === s)?.label || s)
    .join(', ')
}

const card = 'relative rounded-3xl border border-border-subtle bg-surface'
const cardShadow = { boxShadow: '0 18px 50px -28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)' } as const

function SectionTitle({ lead, accent }: { lead: string; accent: string }) {
  return (
    <h2 className="font-display font-bold text-[22px] sm:text-[28px] leading-tight text-primary text-center tracking-wide">
      {lead} <span className="gradient-text">{accent}</span>
    </h2>
  )
}

export default function BonusCashoutRulesPage() {
  const [rules, setRules] = useState<BonusCashoutRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicApi.getBonusCashoutRules()
      .then((res) => setRules(res.data?.data || []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-28 sm:pb-20 overflow-x-clip">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">

          {/* Hero */}
          <div className="relative text-center mb-10 sm:mb-14">
            <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[520px] max-w-full h-52 rounded-full opacity-60"
              style={{ background: 'radial-gradient(closest-side, rgba(0,212,255,0.22), transparent)' }} />
            <p className="relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.22em] uppercase text-neon-blue mb-4"
              style={{ background: 'rgba(0,212,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(0,212,255,0.22)' }}>
              <Shield className="w-3.5 h-3.5" /> Bonus Balance
            </p>
            <h1 className="relative font-display font-bold text-[34px] min-[400px]:text-[40px] sm:text-6xl leading-[1.08] text-primary mb-4">
              BONUS CASHOUT <span className="gradient-text">RULES</span>
            </h1>
            <p className="relative text-secondary text-[16px] sm:text-lg leading-relaxed max-w-xl mx-auto">
              How much of a bonus-funded game session's winnings convert to real, withdrawable Wallet Balance.
            </p>
          </div>

          {/* Sunday $3 Freeplay — claimed by texting staff on Signal */}
          <SundayFreeplayCard className="mb-8 sm:mb-10" />

          {/* Applies to all bonus types */}
          <section className={`${card} p-5 sm:p-8 mb-8 sm:mb-10`} style={cardShadow}>
            <SectionTitle lead="APPLIES TO" accent="EVERY BONUS TYPE" />
            <p className="mt-3 text-center text-secondary text-[14px] max-w-lg mx-auto">
              These rules apply the same way no matter where your Bonus Balance came from:
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SOURCE_TYPES.map((s) => (
                <div key={s.key} className="rounded-2xl bg-surface-elevated border border-border-subtle p-3.5 flex flex-col items-center text-center gap-2">
                  <span className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${s.color}1F`, boxShadow: `inset 0 0 0 1px ${s.color}40` }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} strokeWidth={2} />
                  </span>
                  <span className="text-[13px] font-semibold text-primary leading-snug">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl p-3.5 sm:p-4"
              style={{ background: 'rgba(0,212,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(0,212,255,0.22)' }}>
              <Wallet className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-[14px] leading-relaxed text-secondary">
                <span className="font-bold text-sky-400">Not included:</span> your normal Wallet Balance (real deposits) follows the regular{' '}
                <a href="/cashout-rules" className="text-sky-400 underline hover:text-white">Cashout Rules</a> instead, not these.
              </p>
            </div>
          </section>

          {/* Rules table */}
          <section className={`${card} p-4 sm:p-8 mb-8 sm:mb-10`} style={cardShadow}>
            <SectionTitle lead="CONVERSION" accent="TABLE" />

            {loading ? (
              <div className="mt-8 text-center text-secondary text-[14px]">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="mt-8 text-center text-secondary text-[14px]">No active bonus cashout rules right now.</div>
            ) : (
              <div role="table" aria-label="Bonus cashout conversion rules" className="mt-6 sm:mt-8 rounded-2xl overflow-hidden border border-border-subtle">
                <div role="rowgroup">
                  <div role="row" className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-3.5 sm:px-6 py-3 text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider"
                    style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.14), rgba(139,92,246,0.14))' }}>
                    <span role="columnheader" className="text-sky-400">Bonus Type</span>
                    <span role="columnheader" className="text-sky-400">Winnings Range</span>
                    <span role="columnheader" className="text-violet-400">Wallet Credit</span>
                  </div>
                </div>
                <div role="rowgroup">
                  {rules.map((r, i) => {
                    const last = i === rules.length - 1
                    return (
                      <div key={r.id} role="row"
                        className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center px-3.5 sm:px-6 py-3 sm:py-3.5 text-[13px] sm:text-[15px] tabular-nums border-t border-border-subtle first:border-t-0"
                        style={last ? { background: 'linear-gradient(90deg, rgba(34,211,238,0.07), rgba(139,92,246,0.10))' } : i % 2 === 0 ? { background: 'color-mix(in srgb, var(--bg-surface-elevated) 55%, transparent)' } : undefined}>
                        <span role="cell" className="font-bold text-primary">{describeSourceTypes(r.sourceTypes)}</span>
                        <span role="cell" className="font-medium text-secondary">${r.minAmount.toFixed(2)} – ${r.maxAmount.toFixed(2)}</span>
                        <span role="cell" className="font-semibold text-primary">${r.walletCreditAmount.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-2xl p-3.5 sm:p-4"
              style={{ background: 'rgba(251,191,36,0.08)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.25)' }}>
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-[14px] leading-relaxed text-secondary">
                <span className="font-bold uppercase tracking-wide text-yellow-500">Note:</span> winnings outside every listed range do not convert to Wallet Balance.
              </p>
            </div>
          </section>

          {/* Terms */}
          <section className="rounded-3xl p-5 sm:p-7 bg-surface" style={{ boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.22), 0 18px 50px -28px rgba(0,0,0,0.6)', backgroundImage: 'linear-gradient(160deg, rgba(251,191,36,0.06), transparent 50%)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.14)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.3)' }}>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </span>
              <h2 className="text-[17px] sm:text-[18px] font-bold text-yellow-400 leading-snug">Important Terms &amp; Conditions</h2>
            </div>
            <ul className="space-y-3">
              {TERMS.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-secondary">
                  <AlertCircle className="w-[18px] h-[18px] flex-shrink-0 mt-[3px] text-yellow-500/80" strokeWidth={2} />
                  <span className="min-w-0 break-words">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
