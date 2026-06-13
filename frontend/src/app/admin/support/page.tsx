'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, MessageSquare, CheckCircle, AlertCircle, Send, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

type Ticket = {
  id: string
  user: { username: string, email: string }
  subject: string
  category: string
  status: string
  priority: string
  createdAt: string
  messages?: { message: string, isAdmin: boolean, createdAt: string }[]
}

const STATUS_MAP: Record<string, string> = { open: 'badge-pending', in_progress: 'badge-pending', resolved: 'badge-approved', closed: 'text-slate-500 bg-slate-500/10 border border-slate-500/20' }
const PRIORITY_COLOR: Record<string, string> = { low: 'text-slate-400', medium: 'text-yellow-400', high: 'text-orange-400', urgent: 'text-red-400' }

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getTickets()
      setTickets(res.data.data || [])
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [])

  const filtered = tickets.filter(t =>
    (filter === 'all' || t.status === filter) &&
    (t.subject.toLowerCase().includes(search.toLowerCase()) || t.user?.username.toLowerCase().includes(search.toLowerCase()))
  )

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return
    setSending(true)
    
    try {
      await adminApi.replyTicket(selected.id, replyText)
      toast.success('Reply sent!')
      setReplyText('')
      await fetchTickets()
      // To immediately see the reply we would need to fetch the single ticket, 
      // but closing the modal is simpler for now
      setSelected(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const closeTicket = async (id: string) => {
    try {
      await adminApi.closeTicket(id)
      toast.success('Ticket closed')
      await fetchTickets()
      setSelected(null)
    } catch {
      toast.error('Failed to close ticket')
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">SUPPORT MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Manage customer support tickets.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchTickets} className="glass border border-white/10 rounded-xl px-3 py-2 text-slate-400 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-red-400 font-bold text-lg font-display">{tickets.filter(t => t.status === 'open').length}</p>
            <p className="text-xs text-slate-500">Open</p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-yellow-400 font-bold text-lg font-display">{tickets.filter(t => t.status === 'in_progress').length}</p>
            <p className="text-xs text-slate-500">In Progress</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="input-neon pl-10" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-neon bg-dark-800 w-full sm:w-36">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>ID</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Replies</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">Loading tickets...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">No tickets found</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                  <td className="font-mono text-xs text-neon-blue">{t.id.slice(0, 10)}</td>
                  <td><p className="text-white text-sm">{t.user?.username}</p><p className="text-xs text-slate-500">{t.user?.email}</p></td>
                  <td className="text-slate-300 text-sm max-w-[200px] truncate">{t.subject}</td>
                  <td className="text-xs text-slate-500">{t.category}</td>
                  <td className={`text-xs font-medium uppercase ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</td>
                  <td><span className={`${STATUS_MAP[t.status]} text-xs px-2 py-0.5 rounded-full font-mono`}>{t.status.replace('_', ' ')}</span></td>
                  <td className="text-sm text-slate-400">{t.messages?.filter(m => m.isAdmin)?.length || 0}</td>
                  <td className="text-xs text-slate-600">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="w-7 h-7 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-mono text-neon-blue">{selected.id}</span>
                <h3 className="font-display font-bold text-lg text-white mt-1">{selected.subject}</h3>
              </div>
              <span className={`${STATUS_MAP[selected.status]} text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0`}>{selected.status.replace('_', ' ')}</span>
            </div>

            <div className="flex gap-2 mb-4">
              <span className={`text-xs font-medium uppercase ${PRIORITY_COLOR[selected.priority]}`}>{selected.priority} priority</span>
              <span className="text-xs text-slate-500">· {selected.category}</span>
              <span className="text-xs text-slate-500">· {selected.user?.username}</span>
            </div>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {selected.messages?.map((msg: any, i: number) => (
                <div key={i} className={`p-3 rounded-xl ${msg.isAdmin ? 'bg-neon-blue/10 ml-8 border border-neon-blue/20' : 'glass mr-8 border border-white/10'}`}>
                  <p className="text-xs text-slate-500 mb-1 flex justify-between">
                    <span>{msg.isAdmin ? 'Support Agent' : selected.user?.username}</span>
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-slate-300">{msg.message}</p>
                </div>
              ))}
              {(!selected.messages || selected.messages.length === 0) && (
                <div className="text-center py-4 text-slate-500 text-sm">No messages yet.</div>
              )}
            </div>

            {selected.status !== 'closed' && selected.status !== 'resolved' && (
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">Reply to Customer</label>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4}
                  className="input-neon resize-none mb-2" placeholder="Type your response..." />
                <button onClick={handleReply} disabled={!replyText.trim() || sending}
                  className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Reply
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {selected.status !== 'closed' && (
                <button onClick={() => closeTicket(selected.id)}
                  className="flex-1 py-2 glass border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white hover:bg-white/5 transition-all flex justify-center items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" /> Close Ticket
                </button>
              )}
              <button onClick={() => setSelected(null)} className="flex-1 py-2 glass border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
