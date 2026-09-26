'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Copy, RefreshCw, Users, DollarSign, Check, Share2, Activity } from 'lucide-react'
import { referralApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface ReferralStats {
  totalReferrals: number
  activeReferrals: number
  totalEarnings: number
}

interface Referral {
  id: string
  username: string
  joinedAt: string
  hasDeposited: boolean
  totalDeposited: number
}

interface ReferralInfo {
  referralCode: string | null
  promoCode: string | null
  referralLink: string
  stats: ReferralStats
  referrals: Referral[]
}

const ACCENT_GRADIENT = 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 50%, #8B5CF6 100%)'

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(label ? `${label} copied!` : 'Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ? `Copy ${label.toLowerCase()}` : 'Copy'}
      className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center bg-surface-elevated border border-border-subtle transition-all hover:brightness-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
    >
      {copied
        ? <Check className="w-5 h-5 text-emerald-400" />
        : <Copy className="w-5 h-5 text-primary" />
      }
    </button>
  )
}

// A read-only value (code / link) with its copy button. Shows an em dash and
// no copy button when there's no value yet, same as before.
function CopyField({
  label, value, copyLabel, emphasize,
}: { label: string; value: string | null | undefined; copyLabel: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-secondary mb-2">{label}</p>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0 h-14 rounded-2xl bg-surface-elevated border border-border-subtle px-4 flex items-center">
          <span
            className={`min-w-0 truncate ${emphasize
              ? 'text-base min-[360px]:text-lg font-semibold tracking-wide text-primary'
              : 'text-[14px] text-secondary'}`}
          >
            {value ?? '—'}
          </span>
        </div>
        {value && <CopyButton text={value} label={copyLabel} />}
      </div>
    </div>
  )
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="vs-gift-glow" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vs-gift-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="vs-gift-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="vs-gift-ribbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="50%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="52" r="46" fill="url(#vs-gift-glow)" />
      <ellipse cx="48" cy="86" rx="26" ry="4" fill="#000" opacity="0.28" />
      <rect x="17" y="46" width="62" height="38" rx="6" fill="url(#vs-gift-box)" />
      <rect x="12" y="34" width="72" height="16" rx="5" fill="url(#vs-gift-lid)" />
      <rect x="42" y="34" width="12" height="50" rx="2" fill="url(#vs-gift-ribbon)" />
      <path d="M48 34 C38 16, 20 20, 26 31 C30 37, 42 36, 48 34Z" fill="url(#vs-gift-ribbon)" />
      <path d="M48 34 C58 16, 76 20, 70 31 C66 37, 54 36, 48 34Z" fill="url(#vs-gift-ribbon)" />
      <circle cx="48" cy="34" r="5" fill="#DC2626" />
      <circle cx="46.5" cy="32.5" r="1.6" fill="#fff" opacity="0.5" />
      <rect x="20" y="50" width="5" height="30" rx="2.5" fill="#fff" opacity="0.22" />
      <rect x="16" y="37" width="30" height="3.5" rx="1.75" fill="#fff" opacity="0.35" />
    </svg>
  )
}

// Stat values scale down as they get longer instead of truncating — a money
// figure should never show an ellipsis. Base size is used for the normal
// case (e.g. "3", "$10.00").
function valueSize(value: string) {
  if (value.length >= 9) return 'text-[13px] min-[360px]:text-[15px] sm:text-lg'
  if (value.length >= 7) return 'text-[15px] min-[360px]:text-[18px] sm:text-xl'
  return 'text-[19px] min-[360px]:text-[22px] sm:text-2xl'
}

const HOW_IT_WORKS = [
  { title: 'Share your referral link', text: 'Send your invite link or code to your friends.' },
  { title: 'Your friend signs up', text: 'They register on VaultSweeps using your link.' },
  { title: 'They make their first deposit', text: 'Your bonus is earned once that deposit is approved.' },
  { title: 'You receive your referral bonus', text: '50% of their deposit, up to $10. No limit on referrals — keep inviting!' },
]

