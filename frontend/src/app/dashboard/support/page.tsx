'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { HelpCircle, Plus, MessageCircle, Send, ChevronRight, Clock, CheckCircle, Mail } from 'lucide-react'
import { supportApi, publicApi } from '@/lib/api'
import { getSignalUrl } from '@/lib/signal'
import LiveChat from './LiveChat'

const CATEGORIES = ['General', 'Deposits', 'Cashouts', 'Games', 'Bonuses', 'Technical', 'Account', 'Other']
const PRIORITIES = ['low', 'medium', 'high']

const STATUS_STYLES: Record<string, string> = {
  open: 'badge-pending', in_progress: 'badge-pending', resolved: 'badge-approved', closed: 'text-muted bg-slate-500/10 border border-slate-500/20'
}
const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-secondary', medium: 'text-yellow-400', high: 'text-red-400', urgent: 'text-red-500'
}

export default function SupportPage() {
  const [tab, setTab] = useState<'live_chat' | 'tickets' | 'new' | 'contact'>('live_chat')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [settings, setSettings] = useState<any>({})
  const [signalUrl, setSignalUrl] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
    setSignalUrl(getSignalUrl())
    // Refresh signal URL every minute in case the shift changes while the page is open
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    return () => clearInterval(t)
  }, [])

  const fetchTickets = async () => {
    setTicketsLoading(true)
    try {
      const res = await supportApi.getAll()
      setTickets(res.data.data)
    } catch { } finally {
      setTicketsLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [])

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      await supportApi.create(data)
      reset()
      toast.success('Ticket submitted! We\'ll respond within 24 hours.')
      await fetchTickets()
      setTab('tickets')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">SUPPORT CENTER</h2>
        <p className="text-secondary text-sm mt-1">Get help from our team 24/7.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { id: 'live_chat', label: 'Live Chat', icon: MessageCircle },
          { id: 'tickets', label: 'My Tickets' },
          { id: 'new', label: 'New Ticket', icon: Plus },
          { id: 'contact', label: 'Contact Us' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-secondary hover:text-white border border-border-strong'}`}>
            {t.icon && <t.icon className="w-4 h-4" />}{t.label}
          </button>
        ))}
      </div>

      {/* Live Chat */}
      {tab === 'live_chat' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <LiveChat />
        </motion.div>
      )}

      {/* Tickets list */}
      {tab === 'tickets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {ticketsLoading ? (
            <div className="glass-card py-16 text-center text-muted">Loading tickets...</div>
          ) : tickets.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Ticket ID</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Replies</th></tr></thead>
                  <tbody>
                    {tickets.map(t => (
                      <tr key={t.id} className="cursor-pointer">
                        <td className="font-mono text-xs text-neon-blue">{t.id.slice(0, 8)}</td>
                        <td className="text-white text-sm font-medium">{t.subject}</td>
                        <td className="text-xs text-muted">{t.category}</td>
                        <td className={`text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority.toUpperCase()}</td>
                        <td><span className={`${STATUS_STYLES[t.status]} text-xs px-2 py-0.5 rounded-full font-mono`}>{t.status.replace('_', ' ')}</span></td>
                        <td className="text-xs text-slate-600">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="text-xs text-secondary">{t.replies?.length ?? 0} replies</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="glass-card py-16 text-center">
              <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-secondary font-medium mb-1">No support tickets yet</p>
              <p className="text-slate-600 text-sm mb-4">Need help? Create a ticket and our team will assist you.</p>
              <button onClick={() => setTab('new')} className="btn-primary text-sm py-2 px-6">Create Ticket</button>
            </div>
          )}
        </motion.div>
      )}

      {/* New ticket form */}
      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card p-6 max-w-xl">
            <h3 className="font-display font-bold text-white mb-5">OPEN NEW TICKET</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Subject</label>
                <input {...register('subject', { required: 'Subject is required' })} type="text"
                  placeholder="Brief description of your issue"
                  className="input-neon" />
                {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject.message as string}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Category</label>
                  <select {...register('category', { required: true })} className="input-neon bg-surface">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Priority</label>
                  <select {...register('priority')} className="input-neon bg-surface">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Message</label>
                <textarea {...register('message', { required: 'Message is required', minLength: { value: 20, message: 'Please provide more details (min 20 chars)' } })}
                  rows={5} placeholder="Describe your issue in detail..."
                  className="input-neon resize-none" />
                {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message.message as string}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : 'SUBMIT TICKET'}
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Contact */}
      {tab === 'contact' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Signal – FIRST and fastest */}
          <a href={signalUrl} target="_blank" rel="noopener noreferrer"
            className="glass-card p-6 hover:border-[#3a76f0]/40 transition-all group relative overflow-hidden">
            {/* Subtle beam hint on the card border */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ background: 'rgba(58,118,240,0.12)', border: '1px solid rgba(58,118,240,0.3)' }}>
              <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="20" fill="#3a76f0"/>
                <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
                <path d="M19 23h10M19 27h6" stroke="#3a76f0" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h4 className="font-display font-bold text-primary mb-1">Signal Support</h4>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(58,118,240,0.15)', color: '#3a76f0', border: '1px solid rgba(58,118,240,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#3a76f0] animate-pulse inline-block"></span>
                {signalUrl.includes('Vaulter') ? 'Day Shift  4 AM – 4 PM' : 'Night Shift  4 PM – 4 AM'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡ Fastest</span>
            </div>
            <p className="text-muted text-sm mb-3">Encrypted, secure messaging. Auto-routes to the active shift agent based on your local time.</p>
            <span className="text-xs flex items-center gap-1" style={{ color: '#3a76f0' }}>Open Signal <ChevronRight className="w-3 h-3" /></span>
          </a>

          <a href={getTelegramUrl(settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps", useAuthStore.getState().user)} target="_blank" rel="noopener noreferrer"
            className="glass-card p-6 hover:border-blue-400/30 transition-all group">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Send className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="font-display font-bold text-primary mb-2">Telegram Support</h4>
            <p className="text-muted text-sm mb-3">Quick response via Telegram. Our team is online 24/7.</p>
            <span className="text-xs text-blue-400 flex items-center gap-1">Open Telegram <ChevronRight className="w-3 h-3" /></span>
          </a>

          <a href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://m.me/vaultsweeps'} target="_blank" rel="noopener noreferrer"
            className="glass-card p-6 hover:border-blue-600/30 transition-all group">
            <div className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-display font-bold text-primary mb-2">Facebook Messenger</h4>
            <p className="text-muted text-sm mb-3">Chat with us on Facebook Messenger for quick support.</p>
            <span className="text-xs text-blue-400 flex items-center gap-1">Open Messenger <ChevronRight className="w-3 h-3" /></span>
          </a>

          <a href="mailto:supportvaultsweeps@gmail.com"
            className="glass-card p-6 hover:border-purple-400/30 transition-all group">
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6 text-purple-400" />
            </div>
            <h4 className="font-display font-bold text-white mb-2">Email Support</h4>
            <p className="text-muted text-sm mb-3">Send us an email for detailed inquiries. Response within 2 hours.</p>
            <span className="text-xs text-purple-400 flex items-center gap-1">supportvaultsweeps@gmail.com <ChevronRight className="w-3 h-3" /></span>
          </a>

          <div className="glass-card p-6 sm:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-neon-blue" />
              <h4 className="font-display font-bold text-white">Response Times</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[['Telegram', '< 5 min', '#00D4FF'], ['Signal', '< 10 min', '#3a76f0'], ['Messenger', '< 15 min', '#1877F2'], ['Email', '< 2 hours', '#7B2FFF'], ['Ticket', '< 24 hours', '#00FFC8']].map(([ch, time, color]) => (
                <div key={ch} className="glass rounded-lg p-3 text-center">
                  <p className="text-xs text-muted mb-1">{ch}</p>
                  <p className="text-sm font-medium" style={{ color }}>{time}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
