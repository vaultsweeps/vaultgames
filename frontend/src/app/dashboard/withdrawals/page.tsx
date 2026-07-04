'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { DollarSign, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Filter, Plus, X, AlertCircle } from 'lucide-react'
import { enhancedWithdrawalApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import Cookies from 'js-cookie'

const PAYMENT_METHODS = ['Cash App', 'Venmo', 'Zelle', 'Crypto', 'Bank Transfer', 'Chime', 'PayPal']

type Withdrawal = {
  id: string
  requestId: string
  amount: number
  paymentMethodStr: string
  accountDetails: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  createdAt: string
}

type Pagination = { page: number; limit: number; total: number; pages: number }

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    pending:  { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20',  icon: <Clock className="w-3 h-3" />,         label: 'Pending' },
    approved: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Approved' },
    rejected: { cls: 'bg-red-500/15 text-red-400 border-red-500/20',        icon: <XCircle className="w-3 h-3" />,         label: 'Rejected' },
  }
  const s = map[status] ?? { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20', icon: null, label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  )
}

export default function WithdrawalsPage() {
  const { user } = useAuthStore() as any
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    amount: string; paymentMethod: string; accountDetails: string
  }>()

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: any = { page, limit: 10 }
      if (statusFilter) params.status = statusFilter
      const res = await enhancedWithdrawalApi.getAll(params)
      if (res.data.success) {
        setWithdrawals(res.data.data)
        setPagination(res.data.pagination)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchWithdrawals(1) }, [fetchWithdrawals])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`withdrawals_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Withdrawal', filter: `userId=eq.${user.id}` },
        (payload: any) => {
          setWithdrawals(prev =>
            prev.map(w => w.id === payload.new.id ? { ...w, ...payload.new } : w)
          )
          const newStatus = payload.new.status
          if (newStatus === 'approved') {
            toast.success(`✅ Withdrawal ${payload.new.requestId} has been approved!`)
          } else if (newStatus === 'rejected') {
            toast.error(`❌ Withdrawal ${payload.new.requestId} was rejected.`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const onSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      const res = await enhancedWithdrawalApi.create({
        amount: parseFloat(data.amount),
        paymentMethod: data.paymentMethod,
        accountDetails: data.accountDetails,
      })
      toast.success(res.data.message || 'Withdrawal request submitted!')
      reset()
      setShowForm(false)
      await fetchWithdrawals(1)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit withdrawal')
    } finally {
      setSubmitting(false)
    }
  }

  const totalPending = withdrawals.filter(w => w.status === 'pending').length
  const totalApproved = withdrawals.filter(w => w.status === 'approved').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">WITHDRAWALS</h2>
          <p className="text-slate-400 text-sm mt-1">Request cashouts and track their status in real-time.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          id="new-withdrawal-btn"
          className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm"
        >
          <Plus className="w-4 h-4" /> New Request
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: pagination.total, icon: DollarSign, color: 'text-neon-blue' },
          { label: 'Pending', value: totalPending, icon: Clock, color: 'text-amber-400' },
          { label: 'Approved', value: totalApproved, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className={`font-bold text-lg font-display ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-500" />
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              statusFilter === s
                ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                : 'glass text-slate-400 border-white/10 hover:text-white'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Request ID', 'Date', 'Amount', 'Method', 'Account', 'Status', 'Details'].map(h => (
                  <th key={h} className="text-left text-xs font-mono text-slate-500 uppercase tracking-wider px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <DollarSign className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No withdrawal requests found.</p>
                    <button onClick={() => setShowForm(true)} className="mt-3 text-neon-blue text-sm hover:underline">
                      Create your first request →
                    </button>
                  </td>
                </tr>
              ) : (
                withdrawals.map((w, i) => (
                  <motion.tr key={w.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">{w.requestId}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-white">${w.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300">{w.paymentMethodStr}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-[140px] truncate">{w.accountDetails}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={w.status} />
                      {w.status === 'pending' && (
                        <p className="text-[10px] text-amber-500/70 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Processing ~10-15 mins
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {w.status === 'rejected' && w.rejectionReason && (
                        <div className="flex items-start gap-1.5 max-w-[160px]">
                          <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-red-400 truncate" title={w.rejectionReason}>{w.rejectionReason}</span>
                        </div>
                      )}
                      {w.status === 'approved' && w.approvedAt && (
                        <span className="text-xs text-emerald-500">
                          {new Date(w.approvedAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
            <p className="text-xs text-slate-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchWithdrawals(pagination.page - 1)} disabled={pagination.page <= 1}
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 flex items-center px-2">
                {pagination.page} / {pagination.pages}
              </span>
              <button onClick={() => fetchWithdrawals(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !submitting && setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="glass-card w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-xl text-white">NEW WITHDRAWAL</h3>
                <button onClick={() => !submitting && setShowForm(false)}
                  className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                    <input
                      id="withdrawal-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="0.00"
                      className="input-neon pl-8"
                      {...register('amount', {
                        required: 'Amount is required',
                        min: { value: 1, message: 'Minimum withdrawal is $1' },
                        max: { value: 100000, message: 'Maximum withdrawal is $100,000' }
                      })}
                    />
                  </div>
                  {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Payment Method</label>
                  <select
                    id="withdrawal-method"
                    className="input-neon bg-dark-800"
                    {...register('paymentMethod', { required: 'Please select a payment method' })}
                  >
                    <option value="">Select method...</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {errors.paymentMethod && <p className="text-red-400 text-xs mt-1">{errors.paymentMethod.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Account Details</label>
                  <textarea
                    id="withdrawal-account-details"
                    className="input-neon resize-none h-24"
                    placeholder="$Cashtag, email, wallet address, phone number..."
                    {...register('accountDetails', {
                      required: 'Account details are required',
                      minLength: { value: 3, message: 'Please provide valid account details' }
                    })}
                  />
                  {errors.accountDetails && <p className="text-red-400 text-xs mt-1">{errors.accountDetails.message}</p>}
                </div>

                <div className="glass rounded-xl p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-400 font-mono">⚠ Processing time: 1–24 hours after approval.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => !submitting && setShowForm(false)}
                    className="flex-1 glass rounded-xl py-3 text-slate-400 text-sm border border-white/10 hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    id="submit-withdrawal-btn"
                    className="flex-1 btn-primary py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                    ) : (
                      <><DollarSign className="w-4 h-4" />Submit Request</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
