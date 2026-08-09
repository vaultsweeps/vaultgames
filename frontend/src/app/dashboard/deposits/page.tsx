'use client'
import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { CreditCard, Plus, History, Loader2, ChevronRight, ExternalLink } from 'lucide-react'
import { depositApi, publicApi } from '@/lib/api'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const ZappayDepositModal = dynamic(() => import('@/components/modals/ZappayDepositModal'), { ssr: false })
const ChimePayPalDepositModal = dynamic(() => import('@/components/modals/ChimePayPalDepositModal'), { ssr: false })

// Method icon/color map
const METHOD_META: Record<string, { icon: string; color: string; desc: string; logoUrl?: string }> = {
  cashapp: { icon: '💸', color: '#00D632', desc: 'Send via Cash App — fast & easy' },
  chime:   { icon: '🏦', color: '#00CFAA', desc: 'Deposit via Chime bank' },
  crypto:  { icon: '₿',  color: '#F7931A', desc: 'USDT, BTC, ETH & 100+ cryptocurrencies' },
  bitcoin: { icon: '₿',  color: '#F7931A', desc: 'Bitcoin payments' },
  usdt:    { icon: '₮',  color: '#26A17B', desc: 'Tether stablecoin (TRC20)' },
  bank:    { icon: '🏛️', color: '#00D4FF', desc: 'Bank wire transfer' },
  apple:   { icon: '', color: '#000000', desc: 'Apple Pay — tap & pay instantly', logoUrl: 'https://i.pinimg.com/originals/ae/85/92/ae859253f4141e38711d2c159a53649e.jpg' },
  card:    { icon: '💳', color: '#2563EB', desc: 'Debit card — pay securely' },
  default: { icon: '💳', color: '#7B2FFF', desc: 'Digital payment' },
}

function getMeta(code: string) {
  return METHOD_META[code?.toLowerCase()] || METHOD_META.default
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:    'badge-pending',
    approved:   'badge-approved',
    failed:     'badge-rejected',
    processing: 'badge-pending',
  }
  return (
    <span className={`${map[status] || 'badge-pending'} text-xs px-2 py-0.5 rounded-full font-mono`}>
      {status}
    </span>
  )
}

