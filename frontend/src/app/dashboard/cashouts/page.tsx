'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { getSmsUrl } from '@/lib/sms'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { MIN_WITHDRAWAL_USD, MIN_WITHDRAWAL_MESSAGE } from '@/lib/withdrawal'
import {
  ArrowUpCircle, X, CheckCircle, Clock, Shield, Zap, History, Plus, ChevronRight, Info,
  UploadCloud, Wallet, Landmark, Bitcoin, DollarSign, CircleDollarSign, Send, Headphones,
  MessageCircle, XCircle, AlertCircle, ArrowLeft,
} from 'lucide-react'
import { withdrawalApi, depositApi, publicApi, authApi } from '@/lib/api'
import {
  Card, cardClass, cn, PageHeader, SectionHeading, Button, buttonClass, Badge, StatusBadge,
  IconTile, EmptyState, Field, Skeleton, BrandIcon,
} from '@/components/dashboard/ui'

// ─── Timer constants ───────────────────────────────────────────────────────
const TIMER_SECONDS = 10 * 60

const CRYPTO_CODES = ['crypto', 'usdt', 'bitcoin', 'btc', 'ltc', 'litecoin', 'eth', 'trx']
const isCryptoMethod = (m: any) => CRYPTO_CODES.includes(String(m?.code || '').toLowerCase())

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
  const [smsUrl, setsmsUrl] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const expired = secondsLeft <= 0

  useEffect(() => {
    setsmsUrl(getSmsUrl())
    const t = setInterval(() => setsmsUrl(getSmsUrl()), 60_000)
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
    { threshold: 480, text: 'Payment is being processed...', sub: 'Our team has received your request' },
    { threshold: 300, text: 'Almost there!', sub: 'Your transfer is being finalized' },
    { threshold: 120, text: 'Just moments away!', sub: 'Payment is nearly complete' },
    { threshold: 0, text: 'Checking final status...', sub: 'Awaiting confirmation' },
  ]
  const msg = status === 'approved'
    ? { text: 'Payment Approved!', sub: 'The funds have been sent to your account.' }
    : status === 'rejected'
      ? { text: 'Payment Rejected', sub: 'Please contact support for more details.' }
      : messages.find(m => secondsLeft >= m.threshold) || messages[messages.length - 1]

  const telegramHref = getTelegramUrl(settings.telegram_url || "#", useAuthStore.getState().user)

  if (status === 'approved') {
    return (
      <div className="flex flex-col items-center text-center py-10 px-2 sm:py-12">
        <IconTile icon={CheckCircle} tone="green" size="lg" className="!w-20 !h-20 !rounded-full mb-6" />
        <h2 className="text-primary text-2xl font-bold mb-2">Payment Approved!</h2>
        <p className="text-secondary text-[15px] leading-relaxed max-w-sm mb-8">Your cashout of <span className="text-primary font-semibold tabular-nums">${amount}</span> has been successfully processed and sent to your {methodName} account.</p>
        <Button onClick={onViewHistory} full className="max-w-xs">View History</Button>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="flex flex-col items-center text-center py-10 px-2 sm:py-12">
        <IconTile icon={XCircle} tone="red" size="lg" className="!w-20 !h-20 !rounded-full mb-6" />
        <h2 className="text-primary text-2xl font-bold mb-2">Payment Rejected</h2>
        <p className="text-secondary text-[15px] leading-relaxed max-w-sm mb-8">Your cashout of <span className="text-primary font-semibold tabular-nums">${amount}</span> could not be processed. Please contact support.</p>
        <div className="w-full max-w-xs space-y-3">
          {smsUrl && (
            <a href={smsUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary', full: true })}>
              <MessageCircle size={18} strokeWidth={2} /> Contact Text Support
            </a>
          )}
          <a href={telegramHref} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'primary', full: true })}>
            <Send size={18} strokeWidth={2} /> Contact Telegram Support
          </a>
          <Button onClick={onClose} variant="ghost" full>Close</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-2 sm:py-4">
      <div className="w-full flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-primary text-xl font-bold tracking-tight">Withdrawal Submitted</h2>
          <p className="text-secondary text-[14px] mt-1">
            <span className="font-semibold text-primary tabular-nums">${amount}</span> via {methodName}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="w-10 h-10 -mr-1.5 -mt-1.5 flex-shrink-0 inline-flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ring Timer */}
      <div className="relative flex items-center justify-center my-2" style={{ width: 180, height: 180 }}>
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 40px rgba(${glowColor}, 0.22)`, transition: 'box-shadow 1s ease' }} />
        <div className="absolute inset-4 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(${glowColor}, 0.08) 0%, transparent 70%)` }} />
        <svg className="absolute inset-0 -rotate-90" width="180" height="180" aria-hidden="true">
          <circle cx="90" cy="90" r={radius} fill="none" style={{ stroke: 'var(--border-strong)' }} strokeWidth="8" />
          <circle cx="90" cy="90" r={radius} fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }} />
        </svg>
        <div className="relative flex flex-col items-center">
          {expired ? <CheckCircle className="w-12 h-12 text-emerald-400" /> : (
            <>
              <span className="text-primary text-[40px] font-bold tabular-nums leading-none tracking-tight">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="text-secondary text-[13px] mt-1.5">remaining</span>
            </>
          )}
        </div>
      </div>

      <motion.div key={msg.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-5 mb-6">
        <p className="text-primary font-semibold text-[17px]">{msg.text}</p>
        <p className="text-secondary text-[14px] mt-1">{msg.sub}</p>
      </motion.div>

      <div className="w-full grid grid-cols-3 gap-2.5 mb-6">
        {[
          { icon: Shield, label: 'Secure', tone: 'green' as const },
          { icon: Zap, label: 'Fast Transfer', tone: 'cyan' as const },
          { icon: Clock, label: '24/7 Support', tone: 'purple' as const },
        ].map(({ icon, label, tone }) => (
          <div key={label} className="bg-surface-elevated rounded-2xl px-2 py-3 flex flex-col items-center gap-2 border border-border-subtle">
            <IconTile icon={icon} tone={tone} size="sm" className="!rounded-full" />
            <span className="text-secondary text-[12px] font-medium text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>

      <div className="w-full space-y-2.5 sm:max-w-md">
        {smsUrl && (
          <a href={smsUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary', full: true })}>
            <Headphones size={18} strokeWidth={2} /> Track via Text Support
          </a>
        )}
        <a href={telegramHref} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'primary', full: true })}>
          <Send size={18} strokeWidth={2} /> Track via Telegram Support
        </a>
        <Button onClick={onViewHistory} variant="ghost" full>View History</Button>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function CashoutsPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // Form state
  const [methods, setMethods]           = useState<any[]>([])
  const [subGroup, setSubGroup]         = useState<'chime' | 'cashapp' | null>(null)
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
    if (numAmount < MIN_WITHDRAWAL_USD) return toast.error(MIN_WITHDRAWAL_MESSAGE)
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
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          className="!mb-0"
          title="Cashouts"
          subtitle="Withdraw your winnings securely."
          actions={
            <>
              <Button onClick={() => { resetForm(); setTab('new') }} id="new-cashout-btn" size="sm"
                variant={tab === 'new' ? 'primary' : 'secondary'}>
                <Plus className="w-4 h-4" /> New Request
              </Button>
              <Button onClick={() => { setTab('history'); fetchHistory() }} id="history-tab-btn" size="sm"
                variant={tab === 'history' ? 'primary' : 'secondary'}>
                <History className="w-4 h-4" /> History
              </Button>
            </>
          }
        />
      </motion.div>

      {/* Notice */}
      <Card className="flex items-start gap-3.5 !p-4 sm:!p-5">
        <IconTile icon={Info} tone="cyan" size="md" />
        <div className="min-w-0 pt-0.5">
          <p className="text-primary text-[15px] font-semibold">Cashout Processing</p>
          <p className="text-secondary text-[14px] leading-relaxed mt-0.5">Withdrawals are reviewed in under 10 minutes. Ensure your payment info is correct before submitting.</p>
        </div>
      </Card>

      {/* New Request Tab */}
      <AnimatePresence mode="wait">
        {tab === 'new' && (
          <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* STEP 3 — Countdown Timer */}
            {step === 3 && (
              <Card className="max-w-xl mx-auto overflow-hidden">
                <WithdrawalCountdown
                  amount={amount}
                  methodName={selectedMethod?.name || ''}
                  settings={settings}
                  onClose={resetForm}
                  withdrawalId={withdrawalId}
                  onViewHistory={handleViewHistory}
                />
              </Card>
            )}

            {/* STEP 1 — Select Method */}
            {step === 1 && (
              <div>
                <SectionHeading title="Select withdrawal method" />
                {loadingMethods ? (
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-[148px] sm:h-[164px] !rounded-[20px]" />
                    ))}
                  </div>
                ) : methods.length === 0 ? (
                  <Card><EmptyState icon={ArrowUpCircle} title="No cashout methods available" text="No cashout methods available at this time." /></Card>
                ) : (
                  (() => {
                    const list = [...methods]
                      .filter(m => m.code !== 'zappay' && !m.name?.toLowerCase().includes('zappay'))
                      .sort((a, b) => {
                        if (a.cashoutEnabled === b.cashoutEnabled) return 0
                        return a.cashoutEnabled ? -1 : 1
                      })
                    const renderCard = (m: any) => {
                      const isSoon = !m.cashoutEnabled
                      return (
                        <button key={m.id} onClick={() => !isSoon && handleSelect(m)} disabled={isSoon}
                          className={cn(
                            cardClass({ interactive: !isSoon }),
                            'group relative h-full w-full min-h-[128px] flex flex-col items-center justify-center text-center gap-3 !p-4 sm:!p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                            isSoon && 'cursor-not-allowed'
                          )}
                          style={isSoon ? { opacity: 0.55 } : undefined}>
                          {isSoon && <Badge tone="slate" className="absolute top-3 right-3 !text-[11px]">Soon</Badge>}
                          <BrandIcon kind={m.code || m.name} size="lg" glow={!isSoon} />
                          <div className="min-w-0 w-full">
                            <p className="text-primary font-bold text-[15px] sm:text-[16px] leading-snug break-words">{m.name}</p>
                            <p className="text-[11.5px] sm:text-[12.5px] text-muted mt-1 leading-snug tabular-nums">
                              {!isSoon ? `Min: $${Math.max(MIN_WITHDRAWAL_USD, m.minAmount || 0)} · Max: $${m.maxAmount?.toLocaleString()}` : 'Currently unavailable'}
                            </p>
                          </div>
                        </button>
                      )
                    }
                    const gridCls = 'grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'
                    const groupOf = (m: any): 'chime' | 'cashapp' | null => {
                      const c = String(m.code || '').toLowerCase()
                      return c === 'chime' || c === 'chime2' ? 'chime' : c === 'cashapp' || c === 'cashapp2' ? 'cashapp' : null
                    }
                    const renderGroupCard = (key: 'chime' | 'cashapp', group: any[]) => {
                      const enabled = group.some(m => m.cashoutEnabled)
                      return (
                        <button key={`group-${key}`}
                          onClick={() => enabled && (group.filter(m => m.cashoutEnabled).length === 1 ? handleSelect(group.find(m => m.cashoutEnabled)) : setSubGroup(key))}
                          disabled={!enabled}
                          className={cn(
                            cardClass({ interactive: enabled }),
                            'group relative h-full w-full min-h-[128px] flex flex-col items-center justify-center text-center gap-3 !p-4 sm:!p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                            !enabled && 'cursor-not-allowed'
                          )}
                          style={!enabled ? { opacity: 0.55 } : undefined}>
                          {!enabled && <Badge tone="slate" className="absolute top-3 right-3 !text-[11px]">Soon</Badge>}
                          <BrandIcon kind={key} size="lg" glow={enabled} />
                          <p className="text-primary font-bold text-[15px] sm:text-[16px] leading-snug">{key === 'chime' ? 'Chime' : 'CashApp Pay'}</p>
                        </button>
                      )
                    }
                    // Chime 1/2 and CashApp 1/2 collapse into one card each (first occurrence keeps its position)
                    const collapse = (arr: any[]) => {
                      const seen = new Set<string>()
                      return arr.flatMap(m => {
                        const g = groupOf(m)
                        if (!g) return [renderCard(m)]
                        if (seen.has(g)) return []
                        seen.add(g)
                        return [renderGroupCard(g, list.filter(x => groupOf(x) === g))]
                      })
                    }
                    if (subGroup) {
                      return (
                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => setSubGroup(null)}
                            className="inline-flex items-center gap-1.5 h-10 -ml-2 px-2 rounded-xl text-[14px] font-medium text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                          >
                            <ArrowLeft className="w-4 h-4" /> Back to methods
                          </button>
                          <div className={gridCls}>{list.filter(m => groupOf(m) === subGroup).map(renderCard)}</div>
                        </div>
                      )
                    }
                    const cash = list.filter(m => !isCryptoMethod(m))
                    const crypto = list.filter(isCryptoMethod)
                    if (!cash.length || !crypto.length) return <div className={gridCls}>{collapse(list)}</div>
                    return (
                      <div className="space-y-6">
                        <div>
                          <SectionHeading title="Cash methods" />
                          <div className={gridCls}>{collapse(cash)}</div>
                        </div>
                        <div>
                          <SectionHeading title="Cryptocurrency" />
                          <div className={gridCls}>{crypto.map(renderCard)}</div>
                        </div>
                      </div>
                    )
                  })()
                )}
              </div>
            )}

            {/* STEP 2 — Amount + Fields form (matches homepage modal exactly) */}
            {step === 2 && selectedMethod && (() => {
              const fields = getFields(selectedMethod)

              return (
                <Card className="max-w-2xl mx-auto !p-5 sm:!p-7">
                  {/* Header */}
                  <div className="flex items-start gap-3.5">
                    <BrandIcon kind={selectedMethod.code || selectedMethod.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-primary font-bold text-xl sm:text-[22px] tracking-tight break-words">{selectedMethod.name}</h2>
                      <p className="text-secondary text-[14px] mt-1">Fill in all the fields to create a withdrawal request.</p>
                    </div>
                    <button onClick={resetForm} aria-label="Close"
                      className="w-10 h-10 -mr-2 -mt-1 flex-shrink-0 inline-flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-6 space-y-6">
                    {/* Balance */}
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-elevated border border-border-subtle px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <IconTile icon={Wallet} tone="green" size="sm" />
                        <span className="text-secondary text-[14px]">Available balance</span>
                      </div>
                      <span className="text-primary font-bold text-[24px] sm:text-[26px] tabular-nums leading-none">${withdrawable.toFixed(2)}</span>
                    </div>
                    {withdrawable < MIN_WITHDRAWAL_USD && (
                      <p className="text-[13px] text-amber-400 -mt-2">You need at least ${MIN_WITHDRAWAL_USD} in your wallet to cash out.</p>
                    )}

                    {/* Amount */}
                    <div>
                      <label htmlFor="cashout-amount" className="block text-[13px] font-medium text-secondary mb-2">Enter cashout amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-2xl font-bold pointer-events-none">$</span>
                        <input id="cashout-amount" type="text" inputMode="decimal" value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="ds-input !text-[28px] font-bold tabular-nums !h-16 !pl-10 !pr-12"
                          placeholder="0.00" />
                        {amount !== '0.00' && amount !== '' && (
                          <button onClick={() => setAmount('0.00')} aria-label="Clear amount"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-muted hover:text-primary rounded-full">
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {[25, 50, 75, 100].map(pct => (
                          <button key={pct} type="button" onClick={() => handlePercentage(pct)}
                            className="h-11 rounded-xl bg-surface-elevated border border-border-subtle hover:border-border-strong hover:brightness-110 font-semibold text-[14px] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                            style={{ color: '#38BDF8' }}>
                            {pct}%
                          </button>
                        ))}
                      </div>
                      {!!(selectedMethod.minAmount || selectedMethod.maxAmount) && (
                        <p className="text-[12px] text-muted mt-2.5">Min: ${Math.max(MIN_WITHDRAWAL_USD, selectedMethod.minAmount || 0)} · Max: ${selectedMethod.maxAmount?.toLocaleString()}</p>
                      )}
                    </div>

                    {/* Dynamic fields from payment method */}
                    {fields.length > 0 ? fields.map((field: any) => (
                      <Field key={field.name} label={<>{field.label}{field.required && <span className="text-red-400"> *</span>}</>}>
                        {field.type === 'select' ? (
                          <select value={fieldValues[field.name] || ''} onChange={e => setFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                            className="ds-input !text-base">
                            <option value="">{field.placeholder || 'Select...'}</option>
                            {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type="text" placeholder={field.placeholder || ''}
                            value={fieldValues[field.name] || ''}
                            onChange={e => setFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                            className="ds-input !text-base" />
                        )}
                      </Field>
                    )) : (
                      // Fallback generic account info field
                      <Field label={<>Your {selectedMethod.name} account info <span className="text-red-400">*</span></>}>
                        <input type="text" placeholder={`Enter your ${selectedMethod.name} details`}
                          value={fieldValues['accountInfo'] || ''}
                          onChange={e => setFieldValues(p => ({ ...p, accountInfo: e.target.value }))}
                          className="ds-input !text-base" />
                      </Field>
                    )}

                    {/* QR Code Upload */}
                    <div>
                      <p className="text-[13px] font-medium text-secondary mb-2">QR Code <span className="text-muted font-normal">(Optional)</span></p>
                      <label className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-border-strong bg-surface-elevated px-4 py-4 cursor-pointer transition-colors hover:brightness-110 focus-within:ring-2 focus-within:ring-sky-400/60">
                        <IconTile icon={UploadCloud} tone="cyan" size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-primary text-[14px] font-semibold truncate">
                            {qrFile ? qrFile.name : 'Upload a QR code image'}
                          </span>
                          <span className="block text-muted text-[12px] mt-0.5">
                            {qrFile ? 'Tap to choose a different file' : 'PNG or JPG · tap to browse'}
                          </span>
                        </span>
                        <input type="file" accept="image/*" onChange={e => setQrFile(e.target.files?.[0] || null)} className="sr-only" />
                      </label>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row-reverse gap-3 pt-1">
                      <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" full className="sm:flex-[2]">
                        {isSubmitting ? 'Processing...' : 'Continue'}
                      </Button>
                      <Button onClick={resetForm} variant="secondary" size="lg" full className="sm:flex-1">
                        Back
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })()}
          </motion.div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SectionHeading title="Cashout history" />
            <Card padded={false} className="overflow-hidden">
              {/* Column headings (desktop) */}
              {!historyLoading && history.length > 0 && (
                <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_130px_110px_130px] gap-x-4 px-6 py-3.5 border-b border-border-subtle text-[12px] font-semibold text-muted">
                  <span>Method / Reference</span><span>Date</span><span>Amount</span><span>Status</span>
                </div>
              )}
              {historyLoading ? (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                      <div className="space-y-2 flex-1"><Skeleton className="h-4 w-1/3 !rounded-lg" /><Skeleton className="h-3 w-1/2 !rounded-lg" /></div>
                      <Skeleton className="h-8 w-20 !rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <EmptyState icon={ArrowUpCircle} title="No cashout requests yet."
                  text="Your withdrawal requests will show up here."
                  action={<Button onClick={() => setTab('new')} size="sm">Create your first request <ChevronRight className="w-4 h-4" /></Button>} />
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {history.map((tx: any, i) => {
                    const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    return (
                      <motion.li key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="px-4 sm:px-6 py-4 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_130px_110px_130px] gap-x-4 gap-y-1.5 items-center">
                        <div className="min-w-0 md:row-span-1 row-span-2">
                          <p className="text-primary text-[15px] font-semibold truncate">{tx.paymentMethod?.name || tx.paymentMethodStr || tx.adminNotes || 'Manual'}</p>
                          <p className="mt-1 text-[12px] text-muted font-mono break-all leading-snug">{tx.requestId || tx.id.slice(0, 10)}</p>
                          <p className="md:hidden mt-1 text-[12px] text-muted">{dateStr}</p>
                        </div>
                        <p className="hidden md:block text-[13px] text-secondary">{dateStr}</p>
                        <p className="text-primary font-bold text-[16px] tabular-nums text-right md:text-left">${tx.amount.toFixed(2)}</p>
                        <div className="justify-self-end md:justify-self-start"><StatusBadge status={tx.status} /></div>
                        {tx.status === 'pending' && (
                          <p className="col-span-full text-[12px] text-secondary flex items-center gap-1.5 mt-1">
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FBBF24' }} /> Processing ~10-15 mins
                          </p>
                        )}
                        {tx.status === 'rejected' && tx.rejectionReason && (
                          <p className="col-span-full text-[13px] text-red-400 flex items-start gap-1.5 mt-1 break-words min-w-0">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span className="min-w-0">{tx.rejectionReason}</span>
                          </p>
                        )}
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