export default function InvitePage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [savingPromo, setSavingPromo] = useState(false)
  const [activeTab, setActiveTab] = useState<'invite' | 'promo' | 'referrals'>('invite')
  const reduceMotion = useReducedMotion()

  const fetchInfo = useCallback(async () => {
    try {
      const res = await referralApi.getMyInfo()
      setInfo(res.data.data)
      setPromoInput(res.data.data.promoCode || '')
    } catch {
      toast.error('Failed to load referral info')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await referralApi.generateCode()
      setInfo(prev => prev ? {
        ...prev,
        referralCode: res.data.data.referralCode,
        referralLink: res.data.data.referralLink,
      } : prev)
      toast.success('New referral code generated!')
    } catch {
      toast.error('Failed to generate code')
    } finally {
      setGenerating(false)
    }
  }

  const handleSavePromo = async () => {
    if (!promoInput.trim()) return
    setSavingPromo(true)
    try {
      const res = await referralApi.setPromoCode(promoInput.trim())
      setInfo(prev => prev ? { ...prev, promoCode: res.data.data.promoCode } : prev)
      toast.success('Promo code saved!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save promo code')
    } finally {
      setSavingPromo(false)
    }
  }

  const handleShare = async () => {
    if (!info?.referralLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Vault Sweeps!',
          text: `Use my invite link and get a welcome bonus on Vault Sweeps!`,
          url: info.referralLink,
        })
      } catch {}
    } else {
      await navigator.clipboard.writeText(info.referralLink)
      toast.success('Link copied to clipboard!')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-sky-400/25 border-t-sky-400 rounded-full animate-spin" />
    </div>
  )

  const statCards = [
    {
      label: 'Total Referrals',
      value: String(info?.stats.totalReferrals ?? 0),
      icon: Users, color: '#7DD3FC', tint: 'rgba(56,189,248,0.14)',
    },
    {
      label: 'Active Referrals',
      value: String(info?.stats.activeReferrals ?? 0),
      icon: Activity, color: '#C4B5FD', tint: 'rgba(167,139,250,0.16)',
    },
    {
      label: 'Total Earned',
      value: `$${(info?.stats.totalEarnings ?? 0).toFixed(2)}`,
      icon: DollarSign, color: '#FBBF24', tint: 'rgba(251,191,36,0.16)',
    },
  ]

  const tabs = [
    { id: 'invite', label: 'Invite' },
    { id: 'promo', label: 'Promo' },
    { id: 'referrals', label: 'Referrals' },
  ] as const

  const referralCount = info?.stats.totalReferrals ?? 0

  return (
    <div className="font-body space-y-4 max-w-2xl pb-10">

      {/* ── HERO ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl p-5 sm:p-8"
        style={{
          background: 'linear-gradient(140deg, #0B1533 0%, #151146 55%, #1E1259 100%)',
          boxShadow: '0 18px 48px -14px rgba(59,80,220,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div aria-hidden className="absolute -top-16 -right-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)' }} />
        <div aria-hidden className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.14) 0%, transparent 70%)' }} />

        <div className="relative">
          {/* Floated so the text wraps around the gift instead of being squeezed beside it */}
          <motion.div
            aria-hidden
            animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="float-right ml-2 min-[360px]:ml-3 mb-1 w-14 h-14 min-[360px]:w-[68px] min-[360px]:h-[68px] sm:w-24 sm:h-24"
          >
            <GiftIcon />
          </motion.div>

          <h1 className="text-2xl min-[400px]:text-[26px] sm:text-3xl font-bold tracking-tight text-white leading-tight">
            Invite &amp; Earn
          </h1>
          <p className="mt-2 sm:max-w-md text-[15px] leading-relaxed text-white/70">
            Earn a{' '}
            <span className="font-semibold text-amber-300 whitespace-nowrap">50% bonus (up to $10)</span>
            {' '}on your referrals&apos; first deposit!
          </p>

          <div className="clear-both sm:clear-none pt-5">
            <button
              type="button"
              onClick={handleShare}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-2xl text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ background: ACCENT_GRADIENT, boxShadow: '0 8px 24px -6px rgba(59,130,246,0.65)' }}
            >
              <Share2 className="w-5 h-5" strokeWidth={2.25} />
              Share Link
            </button>
          </div>
        </div>
      </motion.section>

      {/* ── STATS ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.4 }}
        className="grid grid-cols-3 gap-2.5 sm:gap-3"
      >
        {statCards.map(card => (
          <div key={card.label}
            className="min-w-0 rounded-2xl bg-surface border border-border-subtle px-2 py-4 sm:p-5 text-center">
            <div className="w-9 h-9 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: card.tint }}>
              <card.icon className="w-[18px] h-[18px]" style={{ color: card.color }} strokeWidth={2.25} />
            </div>
            <p className={`font-bold text-primary leading-none tabular-nums whitespace-nowrap ${valueSize(card.value)}`}>
              {card.value}
            </p>
            <p className="mt-1.5 text-xs text-secondary leading-snug">{card.label}</p>
          </div>
        ))}
      </motion.div>

      {/* ── TABS + CONTENT ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="rounded-3xl bg-surface border border-border-subtle overflow-hidden"
      >
        <div role="tablist" className="flex border-b border-border-subtle">
          {tabs.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 relative h-[52px] px-1 flex items-center justify-center gap-1.5 text-[14px] sm:text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:bg-surface-elevated ${active ? 'text-primary' : 'text-muted hover:text-secondary'}`}
              >
                {tab.label}
                {tab.id === 'referrals' && referralCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.18)', color: '#7DD3FC' }}>
                    {referralCount}
                  </span>
                )}
                {/* Per-tab indicator (not a shared layoutId element) so it can never
                    drift from the active tab, e.g. when measured mid slide-in. */}
                {active && (
                  <motion.span
                    aria-hidden
                    initial={{ opacity: 0, scaleX: 0.4 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full"
                    style={{ background: ACCENT_GRADIENT, boxShadow: '0 0 12px rgba(59,130,246,0.7)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4 sm:p-6">
          <AnimatePresence mode="wait">

            {/* ── Invite Tab ── */}
            {activeTab === 'invite' && (
              <motion.div key="invite" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-5">
                <CopyField label="Your Invite Code" value={info?.referralCode} copyLabel="Invite code" emphasize />
                <CopyField label="Your Invite Link" value={info?.referralLink} copyLabel="Invite link" />

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 min-h-[44px] text-[14px] font-medium text-muted hover:text-primary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Generating...' : 'Generate new code'}
                </button>

                <div className="border-t border-border-subtle pt-5">
                  <h2 className="text-base font-bold text-primary mb-4">How it works</h2>
                  <ol>
                    {HOW_IT_WORKS.map((step, i) => (
                      <li key={step.title} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #22D3EE, #6366F1 60%, #8B5CF6)' }}>
                            {i + 1}
                          </div>
                          {i < HOW_IT_WORKS.length - 1 && <div className="w-px flex-1 my-1.5 bg-border-strong" />}
                        </div>
                        <div className={`min-w-0 ${i < HOW_IT_WORKS.length - 1 ? 'pb-5' : ''}`}>
                          <p className="text-[15px] font-semibold text-primary leading-snug pt-[5px]">{step.title}</p>
                          <p className="text-[13px] text-secondary mt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.div>
            )}

            {/* ── Promo Tab ── */}
            {activeTab === 'promo' && (
              <motion.div key="promo" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-primary mb-1">Set Your Custom Promo Code</h2>
                  <p className="text-[14px] text-secondary leading-relaxed">
                    Create a custom code (e.g. <span className="text-sky-400 font-semibold">JOHN50</span>) that others can use when signing up.
                  </p>
                </div>

                {info?.promoCode && (
                  <div className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-secondary mb-1">Active promo code</p>
                      <p className="text-[22px] font-bold text-sky-400 tracking-wide truncate">{info.promoCode}</p>
                    </div>
                    <CopyButton text={info.promoCode} label="Promo code" />
                  </div>
                )}

                <div>
                  <label htmlFor="promo-input" className="text-[13px] font-medium text-secondary block mb-2">
                    {info?.promoCode ? 'Change Promo Code' : 'Create Promo Code'}
                  </label>
                  <div className="flex gap-2.5">
                    <input
                      id="promo-input"
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                      placeholder="e.g. VAULT50"
                      maxLength={20}
                      className="flex-1 min-w-0 h-12 rounded-2xl bg-surface-elevated border border-border-subtle px-4 text-base font-semibold tracking-wider text-primary placeholder:font-normal placeholder:tracking-normal placeholder:text-sm placeholder:text-muted focus:outline-none focus:border-sky-400/60"
                    />
                    <button
                      type="button"
                      onClick={handleSavePromo}
                      disabled={savingPromo || !promoInput.trim() || promoInput.trim().length < 4}
                      className="h-12 px-6 rounded-2xl text-[15px] font-bold text-white whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: ACCENT_GRADIENT }}
                    >
                      {savingPromo ? 'Saving...' : info?.promoCode ? 'Update' : 'Save'}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-2">4–20 characters, letters, numbers, hyphens only. Your code will be uppercase.</p>
                </div>

                <div className="rounded-2xl bg-surface-elevated p-4 space-y-3">
                  <p className="text-[14px] font-semibold text-primary">Promo code benefits</p>
                  {[
                    'Custom branded code your community can remember',
                    'Works just like your invite code for sign-ups',
                    'Track all sign-ups from both codes in one place',
                  ].map(text => (
                    <div key={text} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[14px] text-secondary leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Referrals Tab ── */}
            {activeTab === 'referrals' && (
              <motion.div key="referrals" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}>
                {!info?.referrals || info.referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
                      <Users className="w-6 h-6 text-muted" />
                    </div>
                    <p className="text-primary font-semibold text-base mb-1">No referrals yet</p>
                    <p className="text-secondary text-[14px]">Share your invite code to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {info.referrals.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 rounded-2xl bg-surface-elevated px-3.5 py-3"
                      >
                        <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-[15px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #22D3EE, #6366F1 60%, #8B5CF6)' }}>
                          {r.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-primary text-[15px] font-semibold truncate">{r.username}</p>
                          <p className="text-muted text-xs mt-0.5">Joined {new Date(r.joinedAt).toLocaleDateString()}</p>
                        </div>
                        {r.hasDeposited ? (
                          <span className="flex-shrink-0 text-[13px] px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: 'rgba(52,211,153,0.14)', color: '#34D399' }}>
                            ${r.totalDeposited.toFixed(0)}
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium text-muted bg-surface border border-border-subtle">
                            No deposit
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