function DepositsContent() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [methods, setMethods] = useState<any[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState(1)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositHistory, setDepositHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [zappayMethod, setZappayMethod] = useState<'zappay'|'apple'|'card'|null>(null)
  const [chimePayPalMethod, setChimePayPalMethod] = useState<'chime'|'paypal'|'cashapp'|null>(null)
  const [cryptoPaymentUrl, setCryptoPaymentUrl] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await depositApi.getAll()
      setDepositHistory(res.data.data)
    } catch { } finally {
      setHistoryLoading(false)
    }
  }

  // Handle NOWPayments return URL params
  useEffect(() => {
    const payment = searchParams.get('payment')
    if (payment === 'success') {
      toast.success('Payment submitted! Waiting for blockchain confirmation...')
      setTab('history')
    } else if (payment === 'cancelled') {
      toast.error('Payment was cancelled. You can try again.')
    }
  }, [])

  useEffect(() => {
    setHistoryLoading(true)
    setLoadingMethods(true)
    Promise.all([
      depositApi.getAll(),
      depositApi.getPaymentMethods()
    ]).then(([histRes, methRes]) => {
      setDepositHistory(histRes.data.data)
      setMethods(methRes.data.data || [])
    }).catch(() => {
      setMethods([])
    }).finally(() => {
      setHistoryLoading(false)
      setLoadingMethods(false)
    })
  }, [])

  const handleSubmit = async () => {
    if (!selectedMethod || !depositAmount) return toast.error('Please complete all fields')
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount')
    if (amount < selectedMethod.minAmount) return toast.error(`Minimum deposit is $${selectedMethod.minAmount}`)
    if (amount > selectedMethod.maxAmount) return toast.error(`Maximum deposit is $${selectedMethod.maxAmount}`)
    setIsSubmitting(true)
    try {
      const res = await depositApi.create({ amount, paymentMethodId: selectedMethod.id })
      const { paymentUrl } = res.data.data || {}

      // Crypto via NOWPayments — redirect user to hosted payment page
      if (paymentUrl && selectedMethod.code?.toLowerCase() === 'crypto') {
        toast.success('Redirecting to payment page...')
        await fetchHistory()
        window.location.href = paymentUrl
        return
      }

      setStep(3)
      await fetchHistory()
      toast.success('Deposit request created!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit deposit')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedMethod(null)
    setDepositAmount('')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">DEPOSITS</h2>
        <p className="text-secondary text-sm mt-1">Fund your account to access platform features.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ id: 'new', label: 'New Deposit', icon: Plus }, { id: 'history', label: 'History', icon: History }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-secondary hover:text-white border border-border-strong'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* STEP 1 — Select Method */}
          {step === 1 && (
            <div>
              <h3 className="font-display text-sm font-bold text-secondary uppercase tracking-wider mb-4">
                Select Payment Method
              </h3>
              {loadingMethods ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={`meth-skel-${i}`} className="glass-card p-5 h-24 animate-pulse bg-white/5"></div>
                  ))}
                </div>
              ) : methods.length === 0 ? (
                <p className="text-muted py-8">No deposit methods available. Please contact support.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {methods
                    .sort((a, b) => {
                      const workingCodes = ['chime', 'paypal', 'cashapp', 'crypto'];
                      const aSoon = !workingCodes.includes(a.code?.toLowerCase() || '');
                      const bSoon = !workingCodes.includes(b.code?.toLowerCase() || '');
                      if (aSoon === bSoon) return 0;
                      return aSoon ? 1 : -1;
                    })
                    .map(m => {
                    const meta = getMeta(m.code)
                    const workingCodes = ['chime', 'paypal', 'cashapp', 'crypto'];
                    const isSoon = !workingCodes.includes(m.code?.toLowerCase() || '');
                    return (
                      <button key={m.id}
                        onClick={() => { 
                          if (isSoon) {
                            toast.error('This method is coming soon!')
                            return
                          }
                          if (m.code === 'zappay' || m.name?.toLowerCase().includes('zappay')) {
                            setZappayMethod('zappay')
                          } else if (m.code === 'apple' || m.name?.toLowerCase().includes('apple')) {
                            setZappayMethod('apple')
                          } else if (m.code === 'card' || m.name?.toLowerCase().includes('card') || m.name?.toLowerCase().includes('debit')) {
                            setZappayMethod('card')
                          } else if (['chime', 'paypal', 'cashapp'].includes(m.code.toLowerCase())) {
                            setChimePayPalMethod(m.code.toLowerCase() as 'chime' | 'paypal' | 'cashapp')
                          } else {
                            setSelectedMethod(m); 
                            setStep(2) 
                          }
                        }}
                        className={`glass-card p-5 text-left transition-all group flex flex-col gap-3 ${isSoon ? 'opacity-50 cursor-not-allowed hover:bg-white/5' : 'hover:-translate-y-1'}`}>
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl overflow-hidden"
                            style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                            {(meta as any).logoUrl
                               ? <img src={(meta as any).logoUrl} alt={m.name} className="w-full h-full object-cover rounded-2xl" />
                               : meta.icon
                             }
                          </div>
                          {isSoon && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-secondary border border-border-strong">
                              Soon
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold">{m.name}</p>
                          <p className="text-xs text-muted mt-0.5">{meta.desc}</p>
                          {!isSoon && <p className="text-xs text-slate-600 mt-1">Min: ${m.minAmount} · Max: ${m.maxAmount.toLocaleString()}</p>}
                        </div>
                        {!isSoon && <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-neon-blue transition-colors self-end" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Enter Amount */}
          {step === 2 && selectedMethod && (() => {
            const meta = getMeta(selectedMethod.code)
            return (
              <div className="glass-card p-6 max-w-md space-y-5">
                <button onClick={() => setStep(1)} className="text-xs text-muted hover:text-white transition-colors">← Back</button>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                    {meta.icon}
                  </div>
                  <div>
                    <p className="text-white font-bold">{selectedMethod.name}</p>
                    <p className="text-xs text-muted">Min: ${selectedMethod.minAmount} · Max: ${selectedMethod.maxAmount.toLocaleString()}</p>
                  </div>
                </div>
                {selectedMethod.instructions && (
                  <p className="text-xs text-secondary bg-white/5 rounded-xl p-3 border border-border-subtle">
                    {selectedMethod.instructions}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Deposit Amount (USD)</label>
                  <input
                    type="number" value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder={`Min $${selectedMethod.minAmount}`}
                    className="input-neon text-xl font-display"
                    min={selectedMethod.minAmount}
                    max={selectedMethod.maxAmount}
                  />
                  <div className="flex gap-2 mt-3">
                    {[50, 100, 250, 500].map(amt => (
                      <button key={amt} onClick={() => setDepositAmount(String(amt))}
                        className="px-3 py-1.5 text-xs glass rounded-lg text-secondary hover:text-neon-blue border border-border-strong hover:border-neon-blue/30 transition-all">
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSubmit} disabled={isSubmitting}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'CONTINUE TO PAYMENT'}
                </button>
              </div>
            )
          })()}

          {/* STEP 3 — Success */}
          {step === 3 && selectedMethod && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8 max-w-md text-center">
              <div className="w-16 h-16 bg-neon-blue/10 border border-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-neon-blue" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">PAYMENT REQUEST CREATED</h3>
              <p className="text-secondary text-sm mb-6">
                Your deposit request for <span className="text-white font-medium">${depositAmount}</span> via {selectedMethod.name} has been submitted.
              </p>
              <div className="glass rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Method</span><span className="text-white">{selectedMethod.name}</span></div>
                <div className="flex justify-between"><span className="text-muted">Amount</span><span className="text-neon-blue font-mono">${depositAmount}</span></div>
                <div className="flex justify-between"><span className="text-muted">Status</span><span className="badge-pending text-xs px-2 py-0.5 rounded-full">PENDING</span></div>
              </div>
              <p className="text-xs text-muted mb-4">
                Our team will review and approve your deposit within 1–24 hours.
              </p>
              <div className="flex gap-3">
                <button onClick={resetForm} className="btn-neon flex-1 text-sm py-2.5">New Deposit</button>
                <button onClick={() => setTab('history')} className="glass flex-1 text-sm py-2.5 rounded-xl text-secondary hover:text-white border border-border-strong transition-all">View History</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={`skel-tx-${i}`}>
                        <td><div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div></td>
                        <td><div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div></td>
                        <td><div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div></td>
                        <td><div className="h-5 w-16 bg-slate-800 rounded-full animate-pulse"></div></td>
                        <td><div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div></td>
                      </tr>
                    ))
                  ) : depositHistory.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted">No deposits yet.</td></tr>
                  ) : depositHistory.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="font-mono text-xs text-secondary">{tx.paymentReference || tx.id.slice(0, 10)}</td>
                      <td>{tx.paymentMethod?.name || tx.currency}</td>
                      <td className="text-white font-medium">${tx.amount.toFixed(2)}</td>
                      <td><StatusBadge status={tx.status} /></td>
                      <td className="text-xs text-slate-600">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      <ZappayDepositModal 
        isOpen={zappayMethod !== null} 
        onClose={() => {
          setZappayMethod(null)
          fetchHistory()
        }} 
        method={zappayMethod}
      />
      <ChimePayPalDepositModal
        isOpen={chimePayPalMethod !== null}
        onClose={() => {
          setChimePayPalMethod(null)
          fetchHistory()
        }}
        method={chimePayPalMethod}
      />
    </div>
  )
}

export default function DepositsPage() {
  return (
    <Suspense fallback={<div className="space-y-6 max-w-4xl"><div className="h-8 w-32 bg-white/5 rounded animate-pulse" /></div>}>
      <DepositsContent />
    </Suspense>
  )
}
