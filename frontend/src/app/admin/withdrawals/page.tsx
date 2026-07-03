'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, CheckCircle2, XCircle, Eye, Download,
  ChevronLeft, ChevronRight, Clock, AlertCircle, X, Filter
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'

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

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${map[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/25'}`}>
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'rejected' && <XCircle className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">WITHDRAWAL MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Review, approve, and reject withdrawal requests in real-time.</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => fetchItems(page)} id="refresh-withdrawals-btn"
            className="glass border border-white/10 rounded-xl px-3 py-2 text-slate-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleExportCSV} id="export-csv-btn"
            className="glass border border-white/10 rounded-xl px-3 py-2 text-slate-400 hover:text-emerald-400 transition-all flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-amber-400 font-bold text-lg font-display">{totalPending}</p>
            <p className="text-xs text-slate-500">Pending</p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-orange-400 font-bold text-lg font-display">${totalPendingAmt.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Pending $</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
          <Filter className="w-3.5 h-3.5" /> FILTERS
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input id="withdrawal-search" type="text" placeholder="Search request ID, user..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-neon pl-10 text-sm" />
          </div>
          <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="input-neon bg-dark-800 w-36 text-sm">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
            className="input-neon bg-dark-800 w-40 text-sm">
            <option value="">All Methods</option>
            {['Cash App','Venmo','Zelle','Crypto','Bank Transfer','Chime','PayPal'].map(m =>
              <option key={m} value={m}>{m}</option>
            )}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input-neon bg-dark-800 text-sm w-40" title="From date" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input-neon bg-dark-800 text-sm w-40" title="To date" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Request ID', 'User', 'Amount', 'Method', 'Account', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-mono text-slate-500 uppercase tracking-wider px-4 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500 text-sm">
                    No withdrawal requests match the filters.
                  </td>
                </tr>
              ) : (
                items.map((w, i) => (
                  <motion.tr key={w.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                    className="border-b border-white/5 hover:bg-white/2 transition-colors group">
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">{w.requestId}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-white text-sm font-medium">{w.user?.username}</p>
                      <p className="text-xs text-slate-500">{w.user?.email}</p>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white">${w.amount.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-300">{w.paymentMethodStr}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[120px] truncate">{w.accountDetails}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelected(w)} title="View details"
                          className="w-7 h-7 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {w.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(w)} disabled={processing === w.requestId} title="Approve"
                              className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40">
                              {processing === w.requestId ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => { setShowRejectModal(w); setCustomReason(''); setSelectedReason('') }} disabled={processing === w.requestId} title="Reject"
                              className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-white/5">
            <p className="text-xs text-slate-500">
              {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} requests
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchItems(page - 1)} disabled={page <= 1}
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 flex items-center px-2">{page} / {pagination.pages}</span>
              <button onClick={() => fetchItems(page + 1)} disabled={page >= pagination.pages}
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-xl text-white">REQUEST DETAILS</h3>
                <button onClick={() => setSelected(null)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 mb-5">
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
                  <div key={k} className="flex justify-between items-start glass rounded-xl px-4 py-2.5 gap-3">
                    <span className="text-xs text-slate-500 flex-shrink-0">{k}</span>
                    <span className="text-sm text-white text-right break-all">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center glass rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-500">Status</span>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              {selected.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => { setShowRejectModal(selected); setSelected(null) }} disabled={!!processing}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => { handleApprove(selected); setSelected(null) }} disabled={!!processing}
                    className="flex-1 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !processing && setShowRejectModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg text-white">REJECTION REASON</h3>
                <button onClick={() => !processing && setShowRejectModal(null)}
                  className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-white/10 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-3 font-mono">
                Rejecting: <span className="text-neon-blue">{showRejectModal.requestId}</span>
              </p>

              <div className="space-y-2 mb-4">
                {REJECTION_REASONS.map(r => (
                  <button key={r} onClick={() => { setSelectedReason(r); setCustomReason('') }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all border ${
                      selectedReason === r
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'glass border-white/10 text-slate-400 hover:text-white'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Custom reason (optional)</label>
                <input type="text" placeholder="Enter custom rejection reason..."
                  value={customReason}
                  onChange={e => { setCustomReason(e.target.value); setSelectedReason('') }}
                  className="input-neon text-sm" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => !processing && setShowRejectModal(null)}
                  className="flex-1 glass rounded-xl py-2.5 text-slate-400 text-sm border border-white/10 hover:text-white transition-all">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={!!processing}
                  className="flex-1 bg-red-500/10 border border-red-500/30 rounded-xl py-2.5 text-red-400 text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {processing ? <div className="w-4 h-4 border border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
