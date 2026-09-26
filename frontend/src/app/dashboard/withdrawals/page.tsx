'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { DollarSign, Clock, CheckCircle2, ChevronLeft, ChevronRight, Plus, X, AlertCircle, Info } from 'lucide-react'
import { enhancedWithdrawalApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import Cookies from 'js-cookie'
import {
  Card, cn, PageHeader, SectionHeading, Button, StatusBadge, StatCard, EmptyState, Field, Skeleton,
} from '@/components/dashboard/ui'

const PAYMENT_METHODS = ['Cash App', 'Venmo', 'Crypto', 'Bank Transfer', 'Chime', 'PayPal'] // Zelle temporarily unavailable

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

const ROW_GRID = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_110px_100px_minmax(0,1fr)_120px]'

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
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          className="!mb-0"
          title="Withdrawals"
          subtitle="Request cashouts and track their status in real-time."
          actions={
            <Button onClick={() => setShowForm(true)} id="new-withdrawal-btn" size="sm">
              <Plus className="w-4 h-4" /> New Request
            </Button>
          }
        />
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={DollarSign} tone="cyan" value={pagination.total} label="Total" />
        <StatCard icon={Clock} tone="orange" value={totalPending} label="Pending" />
        <StatCard icon={CheckCircle2} tone="green" value={totalApproved} label="Approved" />
      </div>

      {/* Filter */}
      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
        {['', 'pending', 'approved', 'rejected'].map(s => {
          const on = statusFilter === s
          return (
            <button key={s} type="button" role="tab" aria-selected={on} onClick={() => setStatusFilter(s)}
              className={cn(
                'h-10 px-4 rounded-full text-[14px] font-semibold transition-all border active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                on ? 'text-white border-transparent' : 'bg-surface-elevated border-border-subtle text-secondary hover:text-primary'
              )}
              style={on ? { background: 'var(--ds-accent)' } : undefined}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div>
        <SectionHeading title="Request history" />
        <Card padded={false} className="overflow-hidden">
          {!loading && withdrawals.length > 0 && (
            <div className={cn('hidden md:grid gap-x-4 px-6 py-3.5 border-b border-border-subtle text-[12px] font-semibold text-muted', ROW_GRID)}>
              <span>Method / Request ID</span><span>Date</span><span>Amount</span><span>Account</span><span>Status</span>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-1/3 !rounded-lg" /><Skeleton className="h-3 w-1/2 !rounded-lg" /></div>
                  <Skeleton className="h-8 w-20 !rounded-lg" />
                </div>
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState icon={DollarSign} title="No withdrawal requests found."
              text="Your withdrawal requests will show up here."
              action={<Button onClick={() => setShowForm(true)} size="sm">Create your first request <ChevronRight className="w-4 h-4" /></Button>} />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {withdrawals.map((w, i) => {
                const dateStr = new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <motion.li key={w.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className={cn('px-4 sm:px-6 py-4 grid gap-x-4 gap-y-1.5 items-center', ROW_GRID)}>
                    <div className="min-w-0 row-span-2 md:row-span-1">
                      <p className="text-primary text-[15px] font-semibold truncate">{w.paymentMethodStr}</p>
                      <p className="mt-1 text-[12px] text-muted font-mono break-all leading-snug">{w.requestId}</p>
                      <p className="md:hidden mt-1 text-[12px] text-muted">{dateStr}</p>
                    </div>
                    <p className="hidden md:block text-[13px] text-secondary">{dateStr}</p>
                    <p className="text-primary font-bold text-[16px] tabular-nums text-right md:text-left">${w.amount.toFixed(2)}</p>
                    <p className="hidden md:block text-[13px] text-muted truncate" title={w.accountDetails}>{w.accountDetails}</p>
                    <div className="justify-self-end md:justify-self-start"><StatusBadge status={w.status} /></div>

                    {w.accountDetails && (
                      <p className="md:hidden col-span-full text-[12px] text-muted truncate mt-1" title={w.accountDetails}>{w.accountDetails}</p>
                    )}
                    {w.status === 'pending' && (
                      <p className="col-span-full text-[12px] text-secondary flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FBBF24' }} /> Processing ~10-15 mins
                      </p>
                    )}
                    {w.status === 'rejected' && w.rejectionReason && (
                      <p className="col-span-full text-[13px] text-red-400 flex items-start gap-1.5 mt-1 break-words min-w-0" title={w.rejectionReason}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span className="min-w-0">{w.rejectionReason}</span>
                      </p>
                    )}
                    {w.status === 'approved' && w.approvedAt && (
                      <p className="col-span-full text-[12px] text-emerald-500 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Approved {new Date(w.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </motion.li>
                )
              })}
            </ul>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-border-subtle">
              <p className="text-[12px] sm:text-[13px] text-muted">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchWithdrawals(pagination.page - 1)} disabled={pagination.page <= 1} aria-label="Previous page"
                  className="w-10 h-10 rounded-xl bg-surface-elevated border border-border-strong flex items-center justify-center text-secondary hover:text-primary disabled:opacity-40 transition-all active:scale-[0.97]">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] text-secondary px-1 tabular-nums">
                  {pagination.page} / {pagination.pages}
                </span>
                <button onClick={() => fetchWithdrawals(pagination.page + 1)} disabled={pagination.page >= pagination.pages} aria-label="Next page"
                  className="w-10 h-10 rounded-xl bg-surface-elevated border border-border-strong flex items-center justify-center text-secondary hover:text-primary disabled:opacity-40 transition-all active:scale-[0.97]">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* New Request Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
            style={{ background: 'rgba(2, 6, 23, 0.72)' }}
            onClick={() => !submitting && setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="ds-card w-full max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-5">
                <h3 className="font-bold text-xl text-primary tracking-tight">New withdrawal</h3>
                <button onClick={() => !submitting && setShowForm(false)} aria-label="Close"
                  className="w-10 h-10 -mr-2 rounded-full inline-flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Field label="Amount (USD)" error={errors.amount?.message}>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold pointer-events-none">$</span>
                    <input
                      id="withdrawal-amount"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="0.00"
                      className="ds-input !text-base !pl-8"
                      {...register('amount', {
                        required: 'Amount is required',
                        min: { value: 1, message: 'Minimum withdrawal is $1' },
                        max: { value: 100000, message: 'Maximum withdrawal is $100,000' }
                      })}
                    />
                  </div>
                </Field>

                <Field label="Payment method" error={errors.paymentMethod?.message}>
                  <select
                    id="withdrawal-method"
                    className="ds-input !text-base"
                    {...register('paymentMethod', { required: 'Please select a payment method' })}
                  >
                    <option value="">Select method...</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Account details" error={errors.accountDetails?.message}>
                  <textarea
                    id="withdrawal-account-details"
                    className="ds-input !text-base resize-none h-24"
                    placeholder="$Cashtag, email, wallet address, phone number..."
                    {...register('accountDetails', {
                      required: 'Account details are required',
                      minLength: { value: 3, message: 'Please provide valid account details' }
                    })}
                  />
                </Field>

                <div className="flex items-start gap-3 rounded-2xl bg-surface-elevated border border-border-subtle p-3.5">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FBBF24' }} />
                  <p className="text-[14px] text-secondary leading-relaxed">Processing time: 1–24 hours after approval.</p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                  <Button onClick={() => !submitting && setShowForm(false)} variant="secondary" size="lg" full className="sm:flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} id="submit-withdrawal-btn" size="lg" full className="sm:flex-1">
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                    ) : (
                      <><DollarSign className="w-4 h-4" />Submit Request</>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
