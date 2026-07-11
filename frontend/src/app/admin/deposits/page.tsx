'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Filter, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

type Deposit = {
  id: string
  user: { username: string, email: string }
  amount: number
  paymentMethod: { name: string }
  paymentReference: string
  status: string
  createdAt: string
  notes?: string
}

const STATUS_MAP: Record<string, string> = { pending: 'badge-pending', processing: 'badge-pending', approved: 'badge-approved', failed: 'badge-rejected' }

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Deposit | null>(null)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchDeposits = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getDeposits()
      setDeposits(res.data.data)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDeposits() }, [])

  const filtered = deposits.filter(d =>
    (statusFilter === 'all' || d.status === statusFilter) &&
    (d.user?.username.toLowerCase().includes(search.toLowerCase()) || d.id.includes(search) || (d.paymentReference && d.paymentReference.toLowerCase().includes(search.toLowerCase())) || d.user?.email.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'void') => {
    setProcessing(id)
    try {
      if (action === 'approve') await adminApi.approveDeposit(id, notes)
      else if (action === 'reject') await adminApi.rejectDeposit(id, notes)
      else if (action === 'void') await adminApi.voidDeposit(id, notes)
      
      toast.success(`Deposit ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'voided'} successfully!`)
      await fetchDeposits()
      setSelected(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action} deposit`)
    } finally {
      setProcessing(null)
    }
  }

  const totalPending = deposits.filter(d => d.status === 'pending').length
  const totalAmount = deposits.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0)

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">DEPOSIT MANAGEMENT</h2>
          <p className="text-secondary text-sm">Review and process deposit requests.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchDeposits} className="glass border border-border-strong rounded-xl px-3 py-2 text-secondary hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-yellow-400 font-bold text-lg font-display">{totalPending}</p>
            <p className="text-xs text-muted">Pending</p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-green-400 font-bold text-lg font-display">${totalAmount.toLocaleString()}</p>
            <p className="text-xs text-muted">Approved Total</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Search by user, ID, reference..." value={search} onChange={e => setSearch(e.target.value)} className="input-neon pl-10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-neon bg-surface w-full sm:w-40">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="approved">Approved</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>User</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted">Loading deposits...</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-neon-blue">{d.id.slice(0, 10)}</td>
                  <td>
                    <p className="text-white text-sm">{d.user?.username}</p>
                    <p className="text-xs text-muted">{d.user?.email}</p>
                  </td>
                  <td className="text-white font-bold">${d.amount.toLocaleString()}</td>
                  <td className="text-secondary text-sm">{d.paymentMethod?.name || 'Unknown'}</td>
                  <td className="font-mono text-xs text-muted">{d.paymentReference || 'N/A'}</td>
                  <td><span className={`${STATUS_MAP[d.status]} text-xs px-2 py-0.5 rounded-full font-mono`}>{d.status}</span></td>
                  <td className="text-xs text-slate-600">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(d); setNotes(d.notes) }}
                        className="w-7 h-7 glass rounded-lg flex items-center justify-center text-secondary hover:text-neon-blue border border-border-strong hover:border-neon-blue/30 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {(d.status === 'pending' || d.status === 'processing') && (
                        <>
                          <button onClick={() => handleAction(d.id, 'approve')} disabled={processing === d.id}
                            className="w-7 h-7 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction(d.id, 'reject')} disabled={processing === d.id}
                            className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted text-sm">No deposits found</div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-md w-full p-6">
            <h3 className="font-display font-bold text-xl text-white mb-4">DEPOSIT DETAILS</h3>
            <div className="space-y-2 mb-5">
              {[
                ['ID', selected.id], 
                ['User', selected.user?.username], 
                ['Email', selected.user?.email], 
                ['Amount', `$${selected.amount}`], 
                ['Method', selected.paymentMethod?.name || 'Unknown'], 
                ['Reference', selected.paymentReference || 'N/A'], 
                ['Status', selected.status], 
                ['Date', new Date(selected.createdAt).toLocaleString()]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between glass rounded-lg px-4 py-2.5">
                  <span className="text-xs text-muted">{k}</span>
                  <span className={`text-sm font-medium ${k === 'Status' ? STATUS_MAP[v as string] + ' text-xs px-2 py-0.5 rounded-full font-mono' : 'text-white'}`}>{v}</span>
                </div>
              ))}
            </div>
            {(selected.status === 'pending' || selected.status === 'processing') && (
              <>
                <div className="mb-4">
                  <label className="block text-xs text-secondary mb-2">Admin Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-neon resize-none text-sm" placeholder="Optional notes..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleAction(selected.id, 'approve')} disabled={!!processing}
                    className="flex-1 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleAction(selected.id, 'reject')} disabled={!!processing}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </>
            )}
            {selected.status === 'approved' && (
              <>
                <div className="mb-4">
                  <label className="block text-xs text-secondary mb-2">Void Reason (Required)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-neon resize-none text-sm border-amber-500/30 focus:border-amber-500 focus:shadow-[0_0_10px_rgba(245,158,11,0.2)]" placeholder="Reason for voiding (e.g. wrong amount, fraudulent)..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => {
                    if (!notes.trim()) { toast.error('Please provide a reason to void'); return; }
                    handleAction(selected.id, 'void')
                  }} disabled={!!processing}
                    className="flex-1 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4" /> Void Deposit (Deduct Balance)
                  </button>
                </div>
              </>
            )}
            <button onClick={() => setSelected(null)} className="w-full mt-3 glass rounded-xl py-2.5 text-secondary hover:text-white border border-border-strong transition-all text-sm">Close</button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
