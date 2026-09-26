'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Search, MessageSquare, CheckCircle, Send, RefreshCw, Headphones } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, Badge, StatusBadge, EmptyState, Tone } from '@/components/dashboard/ui'
import { INPUT, TH, TD, IconBtn, AdminModal, TableCard, SkeletonRows, NUM } from '../_kit'

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

const PRIORITY_TONE: Record<string, Tone> = { low: 'slate', medium: 'gold', high: 'orange', urgent: 'red' }
const cap = (s: string) => (s || '').replace(/^./, c => c.toUpperCase())

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

  const openCount = tickets.filter(t => t.status === 'open').length
  const progressCount = tickets.filter(t => t.status === 'in_progress').length

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Support"
        subtitle="Manage customer support tickets."
        actions={
          <>
            <div className="ds-card px-4 py-2 text-center min-w-[84px]">
              <p className={`font-bold text-[20px] leading-tight tabular-nums ${NUM.orange}`}>{openCount}</p>
              <p className="text-xs text-secondary">Open</p>
            </div>
            <div className="ds-card px-4 py-2 text-center min-w-[84px]">
              <p className={`font-bold text-[20px] leading-tight tabular-nums ${NUM.amber}`}>{progressCount}</p>
              <p className="text-xs text-secondary">In progress</p>
            </div>
            <IconBtn size="lg" label="Refresh tickets" onClick={fetchTickets}><RefreshCw className="w-5 h-5" /></IconBtn>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className={`${INPUT} !pl-11`} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className={`${INPUT} w-full sm:w-44`} aria-label="Filter by status">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Headphones} title="No tickets found" text="Tickets from your players will show up here." /></Card>
      ) : (
        <TableCard>
          <table className="data-table min-w-[980px]">
            <thead><tr><th className={TH}>ID</th><th className={TH}>User</th><th className={TH}>Subject</th><th className={TH}>Category</th><th className={TH}>Priority</th><th className={TH}>Status</th><th className={TH}>Replies</th><th className={TH}>Date</th><th className={TH}>Action</th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                  <td className={`${TD} font-mono text-[13px] ${NUM.cyan}`}>{t.id.slice(0, 10)}</td>
                  <td className={TD}><p className="text-primary text-[14px] font-semibold">{t.user?.username}</p><p className="text-[13px] text-muted">{t.user?.email}</p></td>
                  <td className={`${TD} text-[14px] max-w-[240px] truncate`}>{t.subject}</td>
                  <td className={`${TD} text-[14px] capitalize`}>{t.category}</td>
                  <td className={TD}><Badge tone={PRIORITY_TONE[t.priority] || 'slate'}>{cap(t.priority)}</Badge></td>
                  <td className={TD}><StatusBadge status={t.status} /></td>
                  <td className={`${TD} text-[14px] tabular-nums`}>{t.messages?.filter(m => m.isAdmin)?.length || 0}</td>
                  <td className={`${TD} text-[13px] whitespace-nowrap`}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className={TD}>
                    <IconBtn label="Open ticket"><MessageSquare className="w-4 h-4" /></IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {selected && (
        <AdminModal
          title={selected.subject}
          subtitle={<span className="font-mono break-all">{selected.id}</span>}
          onClose={() => setSelected(null)}
          closeOnBackdrop
          footer={
            <div className="flex gap-3">
              {selected.status !== 'closed' && (
                <Button variant="secondary" onClick={() => closeTicket(selected.id)} className="flex-1">
                  <CheckCircle className="w-4 h-4" /> Close ticket
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSelected(null)} className="flex-1">Cancel</Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <StatusBadge status={selected.status} />
            <Badge tone={PRIORITY_TONE[selected.priority] || 'slate'}>{cap(selected.priority)} priority</Badge>
            <span className="text-[13px] text-secondary capitalize">{selected.category}</span>
            <span className="text-[13px] text-secondary">· {selected.user?.username}</span>
          </div>

          <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {selected.messages?.map((msg: any, i: number) => (
              <div key={i} className={`p-3.5 rounded-2xl border ${msg.isAdmin ? 'ml-6 border-sky-400/25 bg-sky-500/10' : 'mr-6 bg-surface-elevated border-border-subtle'}`}>
                <p className="text-xs text-muted mb-1.5 flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold text-secondary">{msg.isAdmin ? 'Support agent' : selected.user?.username}</span>
                  <span>{new Date(msg.createdAt).toLocaleString()}</span>
                </p>
                <p className="text-[14px] text-primary leading-relaxed break-words">{msg.message}</p>
              </div>
            ))}
            {(!selected.messages || selected.messages.length === 0) && (
              <div className="text-center py-4 text-muted text-[14px]">No messages yet.</div>
            )}
          </div>

          {selected.status !== 'closed' && selected.status !== 'resolved' && (
            <div>
              <label className="block text-[13px] font-medium text-secondary mb-2">Reply to customer</label>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4}
                className={`${INPUT} resize-none mb-3`} placeholder="Type your response..." />
              <Button onClick={handleReply} disabled={!replyText.trim() || sending} full>
                {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                Send reply
              </Button>
            </div>
          )}
        </AdminModal>
      )}
    </div>
  )
}
