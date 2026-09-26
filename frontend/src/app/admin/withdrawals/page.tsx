'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, CheckCircle2, XCircle, Eye, Download,
  ChevronLeft, ChevronRight, Clock, X, Filter, DollarSign, Wallet
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button, Card, EmptyState, IconTile, PageHeader, Skeleton, StatusBadge, cn } from '@/components/dashboard/ui'

const REJECTION_REASONS = [
  'Duplicate request',
  'Verification required',
  'Incorrect details',
  'Bank information invalid',
  'Identity verification required',
  'Suspicious activity detected',
  'Account under review',
]

type Withdrawal = {
  id: string
  requestId: string
  userId: string
  user: { id: string; username: string; email: string }
  amount: number
  paymentMethodStr: string
  accountDetails: string
  status: string
  rejectionReason?: string | null
  rejectedBy?: string | null
  rejectedAt?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  locked: boolean
  createdAt: string
}

const ICON_BTN = 'w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'
const PAGER_BTN = 'w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated border border-border-strong text-secondary hover:text-primary disabled:opacity-30 transition-all active:scale-95'

export default function AdminWithdrawalsPage() {
  const [items, setItems]       = useState<Withdrawal[]>([])
  const [loading, setLoading]   = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [selected, setSelected] = useState<Withdrawal | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<Withdrawal | null>(null)
  const [customReason, setCustomReason]     = useState('')
  const [selectedReason, setSelectedReason] = useState('')

  // Filters
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  // Pagination
  const [page, setPage]   = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 20 })

  const fetchItems = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search
      if (methodFilter) params.paymentMethod = methodFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo

      const res = await adminApi.getEnhancedWithdrawals(params)
      if (res.data.success) {
        setItems(res.data.data)
        setPagination(res.data.pagination)
        setPage(p)
      }
    } catch { toast.error('Failed to load withdrawals') }
    finally { setLoading(false) }
  }, [statusFilter, search, methodFilter, dateFrom, dateTo])

  useEffect(() => { fetchItems(1) }, [fetchItems])

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('admin_withdrawals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Withdrawal' },
        (payload: any) => {
          if (!payload.new?.requestId) return
          if (payload.eventType === 'INSERT') {
            fetchItems(1)
            toast('🔔 New withdrawal request: ' + payload.new.requestId, { icon: '💸' })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(w => w.id === payload.new.id ? { ...w, ...payload.new } : w))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchItems])

  const handleApprove = async (w: Withdrawal) => {
    setProcessing(w.requestId)
    try {
      await adminApi.approveEnhancedWithdrawal(w.requestId)
      toast.success(`✅ ${w.requestId} approved`)
      setSelected(null)
      await fetchItems(page)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve')
    } finally { setProcessing(null) }
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    const reason = customReason.trim() || selectedReason || undefined
    setProcessing(showRejectModal.requestId)
    try {
      await adminApi.rejectEnhancedWithdrawal(showRejectModal.requestId, reason)
      toast.success(`❌ ${showRejectModal.requestId} rejected`)
      setShowRejectModal(null)
      setCustomReason('')
      setSelectedReason('')
      setSelected(null)
      await fetchItems(page)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject')
    } finally { setProcessing(null) }
  }

  const handleExportCSV = async () => {
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await adminApi.exportEnhancedWithdrawalsCSV(params)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `withdrawals_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch { toast.error('Export failed') }
  }

  const totalPending  = items.filter(w => w.status === 'pending').length
  const totalPendingAmt = items.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0)

  const rowActions = (w: Withdrawal) => (
    <div className="flex items-center gap-2">
      <button onClick={() => setSelected(w)} title="View details" aria-label="View details"
        className={cn(ICON_BTN, 'bg-surface-elevated border-border-strong text-secondary hover:text-primary')}>
        <Eye className="w-4 h-4" />
      </button>
      {w.status === 'pending' && (
        <>
          <button onClick={() => handleApprove(w)} disabled={processing === w.requestId} title="Approve" aria-label="Approve withdrawal"
            className={cn(ICON_BTN, 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20')}>
            {processing === w.requestId ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </button>
          <button onClick={() => { setShowRejectModal(w); setCustomReason(''); setSelectedReason('') }} disabled={processing === w.requestId} title="Reject" aria-label="Reject withdrawal"
            className={cn(ICON_BTN, 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20')}>
            <XCircle className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )

  const pager = pagination.pages > 1 && (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-t border-border-subtle">
      <p className="text-[13px] text-muted">
        {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} requests
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => fetchItems(page - 1)} disabled={page <= 1} aria-label="Previous page" className={PAGER_BTN}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[13px] text-secondary flex items-center px-2 tabular-nums">{page} / {pagination.pages}</span>
        <button onClick={() => fetchItems(page + 1)} disabled={page >= pagination.pages} aria-label="Next page" className={PAGER_BTN}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Withdrawal management"
          subtitle="Review, approve, and reject withdrawal requests in real-time."
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={handleExportCSV} id="export-csv-btn">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => fetchItems(page)} id="refresh-withdrawals-btn" aria-label="Refresh withdrawals" className="!px-3">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          }
        />
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5 max-w-xl">
        <div className="ds-card p-4 flex items-center gap-3 min-w-0">
          <IconTile icon={Clock} tone="gold" size="md" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary leading-none tabular-nums">{totalPending}</p>
            <p className="text-[13px] text-secondary mt-1.5">Pending</p>
          </div>
        </div>
        <div className="ds-card p-4 flex items-center gap-3 min-w-0">
          <IconTile icon={DollarSign} tone="orange" size="md" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary leading-none tabular-nums truncate">${totalPendingAmt.toLocaleString()}</p>
            <p className="text-[13px] text-secondary mt-1.5">Pending amount</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="!p-4 sm:!p-5 mb-4 sm:mb-5">
        <div className="flex items-center gap-2 text-primary text-[14px] font-semibold mb-3">
          <Filter className="w-4 h-4 text-muted" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_180px_160px_160px] gap-3">
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input id="withdrawal-search" type="text" placeholder="Search request ID, user..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="ds-input pl-11" aria-label="Search withdrawals" />
          </div>
          <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="ds-input" aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
            className="ds-input" aria-label="Filter by method">
            <option value="">All Methods</option>
            {['Cash App','Venmo','Crypto','Bank Transfer','Chime','PayPal'].map(m =>
              <option key={m} value={m}>{m}</option>
            )}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="ds-input min-w-0" title="From date" aria-label="From date" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="ds-input min-w-0" title="To date" aria-label="To date" />
        </div>
      </Card>

      {/* Desktop table */}
      <Card padded={false} className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px] [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3.5 [&_th]:bg-[var(--bg-surface-elevated)] [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                {['Request ID', 'User', 'Amount', 'Method', 'Account', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-surface-elevated rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="!py-16 text-center text-muted text-[14px]">
                    No withdrawal requests match the filters.
                  </td>
                </tr>
              ) : (
                items.map((w, i) => (
                  <motion.tr key={w.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}>
                    <td>
                      <span className="font-mono text-[13px] text-secondary bg-surface-elevated px-2 py-1 rounded-lg whitespace-nowrap">{w.requestId}</span>
                    </td>
                    <td>
                      <div className="max-w-[220px]">
                        <p className="text-primary text-[14px] font-semibold truncate">{w.user?.username}</p>
                        <p className="text-[13px] text-muted truncate">{w.user?.email}</p>
                      </div>
                    </td>
                    <td className="font-bold text-primary tabular-nums">${w.amount.toLocaleString()}</td>
                    <td className="text-[14px] text-secondary whitespace-nowrap">{w.paymentMethodStr}</td>
                    <td className="text-[13px] text-muted max-w-[160px] truncate" title={w.accountDetails}>{w.accountDetails}</td>
                    <td><StatusBadge status={w.status} /></td>
                    <td className="text-[13px] text-muted whitespace-nowrap">
                      {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td>{rowActions(w)}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pager}
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-[132px] !rounded-[20px]" />)}</div>
        ) : items.length === 0 ? (
          <Card><EmptyState icon={Wallet} title="No requests found" text="No withdrawal requests match the filters." /></Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="divide-y divide-[var(--border-subtle)]">
              {items.map(w => (
                <div key={w.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-primary text-[15px] font-semibold truncate">{w.user?.username}</p>
                      <p className="text-[13px] text-muted truncate">{w.user?.email}</p>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[22px] font-bold text-primary leading-none tabular-nums">${w.amount.toLocaleString()}</p>
                      <p className="text-[13px] text-secondary mt-1.5 truncate">{w.paymentMethodStr} · {w.accountDetails}</p>
                    </div>
                    {rowActions(w)}
                  </div>
                  <p className="mt-3 text-xs text-muted flex justify-between gap-2">
                    <span className="font-mono truncate">{w.requestId}</span>
                    <span className="whitespace-nowrap">{new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                  </p>
                </div>
              ))}
            </div>
            {pager}
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              role="dialog" aria-modal="true" aria-label="Request details"
              className="ds-card max-w-md w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xl text-primary">Request details</h3>
                <button onClick={() => setSelected(null)} aria-label="Close"
                  className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 mb-5">
                {[
                  ['Request ID', selected.requestId],
                  ['User', `${selected.user?.username} (${selected.user?.email})`],
                  ['Amount', `$${selected.amount.toFixed(2)}`],
                  ['Method', selected.paymentMethodStr],
                  ['Account', selected.accountDetails],
                  ['Created', new Date(selected.createdAt).toLocaleString()],
                  ...(selected.status === 'approved' ? [
                    ['Approved By', selected.approvedBy || 'Admin'],
                    ['Approved At', selected.approvedAt ? new Date(selected.approvedAt).toLocaleString() : '—'],
                  ] : []),
                  ...(selected.status === 'rejected' ? [
                    ['Rejected By', selected.rejectedBy || 'Admin'],
                    ['Rejected At', selected.rejectedAt ? new Date(selected.rejectedAt).toLocaleString() : '—'],
                    ['Reason', selected.rejectionReason || 'No reason provided'],
                  ] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-start bg-surface-elevated border border-border-subtle rounded-xl px-4 py-2.5 gap-3">
                    <span className="text-[13px] text-muted flex-shrink-0">{k}</span>
                    <span className="text-[14px] text-primary text-right break-all min-w-0">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center bg-surface-elevated border border-border-subtle rounded-xl px-4 py-2.5">
                  <span className="text-[13px] text-muted">Status</span>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              {selected.status === 'pending' && (
                <div className="flex gap-3">
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => { setShowRejectModal(selected); setSelected(null) }} disabled={!!processing}>
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                  <Button variant="success" size="sm" className="flex-1" onClick={() => { handleApprove(selected); setSelected(null) }} disabled={!!processing}>
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => !processing && setShowRejectModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              role="dialog" aria-modal="true" aria-label="Rejection reason"
              className="ds-card max-w-sm w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xl text-primary">Rejection reason</h3>
                <button onClick={() => !processing && setShowRejectModal(null)} aria-label="Close"
                  className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[13px] text-secondary mb-4">
                Rejecting: <span className="font-mono font-semibold text-primary">{showRejectModal.requestId}</span>
              </p>

              <div className="space-y-2 mb-4">
                {REJECTION_REASONS.map(r => (
                  <button key={r} onClick={() => { setSelectedReason(r); setCustomReason('') }}
                    className={cn('w-full text-left px-4 min-h-[44px] py-2 rounded-xl text-[14px] transition-all border',
                      selectedReason === r
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 font-semibold'
                        : 'bg-surface-elevated border-border-subtle text-secondary hover:text-primary')}>
                    {r}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-[13px] font-medium text-secondary mb-2">Custom reason (optional)</label>
                <input type="text" placeholder="Enter custom rejection reason..."
                  value={customReason}
                  onChange={e => { setCustomReason(e.target.value); setSelectedReason('') }}
                  className="ds-input" />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => !processing && setShowRejectModal(null)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" className="flex-1" onClick={handleReject} disabled={!!processing}>
                  {processing ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
