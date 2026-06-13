'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, CheckCircle, XCircle, DollarSign, Eye, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

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

const STATUS_MAP: Record<string, string> = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', paid: 'badge-paid' }

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

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">CASHOUT MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Review and process withdrawal requests.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchWithdrawals} className="glass border border-white/10 rounded-xl px-3 py-2 text-slate-400 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-yellow-400 font-bold text-lg font-display">{totalPending}</p>
            <p className="text-xs text-slate-500">Pending</p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-orange-400 font-bold text-lg font-display">${totalPendingAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Pending Amount</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-neon pl-10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-neon bg-dark-800 w-full sm:w-40">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">Loading cashouts...</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-orange-400">{d.id.slice(0, 10)}</td>
                  <td><p className="text-white text-sm">{d.user?.username}</p><p className="text-xs text-slate-500">{d.user?.email}</p></td>
                  <td className="text-white font-bold">${d.amount.toLocaleString()}</td>
                  <td className="text-slate-400 text-sm">{d.paymentMethod?.name || 'Unknown'}</td>
                  <td className="text-xs text-slate-500 max-w-[120px] truncate">{d.accountInfo}</td>
                  <td><span className={`${STATUS_MAP[d.status]} text-xs px-2 py-0.5 rounded-full font-mono`}>{d.status}</span></td>
                  <td className="text-xs text-slate-600">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(d); setNotes(d.adminNotes) }}
                        className="w-7 h-7 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {d.status === 'pending' && (
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
                      {d.status === 'approved' && (
                        <button onClick={() => handleAction(d.id, 'paid')} disabled={processing === d.id}
                          className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-mono disabled:opacity-50">
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">No cashouts found</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-md w-full p-6">
            <h3 className="font-display font-bold text-xl text-white mb-4">CASHOUT DETAILS</h3>
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
                <div key={k} className="flex justify-between glass rounded-lg px-4 py-2.5">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className={`text-sm font-medium ${k === 'Status' ? STATUS_MAP[v as string] + ' text-xs px-2 py-0.5 rounded-full font-mono' : 'text-white'}`}>{v}</span>
                </div>
              ))}
            </div>
            {selected.status === 'pending' && (
              <>
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-2">Admin Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-neon resize-none text-sm" placeholder="Optional notes..." />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(selected.id, 'approve')} disabled={!!processing}
                    className="flex-1 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleAction(selected.id, 'reject')} disabled={!!processing}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </>
            )}
            {selected.status === 'approved' && (
              <button onClick={() => handleAction(selected.id, 'paid')} className="w-full py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" /> Mark as Paid
              </button>
            )}
            <button onClick={() => setSelected(null)} className="w-full mt-2 glass rounded-xl py-2.5 text-slate-400 text-sm border border-white/10 transition-all hover:text-white">Close</button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
