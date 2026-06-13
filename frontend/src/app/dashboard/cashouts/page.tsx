'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ArrowUpCircle, Plus, History, Info } from 'lucide-react'
import { withdrawalApi } from '@/lib/api'

const WITHDRAWAL_METHODS = [
  { id: 'bitcoin', name: 'Bitcoin', icon: '₿', min: 20, max: 10000, color: '#F7931A', fields: [{ name: 'address', label: 'BTC Wallet Address', placeholder: 'bc1q...' }] },
  { id: 'usdt', name: 'USDT (TRC20)', icon: '₮', min: 20, max: 50000, color: '#26A17B', fields: [{ name: 'address', label: 'USDT Wallet Address (TRC20)', placeholder: 'T...' }] },
  { id: 'bank', name: 'Bank Transfer', icon: '🏦', min: 100, max: 100000, color: '#00D4FF', fields: [
    { name: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
    { name: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
    { name: 'account_name', label: 'Account Holder Name', placeholder: 'Full name' },
  ]},
]


function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', paid: 'badge-paid' }
  return <span className={`${map[status] || 'badge-pending'} text-xs px-2 py-0.5 rounded-full font-mono`}>{status}</span>
}

export default function CashoutsPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await withdrawalApi.getAll()
      setHistory(res.data.data)
    } catch { } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  const method = WITHDRAWAL_METHODS.find(m => m.id === selectedMethod)

  const handleSubmit = async () => {
    if (!selectedMethod || !amount) return toast.error('Please complete all fields')
    const amt = parseFloat(amount)
    if (!method) return
    if (amt < method.min) return toast.error(`Minimum cashout is $${method.min}`)
    const allFilled = method.fields.every(f => fieldValues[f.name])
    if (!allFilled) return toast.error('Please fill all payment details')
    setIsSubmitting(true)
    try {
      const accountInfo = method.fields.map(f => `${f.label}: ${fieldValues[f.name]}`).join(', ')
      await withdrawalApi.create({ amount: parseFloat(amount), paymentMethodId: selectedMethod, accountInfo })
      setStep(3)
      toast.success('Cashout request submitted successfully!')
      await fetchHistory()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit cashout')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">CASHOUTS</h2>
        <p className="text-slate-400 text-sm mt-1">Withdraw your winnings securely.</p>
      </motion.div>

      {/* Info banner */}
      <div className="glass rounded-xl p-4 flex gap-3 border border-neon-blue/20">
        <Info className="w-5 h-5 text-neon-blue flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white font-medium">Cashout Processing</p>
          <p className="text-xs text-slate-400 mt-1">Withdrawals are reviewed by our team within 1-24 hours. Crypto cashouts are typically faster. Please ensure your payment details are correct.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ id: 'new', label: 'New Request', icon: Plus }, { id: 'history', label: 'History', icon: History }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-slate-400 hover:text-white border border-white/10'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {step === 1 && (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Select Withdrawal Method</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {WITHDRAWAL_METHODS.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMethod(m.id); setStep(2) }}
                    className="glass-card p-5 text-left hover:-translate-y-1 transition-all group">
                    <div className="text-2xl mb-3">{m.icon}</div>
                    <p className="text-white font-medium mb-1">{m.name}</p>
                    <p className="text-xs text-slate-500">Min: ${m.min} · Max: ${m.max.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && method && (
            <div className="glass-card p-6 max-w-md space-y-4">
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white transition-colors">← Back</button>
              <h3 className="font-display font-bold text-white">Cashout via {method.name}</h3>

              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Amount (USD)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Min $${method.min}`} className="input-neon text-xl font-display" />
                <div className="flex gap-2 mt-3">
                  {[50, 100, 200, 500].map(amt => (
                    <button key={amt} onClick={() => setAmount(String(amt))}
                      className="px-3 py-1.5 text-xs glass rounded-lg text-slate-400 hover:text-neon-blue border border-white/10 hover:border-neon-blue/30 transition-all">
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {method.fields.map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">{field.label}</label>
                  <input type="text" placeholder={field.placeholder}
                    value={fieldValues[field.name] || ''}
                    onChange={e => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="input-neon" />
                </div>
              ))}

              <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : 'SUBMIT CASHOUT REQUEST'}
              </button>
            </div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 max-w-md text-center">
              <div className="w-16 h-16 bg-green-400/10 border border-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowUpCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">REQUEST SUBMITTED</h3>
              <p className="text-slate-400 text-sm mb-6">Your cashout request has been submitted. Our team will review and process it within 1-24 hours.</p>
              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setSelectedMethod(''); setAmount(''); setFieldValues({}) }} className="btn-neon flex-1 text-sm py-2.5">New Request</button>
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
                <thead><tr><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No cashouts yet.</td></tr>
                  ) : history.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="font-mono text-xs text-slate-400">{tx.id.slice(0, 10)}</td>
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
