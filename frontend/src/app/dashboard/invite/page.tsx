'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, RefreshCw, Users, DollarSign, Gift, Check,
  Link2, Tag, Shield, Zap, Share2
} from 'lucide-react'
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
      onClick={handleCopy}
      className="p-2 rounded-lg bg-white/5 hover:bg-neon-blue/10 border border-border-strong hover:border-neon-blue/30 transition-all text-secondary hover:text-neon-blue"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

const STAT_CARDS = [
  { icon: Users, label: 'Total Referrals', key: 'totalReferrals', color: '#00D4FF', format: (v: number) => v.toString() },
  { icon: Zap, label: 'Active Referrals', key: 'activeReferrals', color: '#7B2FFF', format: (v: number) => v.toString() },
  { icon: DollarSign, label: 'Total Earned', key: 'totalEarnings', color: '#00FFC8', format: (v: number) => `$${v.toFixed(2)}` },
]

export default function InvitePage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [savingPromo, setSavingPromo] = useState(false)
  const [activeTab, setActiveTab] = useState<'invite' | 'promo' | 'referrals'>('invite')

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
      <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-10" />
          <div className="absolute right-0 top-0 w-72 h-72 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gift className="w-5 h-5 text-neon-blue" />
                <p className="text-neon-blue text-xs font-mono tracking-widest uppercase">Referral Program</p>
              </div>
              <h2 className="font-display font-bold text-2xl text-white mb-1">Invite & Earn</h2>
              <p className="text-secondary text-sm">Earn a <span className="text-neon-blue font-semibold">50% bonus (up to $10)</span> on your referrals' first deposit!</p>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 btn-primary py-2.5 px-5 text-sm whitespace-nowrap self-start sm:self-center"
            >
              <Share2 className="w-4 h-4" /> Share Link
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-3 gap-3">
          {STAT_CARDS.map((card, i) => (
            <div key={i} className="glass-card p-4 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                style={{ background: `${card.color}15`, border: `1px solid ${card.color}30` }}>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="font-display font-black text-xl text-white">
                {card.format((info?.stats as any)?.[card.key] ?? 0)}
              </p>
              <p className="text-muted text-xs mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="glass-card overflow-hidden">
          {/* Tab Header */}
          <div className="flex border-b border-border-subtle">
            {([
              { id: 'invite', label: 'Invite Code', icon: Link2 },
              { id: 'promo', label: 'Promo Code', icon: Tag },
              { id: 'referrals', label: `Referrals (${info?.stats.totalReferrals ?? 0})`, icon: Users },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold font-mono uppercase tracking-wider transition-all relative ${
                  activeTab === tab.id
                    ? 'text-neon-blue'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === 'referrals' ? `(${info?.stats.totalReferrals ?? 0})` : tab.label.split(' ')[0]}</span>
                {activeTab === tab.id && (
                  <motion.div layoutId="invite-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">

              {/* ── Invite Code Tab ── */}
              {activeTab === 'invite' && (
                <motion.div key="invite" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                  {/* Referral Code */}
                  <div>
                    <p className="text-secondary text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Shield className="w-3 h-3" /> Your Invite Code
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-background border border-neon-blue/20 rounded-xl px-5 py-3.5 flex items-center justify-between">
                        <span className="font-mono font-bold text-xl tracking-[0.2em] text-neon-blue">
                          {info?.referralCode ?? '—'}
                        </span>
                        <span className="text-[10px] text-muted font-mono">INVITE CODE</span>
                      </div>
                      {info?.referralCode && <CopyButton text={info.referralCode} label="Invite code" />}
                    </div>
                  </div>

                  {/* Referral Link */}
                  <div>
                    <p className="text-secondary text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Link2 className="w-3 h-3" /> Your Invite Link
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-background border border-border-strong rounded-xl px-4 py-3 text-secondary text-sm font-mono truncate">
                        {info?.referralLink ?? '—'}
                      </div>
                      {info?.referralLink && <CopyButton text={info.referralLink} label="Invite link" />}
                    </div>
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 text-sm text-secondary hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    {generating ? 'Generating...' : 'Generate new code'}
                  </button>

                  {/* How it works */}
                  <div className="bg-background/60 rounded-xl p-4 border border-border-subtle space-y-3">
                    <p className="text-xs font-mono text-neon-blue uppercase tracking-wider">How it works</p>
                    {[
                      { step: '01', text: 'Share your invite link or code with friends' },
                      { step: '02', text: 'They sign up at vaultsweeps.com using your code' },
                      { step: '03', text: 'You earn 5% bonus on every deposit they make' },
                      { step: '04', text: 'No limit — keep referring, keep earning!' },
                    ].map(item => (
                      <div key={item.step} className="flex items-start gap-3">
                        <span className="font-display font-black text-lg text-neon-blue/20 leading-none flex-shrink-0">{item.step}</span>
                        <p className="text-secondary text-sm">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Promo Code Tab ── */}
              {activeTab === 'promo' && (
                <motion.div key="promo" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                  <div>
                    <p className="text-white font-medium mb-1">Set Your Custom Promo Code</p>
                    <p className="text-muted text-sm">Create a custom code (e.g. <span className="text-neon-blue font-mono">JOHN50</span>) that others can use when signing up.</p>
                  </div>

                  {/* Current promo code display */}
                  {info?.promoCode && (
                    <div className="bg-neon-blue/5 border border-neon-blue/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted font-mono uppercase tracking-wider mb-0.5">Active Promo Code</p>
                        <p className="font-display font-black text-2xl text-neon-blue tracking-wider">{info.promoCode}</p>
                      </div>
                      <CopyButton text={info.promoCode} label="Promo code" />
                    </div>
                  )}

                  {/* Input */}
                  <div className="space-y-2">
                    <label className="text-secondary text-xs font-mono uppercase tracking-wider block">
                      {info?.promoCode ? 'Change Promo Code' : 'Create Promo Code'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={e => setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                        placeholder="e.g. VAULT50"
                        maxLength={20}
                        className="flex-1 input-neon font-mono text-lg tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-sm"
                      />
                      <button
                        onClick={handleSavePromo}
                        disabled={savingPromo || !promoInput.trim() || promoInput.trim().length < 4}
                        className="btn-primary px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {savingPromo ? 'Saving...' : info?.promoCode ? 'Update' : 'Save'}
                      </button>
                    </div>
                    <p className="text-slate-600 text-xs">4-20 characters, letters, numbers, hyphens only. Your code will be uppercase.</p>
                  </div>

                  {/* Info box */}
                  <div className="bg-neon-purple/5 border border-neon-purple/20 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-mono text-neon-purple uppercase tracking-wider">Promo Code Benefits</p>
                    <ul className="space-y-1.5 text-sm text-secondary">
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> Custom branded code your community can remember</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> Works just like your invite code for sign-ups</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> Track all sign-ups from both codes in one place</li>
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* ── Referrals Tab ── */}
              {activeTab === 'referrals' && (
                <motion.div key="referrals" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  {!info?.referrals || info.referrals.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-white font-medium mb-1">No referrals yet</p>
                      <p className="text-muted text-sm">Share your invite code to start earning!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 text-xs font-mono text-muted uppercase tracking-wider px-3 pb-2 border-b border-border-subtle">
                        <span>User</span>
                        <span className="text-center">Deposited</span>
                        <span className="text-right">Joined</span>
                      </div>
                      {info.referrals.map((r, i) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] rounded-xl px-3 py-3 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 flex items-center justify-center text-xs font-bold text-white border border-border-strong">
                              {r.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{r.username}</p>
                            </div>
                          </div>
                          <div className="text-center">
                            {r.hasDeposited ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-mono">
                                ${r.totalDeposited.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted font-mono">No deposit</span>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs text-right">
                            {new Date(r.joinedAt).toLocaleDateString()}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
