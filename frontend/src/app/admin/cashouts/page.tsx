'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, CheckCircle, XCircle, DollarSign, Eye, RefreshCw, Clock, ArrowUpCircle, X } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Button, Card, EmptyState, IconTile, PageHeader, Skeleton, StatusBadge, cn } from '@/components/dashboard/ui'

type Item = {
  id: string
  user: { username: string, email: string }
  amount: number
  paymentMethod: { name: string }
  accountInfo: string
  status: string
  createdAt: string
  adminNotes?: string
}

const ICON_BTN = 'w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'

export default function AdminCashoutsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Item | null>(null)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getWithdrawals()
      setItems(res.data.data)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWithdrawals() }, [])

  const filtered = items.filter(d =>
    (statusFilter === 'all' || d.status === statusFilter) &&
    (d.user?.username.toLowerCase().includes(search.toLowerCase()) || d.id.includes(search) || d.user?.email.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'paid') => {
    setProcessing(id)
    try {
      if (action === 'approve') await adminApi.approveWithdrawal(id, notes)
      else if (action === 'reject') await adminApi.rejectWithdrawal(id, notes)
      else if (action === 'paid') await adminApi.markWithdrawalPaid(id)

      toast.success(`Cashout ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'marked as paid'}!`)
      await fetchWithdrawals()
      setSelected(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action} cashout`)
    } finally {
      setProcessing(null)
    }
  }

  const totalPending = items.filter(d => d.status === 'pending').length
  const totalPendingAmount = items.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0)

  const rowActions = (d: Item) => (
    <div className="flex gap-2">
      <button onClick={() => { setSelected(d); setNotes(d.adminNotes) }}
        className={cn(ICON_BTN, 'bg-surface-elevated border-border-strong text-secondary hover:text-primary')} title="View details" aria-label="View details">
        <Eye className="w-4 h-4" />
      </button>
      {d.status === 'pending' && (
        <>
          <button onClick={() => handleAction(d.id, 'approve')} disabled={processing === d.id}
            className={cn(ICON_BTN, 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20')} title="Approve" aria-label="Approve cashout">
            <CheckCircle className="w-4 h-4" />
          </button>
          <button onClick={() => handleAction(d.id, 'reject')} disabled={processing === d.id}
            className={cn(ICON_BTN, 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20')} title="Reject" aria-label="Reject cashout">
            <XCircle className="w-4 h-4" />
          </button>
        </>
      )}
      {d.status === 'approved' && (
        <button onClick={() => handleAction(d.id, 'paid')} disabled={processing === d.id}
          className={cn(ICON_BTN, 'bg-sky-500/10 border-sky-500/25 text-sky-400 hover:bg-sky-500/20')} title="Mark as paid" aria-label="Mark as paid">
          <DollarSign className="w-4 h-4" />
        </button>
      )}
    </div>
  )

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Cashout management"
          subtitle="Review and process withdrawal requests."
          actions={
            <Button variant="secondary" size="sm" onClick={fetchWithdrawals} aria-label="Refresh cashouts" className="!px-3">
              <RefreshCw className="w-4 h-4" />
            </Button>
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
            <p className="text-2xl font-bold text-primary leading-none tabular-nums truncate">${totalPendingAmount.toLocaleString()}</p>
            <p className="text-[13px] text-secondary mt-1.5">Pending amount</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="ds-input pl-11" aria-label="Search cashouts" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ds-input w-full sm:w-44" aria-label="Filter by status">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Desktop table */}
      <Card padded={false} className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px] [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3.5 [&_th]:bg-[var(--bg-surface-elevated)] [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_tr:last-child_td]:border-b-0">
            <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted">Loading cashouts...</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id}>
                  <td><span className="font-mono text-[13px] text-secondary bg-surface-elevated px-2 py-1 rounded-lg">{d.id.slice(0, 10)}</span></td>
                  <td>
                    <div className="max-w-[220px]">
                      <p className="text-primary text-[14px] font-semibold truncate">{d.user?.username}</p>
                      <p className="text-[13px] text-muted truncate">{d.user?.email}</p>
                    </div>
                  </td>
                  <td className="text-primary font-bold tabular-nums">${d.amount.toLocaleString()}</td>
                  <td className="text-secondary text-[14px]">{d.paymentMethod?.name || 'Unknown'}</td>
                  <td className="text-[13px] text-muted max-w-[160px] truncate" title={d.accountInfo}>{d.accountInfo}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="text-[13px] text-muted whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td>{rowActions(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && <div className="py-12 text-center text-muted text-[14px]">No cashouts found</div>}
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [0, 1, 2].map(i => <Skeleton key={i} className="h-[132px] !rounded-[20px]" />)
        ) : filtered.length === 0 ? (
          <Card><EmptyState icon={ArrowUpCircle} title="No cashouts found" text="Try a different search or status." /></Card>
        ) : filtered.map(d => (
          <Card key={d.id} className="!p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-primary text-[15px] font-semibold truncate">{d.user?.username}</p>
                <p className="text-[13px] text-muted truncate">{d.user?.email}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[22px] font-bold text-primary leading-none tabular-nums">${d.amount.toLocaleString()}</p>
                <p className="text-[13px] text-secondary mt-1.5 truncate">{d.paymentMethod?.name || 'Unknown'} · {d.accountInfo}</p>
              </div>
              {rowActions(d)}
            </div>
            <p className="mt-3 pt-3 border-t border-border-subtle text-xs text-muted flex justify-between gap-2">
              <span className="font-mono truncate">{d.id.slice(0, 10)}</span>
              <span className="whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString()}</span>
            </p>
          </Card>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="Cashout details"
            className="ds-card max-w-md w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xl text-primary">Cashout details</h3>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close"
                className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {[
                ['ID', selected.id],
                ['User', selected.user?.username],
                ['Amount', `$${selected.amount}`],
                ['Method', selected.paymentMethod?.name || 'Unknown'],
                ['Account', selected.accountInfo],
                ['Status', selected.status],
                ['Date', new Date(selected.createdAt).toLocaleString()]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center gap-3 bg-surface-elevated border border-border-subtle rounded-xl px-4 py-2.5">
                  <span className="text-[13px] text-muted flex-shrink-0">{k}</span>
                  {k === 'Status' ? <StatusBadge status={v as string} /> : <span className="text-[14px] font-medium text-primary text-right break-all min-w-0">{v}</span>}
                </div>
              ))}
            </div>
            {selected.status === 'pending' && (
              <>
                <div className="mb-4">
                  <label className="block text-[13px] font-medium text-secondary mb-2">Admin Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="ds-input resize-none" placeholder="Optional notes..." />
                </div>
                <div className="flex gap-3">
                  <Button variant="success" size="sm" className="flex-1" onClick={() => handleAction(selected.id, 'approve')} disabled={!!processing}>
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => handleAction(selected.id, 'reject')} disabled={!!processing}>
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </>
            )}
            {selected.status === 'approved' && (
              <Button variant="secondary" size="sm" full className="!text-sky-400" onClick={() => handleAction(selected.id, 'paid')}>
                <DollarSign className="w-4 h-4" /> Mark as Paid
              </Button>
            )}
            <Button variant="ghost" size="sm" full className="mt-2.5" onClick={() => setSelected(null)}>Close</Button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
