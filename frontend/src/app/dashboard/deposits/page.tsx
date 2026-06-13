'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CreditCard, Plus, History, RefreshCw } from 'lucide-react'
import { depositApi } from '@/lib/api'

const PAYMENT_METHODS = [
  { id: 'bitcoin', name: 'Bitcoin', type: 'crypto', icon: '₿', min: 10, max: 10000, color: '#F7931A', desc: 'BTC payments - fastest processing' },
  { id: 'usdt', name: 'USDT (TRC20)', type: 'crypto', icon: '₮', min: 10, max: 50000, color: '#26A17B', desc: 'Tether stablecoin on TRON network' },
  { id: 'eth', name: 'Ethereum', type: 'crypto', icon: 'Ξ', min: 20, max: 20000, color: '#627EEA', desc: 'ETH payment network' },
  { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦', min: 50, max: 100000, color: '#00D4FF', desc: 'Direct bank wire transfer' },
  { id: 'card', name: 'Credit / Debit Card', type: 'card', icon: '💳', min: 20, max: 5000, color: '#7B2FFF', desc: 'Visa, Mastercard accepted' },
  { id: 'wallet', name: 'E-Wallet', type: 'wallet', icon: '👛', min: 10, max: 2000, color: '#FF2D9B', desc: 'Skrill, Neteller, PayPal' },
]


function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: 'badge-pending', approved: 'badge-approved', failed: 'badge-rejected', processing: 'badge-pending' }
  return <span className={`${map[status] || 'badge-pending'} text-xs px-2 py-0.5 rounded-full font-mono`}>{status}</span>
}

export default function DepositsPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositHistory, setDepositHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await depositApi.getAll()
      setDepositHistory(res.data.data)
    } catch { /* silently fail */ } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  const method = PAYMENT_METHODS.find(m => m.id === selectedMethod)

  const handleSubmit = async () => {
    if (!selectedMethod || !depositAmount) return toast.error('Please complete all fields')
    const amount = parseFloat(depositAmount)
    if (!method) return
    if (amount < method.min) return toast.error(`Minimum deposit is $${method.min}`)
    if (amount > method.max) return toast.error(`Maximum deposit is $${method.max}`)
    setIsSubmitting(true)
    try {
      const paymentMethodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod)
      await depositApi.create({ amount: parseFloat(depositAmount), paymentMethodId: selectedMethod })
      setStep(3)
      await fetchHistory()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit deposit')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">DEPOSITS</h2>
        <p className="text-slate-400 text-sm mt-1">Fund your account to access platform features.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ id: 'new', label: 'New Deposit', icon: Plus }, { id: 'history', label: 'History', icon: History }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-slate-400 hover:text-white border border-white/10'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {step === 1 && (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Select Payment Method</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMethod(m.id); setStep(2) }}
                    className={`glass-card p-4 text-left transition-all hover:-translate-y-1 group`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${m.color}20`, border: `1px solid ${m.color}30` }}>
                        {m.icon}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{m.type.toUpperCase()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{m.desc}</p>
                    <p className="text-xs text-slate-600 mt-2">Min: ${m.min} · Max: ${m.max.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && method && (
            <div className="glass-card p-6 max-w-md">
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white mb-4 transition-colors">← Back</button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${method.color}20`, border: `1px solid ${method.color}30` }}>
                  {method.icon}
                </div>
                <div>
                  <p className="text-white font-medium">{method.name}</p>
                  <p className="text-xs text-slate-500">Min: ${method.min} · Max: ${method.max.toLocaleString()}</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Deposit Amount (USD)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder={`Min $${method.min}`}
                  className="input-neon text-xl font-display"
                  min={method.min}
                  max={method.max}
                />
                <div className="flex gap-2 mt-3">
                  {[50, 100, 250, 500].map(amt => (
                    <button key={amt} onClick={() => setDepositAmount(String(amt))}
                      className="px-3 py-1.5 text-xs glass rounded-lg text-slate-400 hover:text-neon-blue border border-white/10 hover:border-neon-blue/30 transition-all">
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : 'CONTINUE TO PAYMENT'}
              </button>
            </div>
          )}

          {step === 3 && method && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 max-w-md text-center">
              <div className="w-16 h-16 bg-neon-blue/10 border border-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-neon-blue" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">PAYMENT REQUEST CREATED</h3>
              <p className="text-slate-400 text-sm mb-6">Your deposit request for <span className="text-white font-medium">${depositAmount}</span> via {method.name} has been submitted.</p>
              <div className="glass rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-white">{method.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="text-neon-blue font-mono">${depositAmount}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="badge-pending text-xs px-2 py-0.5 rounded-full">PENDING</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="text-white font-mono text-xs">DEP-{Date.now().toString().slice(-6)}</span></div>
              </div>
              <p className="text-xs text-slate-500 mb-4">Complete the payment using the instructions sent to your email. Your deposit will be approved once payment is confirmed.</p>
              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setSelectedMethod(''); setDepositAmount('') }} className="btn-neon flex-1 text-sm py-2.5">New Deposit</button>
                <button onClick={() => setTab('history')} className="glass flex-1 text-sm py-2.5 rounded-xl text-slate-400 hover:text-white border border-white/10 transition-all">View History</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

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
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : depositHistory.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No deposits yet.</td></tr>
                  ) : depositHistory.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="font-mono text-xs text-slate-400">{tx.paymentReference || tx.id.slice(0, 10)}</td>
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
    </div>
  )
}
