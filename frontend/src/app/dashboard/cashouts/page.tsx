'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { getSignalUrl } from '@/lib/signal'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowUpCircle, X, Paperclip, CheckCircle, Clock, Shield, Zap,
  History, Plus, ChevronRight, AlertCircle
} from 'lucide-react'
import { withdrawalApi, depositApi, publicApi, authApi } from '@/lib/api'

// ─── Timer constants ───────────────────────────────────────────────────────
const TIMER_SECONDS = 10 * 60

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    approved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    rejected: 'bg-red-500/15 text-red-400 border border-red-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Countdown timer (shown after submission) ──────────────────────────────
function WithdrawalCountdown({
  amount, methodName, settings, onClose, withdrawalId, onViewHistory
}: {
  amount: string
  methodName: string
  settings: any
  onClose: () => void
  withdrawalId: string | null
  onViewHistory: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [signalUrl, setSignalUrl] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const expired = secondsLeft <= 0

  useEffect(() => {
    setSignalUrl(getSignalUrl())
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (status !== 'pending') return
    intervalRef.current = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status])

  useEffect(() => {
    if (!withdrawalId || status !== 'pending') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await withdrawalApi.getOne(withdrawalId)
        const s = res.data.data.status
        if (s === 'approved') { setStatus('approved'); if (pollRef.current) clearInterval(pollRef.current) }
        else if (['rejected', 'canceled', 'failed'].includes(s)) { setStatus('rejected'); if (pollRef.current) clearInterval(pollRef.current) }
      } catch {}
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [withdrawalId, status])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const progress = secondsLeft / TIMER_SECONDS
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)
  const ringColor = secondsLeft > 300 ? '#2AC3FF' : secondsLeft > 120 ? '#F59E0B' : '#EF4444'
  const glowColor = secondsLeft > 300 ? '42, 195, 255' : secondsLeft > 120 ? '245, 158, 11' : '239, 68, 68'

  const messages = [
    { threshold: 480, text: '🚀 Payment is being processed...', sub: 'Our team has received your request' },
    { threshold: 300, text: '⚡ Almost there!', sub: 'Your transfer is being finalized' },
    { threshold: 120, text: '🔥 Just moments away!', sub: 'Payment is nearly complete' },
    { threshold: 0, text: '✅ Checking final status...', sub: 'Awaiting confirmation' },
  ]
  const msg = status === 'approved'
    ? { text: '🎉 Payment Approved!', sub: 'The funds have been sent to your account.' }
    : status === 'rejected'
      ? { text: '❌ Payment Rejected', sub: 'Please contact support for more details.' }
      : messages.find(m => secondsLeft >= m.threshold) || messages[messages.length - 1]

  if (status === 'approved') {
    return (
      <div className="flex flex-col items-center py-12 px-6">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Payment Approved!</h2>
        <p className="text-secondary text-center text-sm mb-8">Your cashout of ${amount} has been successfully processed and sent to your {methodName} account.</p>
        <button onClick={onViewHistory} className="w-full max-w-xs bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all">View History</button>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="flex flex-col items-center py-12 px-6">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <X className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Payment Rejected</h2>
        <p className="text-secondary text-center text-sm mb-8">Your cashout of ${amount} could not be processed. Please contact support.</p>
        <div className="w-full max-w-xs space-y-3">
          {signalUrl && (
            <a href={signalUrl} target="_blank" rel="noreferrer"
              className="btn-signal-beam-rect w-full block font-bold py-3.5 rounded-2xl text-center">
              <span className="relative z-10 text-white">Contact Signal Support</span>
            </a>
          )}
          <a href={getTelegramUrl(settings.telegram_url || "#", useAuthStore.getState().user)} target="_blank" rel="noreferrer"
            className="w-full block bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all text-center">
            Contact Telegram Support
          </a>
          <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-2xl transition-all border border-border-strong">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-8 px-6">
      <div className="w-full flex justify-between items-center mb-6">
        <div>
          <h2 className="text-white text-xl font-bold">Withdrawal Submitted</h2>
          <p className="text-secondary text-xs mt-0.5">${amount} via {methodName}</p>
        </div>
        <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ring Timer */}
      <div className="relative flex items-center justify-center my-2" style={{ width: 180, height: 180 }}>
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 40px rgba(${glowColor}, 0.3)`, transition: 'box-shadow 1s ease' }} />
        <motion.div className="absolute inset-4 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(${glowColor}, 0.08) 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
        <svg className="absolute inset-0 -rotate-90" width="180" height="180">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="90" cy="90" r={radius} fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }} />
        </svg>
        <div className="relative flex flex-col items-center">
          {expired ? <CheckCircle className="w-12 h-12 text-emerald-400" /> : (
            <>
              <span className="text-white text-4xl font-bold font-mono tabular-nums leading-none">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="text-secondary text-xs mt-1">remaining</span>
            </>
          )}
        </div>
      </div>

      <motion.div key={msg.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-4 mb-6">
        <p className="text-white font-semibold text-base">{msg.text}</p>
        <p className="text-secondary text-sm mt-1">{msg.sub}</p>
      </motion.div>

      <div className="w-full grid grid-cols-3 gap-2 mb-6">
        {[
          { icon: Shield, label: 'Secure', color: 'text-emerald-400' },
          { icon: Zap, label: 'Fast Transfer', color: 'text-[#2AC3FF]' },
          { icon: Clock, label: '24/7 Support', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="bg-white/5 rounded-xl p-3 flex flex-col items-center gap-1.5 border border-border-subtle">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-secondary text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      <div className="w-full space-y-2">
        {signalUrl && (
          <a href={signalUrl} target="_blank" rel="noreferrer"
            className="btn-signal-beam-rect w-full block font-bold py-3.5 rounded-2xl text-center text-sm">
            <span className="relative z-10 text-white">Track via Signal Support</span>
          </a>
        )}
        <a href={getTelegramUrl(settings.telegram_url || "#", useAuthStore.getState().user)} target="_blank" rel="noreferrer"
          className="w-full block bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all text-center text-sm">
          Track via Telegram Support
        </a>
        <button onClick={onViewHistory} className="w-full text-muted hover:text-white transition-colors text-sm py-2">
          View History
        </button>
      </div>
    </div>
  )
}

// ─── Method icon/color map ─────────────────────────────────────────────────
const METHOD_ICON: Record<string, { icon: any; color: string; bg: string; customUI?: boolean }> = {
  cashapp:  { icon: <span className="text-white font-bold text-xl">$</span>, color: '#22c55e', bg: '#22c55e', customUI: true },
  cash_app: { icon: <span className="text-white font-bold text-xl">$</span>, color: '#22c55e', bg: '#22c55e', customUI: true },
  chime:    { icon: <span className="text-white font-bold text-xl">C</span>, color: '#10b981', bg: '#10b981', customUI: true },
  crypto:   { icon: '₿',  color: '#F7931A', bg: '#F7931A15' },
  usdt:     { icon: '₮',  color: '#26A17B', bg: '#26A17B15' },
  zelle:    { icon: '💜', color: '#6D1ED4', bg: '#6D1ED415' },
  venmo:    { icon: '💙', color: '#3D95CE', bg: '#3D95CE15' },
  paypal:   { icon: '🅿️', color: '#003087', bg: '#00308715' },
  bank:     { icon: '🏛️', color: '#00D4FF', bg: '#00D4FF15' },
  zappay:   { icon: '💰', color: '#7B2FFF', bg: '#7B2FFF15' },
  default:  { icon: '💰', color: '#7B2FFF', bg: '#7B2FFF15' },
}

function getMethodMeta(name: string) {
  const key = name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
  return METHOD_ICON[key] || METHOD_ICON.default
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function CashoutsPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // Form state
  const [methods, setMethods]           = useState<any[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [amount, setAmount]             = useState('0.00')
  const [fieldValues, setFieldValues]   = useState<Record<string, string>>({})
  const [qrFile, setQrFile]             = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep]                 = useState<1 | 2 | 3>(1) // 1=method, 2=form, 3=timer
  const [balance, setBalance]           = useState(0)
  const [withdrawable, setWithdrawable] = useState(0)
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null)
  const [settings, setSettings]         = useState<any>({})

  // History state
  const [history, setHistory]           = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await withdrawalApi.getAll()
      setHistory(res.data.data || [])
    } catch {}
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => {
    fetchHistory()
    publicApi.getSettings().then(r => setSettings(r.data.data)).catch(() => {})
    authApi.getBalance().then(r => {
      setBalance(r.data.data?.balance || 0)
      setWithdrawable(r.data.data?.withdrawable ?? (r.data.data?.balance || 0))
    }).catch(() => {})
    depositApi.getPaymentMethods()
      .then(r => setMethods(r.data.data || []))
      .catch(() => setMethods([]))
      .finally(() => setLoadingMethods(false))
  }, [fetchHistory])

  const getFields = (method: any): any[] => {
    if (!method?.fields) return []
    if (Array.isArray(method.fields)) return method.fields
    try { return JSON.parse(method.fields) } catch { return [] }
  }

  const handlePercentage = (pct: number) => {
    setAmount(((withdrawable * pct) / 100).toFixed(2))
  }

  const handleSelect = (m: any) => {
    setSelectedMethod(m)
    setFieldValues({})
    setQrFile(null)
    setAmount('0.00')
    setStep(2)
  }

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) return toast.error('Please enter a valid amount')
    if (numAmount > withdrawable) return toast.error('Insufficient withdrawable balance')

    const fields = getFields(selectedMethod)
    const allFilled = fields.filter((f: any) => f.required).every((f: any) => fieldValues[f.name]?.trim())
    if (!allFilled) return toast.error('Please fill all required fields')

    setIsSubmitting(true)
    try {
      const accountInfo = fields.length > 0
        ? fields.map((f: any) => `${f.label}: ${fieldValues[f.name] || ''}`).join(' | ')
        : selectedMethod.name

      // Build as FormData to support QR file upload via /manual endpoint
      const form = new FormData()
      form.append('amount', numAmount.toString())
      form.append('paymentMethodId', selectedMethod.id || selectedMethod.code || selectedMethod.name)
      form.append('accountInfo', accountInfo)
      if (qrFile) form.append('qrCode', qrFile)

      const res = await withdrawalApi.manualCashout(form)
      if (res.data?.data?.id) setWithdrawalId(res.data.data.id)

      toast.success('Cashout request submitted!')
      await fetchHistory()
      setStep(3)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit cashout')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedMethod(null)
    setAmount('0.00')
    setFieldValues({})
    setQrFile(null)
    setWithdrawalId(null)
  }

  const handleViewHistory = () => {
    resetForm()
    setTab('history')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">CASHOUTS</h2>
          <p className="text-secondary text-sm mt-1">Withdraw your winnings securely.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setTab('new') }} id="new-cashout-btn"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${tab === 'new' ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30' : 'glass text-secondary border-border-strong hover:text-white'}`}>
            <Plus className="w-4 h-4" /> New Request
          </button>
          <button onClick={() => { setTab('history'); fetchHistory() }} id="history-tab-btn"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${tab === 'history' ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30' : 'glass text-secondary border-border-strong hover:text-white'}`}>
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </motion.div>

      {/* Notice */}
      <div className="glass-card p-4 flex items-start gap-3 border border-border-subtle">
        <AlertCircle className="w-4 h-4 text-neon-blue flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white text-sm font-medium">Cashout Processing</p>
          <p className="text-secondary text-xs mt-0.5">Withdrawals are reviewed within 1–24 hours. Ensure your payment info is correct before submitting.</p>
        </div>
      </div>

      {/* New Request Tab */}
      <AnimatePresence mode="wait">
        {tab === 'new' && (
          <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* STEP 3 — Countdown Timer */}
            {step === 3 && (
              <div className="glass-card overflow-hidden">
                <WithdrawalCountdown
                  amount={amount}
                  methodName={selectedMethod?.name || ''}
                  settings={settings}
                  onClose={resetForm}
                  withdrawalId={withdrawalId}
                  onViewHistory={handleViewHistory}
                />
              </div>
            )}

            {/* STEP 1 — Select Method */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-xs font-mono text-muted uppercase tracking-wider">SELECT WITHDRAWAL METHOD</p>
                {loadingMethods ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="glass-card p-5 h-28 animate-pulse bg-white/3 rounded-2xl" />
                    ))}
                  </div>
                ) : methods.length === 0 ? (
                  <div className="glass-card p-8 text-center text-muted text-sm">No cashout methods available at this time.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[...methods]
                      .filter(m => m.code !== 'zappay' && !m.name?.toLowerCase().includes('zappay'))
                      .sort((a, b) => {
                        if (a.cashoutEnabled === b.cashoutEnabled) return 0
                        return a.cashoutEnabled ? -1 : 1
                      })
                      .map(m => {
                      const meta = getMethodMeta(m.code || m.name)
                      const isSoon = !m.cashoutEnabled
                      return (
                        <button key={m.id} onClick={() => !isSoon && handleSelect(m)} disabled={isSoon}
                          className={`glass-card p-5 rounded-2xl text-left flex flex-col gap-3 group transition-all border ${isSoon ? 'opacity-50 cursor-not-allowed border-border-subtle' : 'hover:border-white/20 border-border-subtle hover:scale-[1.02]'}`}>
                          <div className="flex items-start justify-between">
                            <div className={`w-11 h-11 flex items-center justify-center text-2xl ${meta.customUI ? 'rounded-full' : 'rounded-2xl'}`}
                              style={{ background: meta.bg, border: meta.customUI ? 'none' : `1px solid ${meta.color}30` }}>
                              {meta.icon}
                            </div>
                            {!isSoon && <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />}
                            {isSoon && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-secondary border border-border-strong">Soon</span>}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{m.name}</p>
                            {!isSoon && <p className="text-xs text-muted mt-0.5">Min: ${m.minAmount} · Max: ${m.maxAmount?.toLocaleString()}</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — Amount + Fields form (matches homepage modal exactly) */}
            {step === 2 && selectedMethod && (() => {
              const fields = getFields(selectedMethod)
              const meta = getMethodMeta(selectedMethod.code || selectedMethod.name)

              return (
                <div className="bg-background rounded-3xl border border-border-subtle overflow-hidden">
                  {/* Header */}
                  <div className="p-6 pb-4 flex justify-between items-start">
                    <div>
                      <h2 className="text-white font-bold text-2xl mb-1">{selectedMethod.name}</h2>
                      <p className="text-secondary text-sm">Fill in all the fields to create a<br />withdrawal request.</p>
                    </div>
                    <button onClick={resetForm} className="p-2 text-secondary hover:text-white rounded-full transition-colors -mr-2">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 pt-2 space-y-6">
                    {/* Amount */}
                    <div className="space-y-4">
                      <p className="text-secondary text-sm text-center">Enter cashout amount</p>
                      <div className="bg-surface rounded-2xl p-4 flex items-center border border-border-subtle relative">
                        <span className="text-muted mr-2 text-3xl font-bold">$</span>
                        <input type="text" value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="bg-transparent text-white font-bold text-4xl w-full focus:outline-none placeholder:text-slate-700"
                          placeholder="0.00" />
                        {amount !== '0.00' && amount !== '' && (
                          <button onClick={() => setAmount('0.00')} className="absolute right-4 text-muted hover:text-secondary">
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 75, 100].map(pct => (
                          <button key={pct} onClick={() => handlePercentage(pct)}
                            className="bg-surface hover:bg-surface-elevated text-[#2AC3FF] font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm">
                            {pct}%
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                        <span className="text-secondary text-sm">Available balance</span>
                        <span className="text-white font-bold text-sm">${withdrawable.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Dynamic fields from payment method */}
                    {fields.length > 0 ? fields.map((field: any) => (
                      <div key={field.name} className="space-y-2">
                        <p className="text-secondary text-sm">{field.label}{field.required && ' *'}</p>
                        {field.type === 'select' ? (
                          <div className="bg-surface rounded-2xl border border-border-subtle">
                            <select value={fieldValues[field.name] || ''} onChange={e => setFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                              className="bg-transparent text-secondary text-sm w-full p-4 focus:outline-none">
                              <option value="">{field.placeholder || 'Select...'}</option>
                              {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center relative">
                            <input type="text" placeholder={field.placeholder || ''}
                              value={fieldValues[field.name] || ''}
                              onChange={e => setFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                              className="bg-transparent text-secondary text-sm w-full focus:outline-none placeholder:text-slate-600 font-medium" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600 absolute right-4" />
                          </div>
                        )}
                      </div>
                    )) : (
                      // Fallback generic account info field
                      <div className="space-y-2">
                        <p className="text-secondary text-sm">Your {selectedMethod.name} account info *</p>
                        <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center relative">
                          <input type="text" placeholder={`Enter your ${selectedMethod.name} details`}
                            value={fieldValues['accountInfo'] || ''}
                            onChange={e => setFieldValues(p => ({ ...p, accountInfo: e.target.value }))}
                            className="bg-transparent text-secondary text-sm w-full focus:outline-none placeholder:text-slate-600 font-medium" />
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600 absolute right-4" />
                        </div>
                      </div>
                    )}

                    {/* QR Code Upload */}
                    <div className="space-y-2">
                      <p className="text-secondary text-sm flex items-center gap-2">
                        <Paperclip className="w-4 h-4" /> QR Code (Optional)
                      </p>
                      <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center">
                        <input type="file" accept="image/*" onChange={e => setQrFile(e.target.files?.[0] || null)}
                          className="bg-transparent text-secondary text-sm w-full focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#2AC3FF]/10 file:text-[#2AC3FF] hover:file:bg-[#2AC3FF]/20" />
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                      <button onClick={handleSubmit} disabled={isSubmitting}
                        className="flex-[2] bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50">
                        {isSubmitting ? 'Processing...' : 'Continue'}
                      </button>
                      <button onClick={resetForm}
                        className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-all border border-border-subtle">
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      {['Reference', 'Method', 'Amount', 'Status', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs font-mono text-muted uppercase tracking-wider px-5 py-3.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-border-subtle">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-16 text-center">
                          <ArrowUpCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                          <p className="text-muted text-sm">No cashout requests yet.</p>
                          <button onClick={() => setTab('new')} className="mt-3 text-neon-blue text-sm hover:underline">Create your first request →</button>
                        </td>
                      </tr>
                    ) : history.map((tx: any, i) => (
                      <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-border-subtle hover:bg-white/2 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">
                            {tx.requestId || tx.id.slice(0, 10)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-secondary">{tx.paymentMethod?.name || tx.paymentMethodStr || tx.adminNotes || 'Manual'}</td>
                        <td className="px-5 py-4 font-bold text-white">${tx.amount.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={tx.status} />
                          {tx.status === 'pending' && (
                            <p className="text-[10px] text-amber-500/70 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Processing ~10-15 mins
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted">
                          {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
