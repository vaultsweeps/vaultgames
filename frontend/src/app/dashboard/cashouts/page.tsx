'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ArrowUpCircle, Plus, History, Info, ChevronRight, Loader2 } from 'lucide-react'
import { withdrawalApi, depositApi, publicApi } from '@/lib/api'

// Method icon/color map based on code
const METHOD_META: Record<string, { icon: string; color: string }> = {
  cashapp:  { icon: '💸', color: '#00D632' },
  chime:    { icon: '🏦', color: '#00CFAA' },
  crypto:   { icon: '₿',  color: '#F7931A' },
  bitcoin:  { icon: '₿',  color: '#F7931A' },
  usdt:     { icon: '₮',  color: '#26A17B' },
  bank:     { icon: '🏛️', color: '#00D4FF' },
  default:  { icon: '💰', color: '#7B2FFF' },
}

function getMeta(code: string) {
  return METHOD_META[code?.toLowerCase()] || METHOD_META.default
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    paid:     'badge-paid',
  }
  return (
    <span className={`${map[status] || 'badge-pending'} text-xs px-2 py-0.5 rounded-full font-mono`}>
      {status}
    </span>
  )
}

export default function CashoutsPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [methods, setMethods] = useState<any[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [settings, setSettings] = useState<any>({})

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await withdrawalApi.getAll()
      setHistory(res.data.data)
    } catch { } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    publicApi.getSettings().then(res => setSettings(res.data.data)).catch(() => {})
    // Fetch payment methods from API
    depositApi.getPaymentMethods().then(res => {
      setMethods(res.data.data || [])
    }).catch(() => {
      setMethods([])
    }).finally(() => setLoadingMethods(false))
  }, [])

  // Parse fields from JSON string if needed
  const getFields = (method: any): any[] => {
    if (!method?.fields) return []
    if (Array.isArray(method.fields)) return method.fields
    try { return JSON.parse(method.fields) } catch { return [] }
  }

  const handleSubmit = async () => {
    if (!selectedMethod || !amount) return toast.error('Please complete all fields')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return toast.error('Enter a valid amount')
    if (amt < selectedMethod.minAmount) return toast.error(`Minimum cashout is $${selectedMethod.minAmount}`)
    if (amt > selectedMethod.maxAmount) return toast.error(`Maximum cashout is $${selectedMethod.maxAmount}`)

    const fields = getFields(selectedMethod)
    const allFilled = fields.filter((f: any) => f.required).every((f: any) => fieldValues[f.name]?.trim())
    if (!allFilled) return toast.error('Please fill all required payment details')

    setIsSubmitting(true)
    try {
      const accountInfo = fields.map((f: any) => `${f.label}: ${fieldValues[f.name] || ''}`).join(' | ')
      await withdrawalApi.create({
        amount: amt,
        paymentMethodId: selectedMethod.id,
        accountInfo,
      })
      setShowContactModal(true)
      toast.success('Cashout request submitted!')
      await fetchHistory()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit cashout')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedMethod(null)
    setAmount('')
    setFieldValues({})
    setShowContactModal(false)
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
          <p className="text-xs text-slate-400 mt-1">
            Withdrawals are reviewed within 1–24 hours. Ensure your payment info is correct before submitting.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ id: 'new', label: 'New Request', icon: Plus }, { id: 'history', label: 'History', icon: History }].map(t => (
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

          {/* STEP 1 — Select Method */}
          {step === 1 && (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Select Withdrawal Method
              </h3>
              {loadingMethods ? (
                <div className="flex items-center gap-3 text-slate-500 py-8">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading methods...
                </div>
              ) : methods.length === 0 ? (
                <p className="text-slate-500 py-8">No withdrawal methods available. Please contact support.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {methods.map(m => {
                    const meta = getMeta(m.code)
                    return (
                      <button key={m.id}
                        onClick={() => { setSelectedMethod(m); setStep(2) }}
                        className="glass-card p-5 text-left hover:-translate-y-1 transition-all group flex flex-col gap-3"
                      >
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                          style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                          {meta.icon}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{m.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Min: ${m.minAmount} · Max: ${m.maxAmount.toLocaleString()}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-neon-blue transition-colors mt-auto self-end" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Fill Details */}
          {step === 2 && selectedMethod && (() => {
            const meta = getMeta(selectedMethod.code)
            const fields = getFields(selectedMethod)
            return (
              <div className="glass-card p-6 max-w-md space-y-5">
                <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white transition-colors">← Back</button>

                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                    {meta.icon}
                  </div>
                  <div>
                    <p className="text-white font-bold">{selectedMethod.name}</p>
                    <p className="text-xs text-slate-500">Min: ${selectedMethod.minAmount} · Max: ${selectedMethod.maxAmount.toLocaleString()}</p>
                  </div>
                </div>

                {/* Instructions */}
                {selectedMethod.instructions && (
                  <p className="text-xs text-slate-400 bg-white/5 rounded-xl p-3 border border-white/5">
                    {selectedMethod.instructions}
                  </p>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Amount (USD)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder={`Min $${selectedMethod.minAmount}`} className="input-neon text-xl font-display" />
                  <div className="flex gap-2 mt-3">
                    {[50, 100, 200, 500].map(amt => (
                      <button key={amt} onClick={() => setAmount(String(amt))}
                        className="px-3 py-1.5 text-xs glass rounded-lg text-slate-400 hover:text-neon-blue border border-white/10 hover:border-neon-blue/30 transition-all">
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Fields */}
                {fields.map((field: any) => (
                  <div key={field.name}>
                    <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">
                      {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {field.type === 'select' && field.options ? (
                      <select
                        value={fieldValues[field.name] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="input-neon">
                        <option value="">Select...</option>
                        {field.options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" placeholder={field.placeholder || ''}
                        value={fieldValues[field.name] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="input-neon" />
                    )}
                  </div>
                ))}

                <button onClick={handleSubmit} disabled={isSubmitting}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'SUBMIT CASHOUT REQUEST'}
                </button>
              </div>
            )
          })()}
        </motion.div>
      )}

      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 md:p-8 max-w-md w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-neon-blue" />
              <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-display font-bold text-2xl text-white mb-2">Contact an Operator</h3>
              <p className="text-slate-400 text-sm mb-6">
                Your withdrawal has been queued. Send this message to an operator to get paid instantly.
              </p>
              <div className="bg-dark-800 rounded-xl p-4 text-left border border-white/5 mb-6 select-all">
                <p className="text-sm font-mono text-slate-300 whitespace-pre-line">
{`Hello,

I would like to request a withdrawal.

Amount: $${amount}
Method: ${selectedMethod?.name || ''}

Please process my withdrawal request.`}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {settings.telegram_url && (
                  <a href={settings.telegram_url} target="_blank" rel="noreferrer"
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                    <span className="font-bold">Contact on Telegram</span>
                  </a>
                )}
                {settings.signal_number && (
                  <a href={`https://signal.me/#p/${settings.signal_number}`} target="_blank" rel="noreferrer"
                    className="glass w-full py-3 rounded-xl border border-white/10 hover:border-white/30 text-white flex items-center justify-center gap-2 transition-all">
                    <span className="font-bold">Contact on Signal</span>
                  </a>
                )}
                {settings.messenger_url && (
                  <a href={settings.messenger_url} target="_blank" rel="noreferrer"
                    className="glass w-full py-3 rounded-xl border border-white/10 hover:border-white/30 text-white flex items-center justify-center gap-2 transition-all">
                    <span className="font-bold">Contact on Messenger</span>
                  </a>
                )}
              </div>
              <button onClick={() => { resetForm(); setTab('history') }}
                className="mt-6 text-sm text-slate-500 hover:text-white transition-colors">
                Close & View History
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Tab */}
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
                      <td>{tx.paymentMethod?.name || tx.adminNotes || 'Manual'}</td>
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
