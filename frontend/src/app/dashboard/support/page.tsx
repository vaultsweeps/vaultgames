'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { HelpCircle, Plus, MessageCircle, Send, ChevronRight, ChevronDown, Clock, Mail, Zap, Ticket, MessageSquare } from 'lucide-react'
import { supportApi, publicApi } from '@/lib/api'
import { getSmsUrl } from '@/lib/sms'
import LiveChat from './LiveChat'
import { Badge, Button, Card, EmptyState, Field, IconTile, PageHeader, SectionHeading, Skeleton, StatusBadge, TabBar, cardClass, cn, type Tone } from '@/components/dashboard/ui'

const CATEGORIES = ['General', 'Deposits', 'Cashouts', 'Games', 'Bonuses', 'Technical', 'Account', 'Other']
const PRIORITIES = ['low', 'medium', 'high']

const PRIORITY_TONE: Record<string, Tone> = { low: 'slate', medium: 'gold', high: 'red', urgent: 'red' }

type TabId = 'live_chat' | 'tickets' | 'new' | 'contact'

const TABS: { id: TabId; label: string; icon?: React.ReactNode }[] = [
  { id: 'live_chat', label: 'Live Chat', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'tickets', label: 'My Tickets' },
  { id: 'new', label: 'New Ticket', icon: <Plus className="w-4 h-4" /> },
  { id: 'contact', label: 'Contact Us' },
]

const RESPONSE_TIMES: [string, string, string][] = [
  ['Telegram', '< 5 min', '#38BDF8'],
  ['Signal', '< 10 min', '#60A5FA'],
  ['Messenger', '< 15 min', '#3B82F6'],
  ['Email', '< 2 hours', '#A78BFA'],
  ['Ticket', '< 24 hours', '#34D399'],
]

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function relativeDate(value: any) {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleDateString()
}

/** Signal brand mark, shaped to slot into IconTile like a lucide icon. */
function SignalGlyph({ size = 28 }: { size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="#3a76f0" />
      <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white" />
      <path d="M19 23h10M19 27h6" stroke="#3a76f0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ContactCard({ href, icon, tone, title, badge, chips, text, cta, ...rest }: {
  href: string; icon: React.ComponentProps<typeof IconTile>['icon']; tone: Tone; title: string; badge?: React.ReactNode
  chips: React.ReactNode; text: string; cta: string; target?: string; rel?: string
}) {
  return (
    <a href={href} {...rest} className={cn(cardClass({ interactive: true }), 'group flex flex-col min-w-0')}>
      <div className="flex items-start gap-4">
        <IconTile icon={icon} tone={tone} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="text-[17px] font-semibold text-primary leading-tight">{title}</h3>
            {badge}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">{chips}</div>
        </div>
      </div>
      <p className="mt-4 text-[14px] text-secondary leading-relaxed">{text}</p>
      <span className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between gap-2 text-[14px] font-semibold min-w-0" style={{ color: 'var(--ds-link, #38BDF8)' }}>
        <span className="truncate min-w-0">{cta}</span>
        <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}

const timeChip = (label: string) => (
  <Badge tone="slate"><Clock className="w-3 h-3" />{label}</Badge>
)

export default function SupportPage() {
  const [tab, setTab] = useState<TabId>('live_chat')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [settings, setSettings] = useState<any>({})
  const [smsUrl, setsmsUrl] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
    setsmsUrl(getSmsUrl())
    // Refresh signal URL every minute in case the shift changes while the page is open
    const t = setInterval(() => setsmsUrl(getSmsUrl()), 60_000)
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
    <div className="max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Support" subtitle="We're here to help — pick the fastest way to reach us." />
      </motion.div>

      {/* Tabs — scroll inside their own container on narrow screens */}
      <div className="mb-5 sm:mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabBar tabs={TABS} active={tab} onChange={setTab} className="min-w-max" />
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
            <div className="space-y-3" aria-busy="true" aria-label="Loading tickets">
              <Skeleton className="h-[112px]" />
              <Skeleton className="h-[112px]" />
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map(t => (
                <div key={t.id} className={cn(cardClass(), 'min-w-0')}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-[16px] font-semibold text-primary leading-snug break-words">{t.subject}</h3>
                    <StatusBadge status={t.status} className="flex-shrink-0" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{cap(t.category)}</Badge>
                    <Badge tone={PRIORITY_TONE[t.priority] || 'slate'}>{cap(t.priority)} priority</Badge>
                  </div>
                  <div className="mt-3.5 pt-3.5 border-t border-border-subtle flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t.replies?.length ?? 0} {(t.replies?.length ?? 0) === 1 ? 'reply' : 'replies'}
                    </span>
                    <span className="inline-flex items-center gap-1.5" title={new Date(t.createdAt).toLocaleString()}>
                      <Clock className="w-3.5 h-3.5" />{relativeDate(t.createdAt)}
                    </span>
                    <span className="sm:ml-auto text-xs text-muted font-mono">#{t.id.slice(0, 8)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={HelpCircle}
                title="No support tickets yet"
                text="Need help? Create a ticket and our team will assist you."
                action={<Button onClick={() => setTab('new')}><Plus className="w-4 h-4" />New ticket</Button>}
              />
            </Card>
          )}
        </motion.div>
      )}

      {/* New ticket form */}
      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <IconTile icon={Ticket} tone="purple" size="md" />
              <div className="min-w-0">
                <SectionHeading title="Open a new ticket" className="!mb-0" />
                <p className="text-[13px] text-secondary mt-0.5">Tell us what's going on and we'll get back to you.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              <Field label="Subject" error={errors.subject && (errors.subject.message as string)}>
                <input {...register('subject', { required: 'Subject is required' })} type="text"
                  placeholder="Brief description of your issue"
                  className="ds-input !text-[16px]" />
              </Field>
              <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Category" error={errors.category && 'Please select a category'}>
                  <div className="relative">
                    <select {...register('category', { required: true })} className="ds-input !text-[16px] appearance-none !pr-10">
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Field>
                <Field label="Priority">
                  <div className="relative">
                    <select {...register('priority')} className="ds-input !text-[16px] appearance-none !pr-10">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Field>
              </div>
              <Field label="Message" error={errors.message && (errors.message.message as string)}>
                <textarea {...register('message', { required: 'Message is required', minLength: { value: 20, message: 'Please provide more details (min 20 chars)' } })}
                  rows={6} placeholder="Describe your issue in detail..."
                  className="ds-input !text-[16px] resize-none leading-relaxed" />
              </Field>
              <div className="pt-1">
                <Button type="submit" size="md" disabled={isSubmitting} className="w-full sm:w-auto sm:min-w-[200px]">
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : 'Submit ticket'}
                </Button>
                <p className="mt-3 text-[13px] text-muted">We usually reply within 24 hours.</p>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Contact */}
      {tab === 'contact' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Signal – FIRST and fastest */}
            <ContactCard
              href={smsUrl} target="_blank" rel="noopener noreferrer"
              icon={SignalGlyph} tone="blue" title="Text Support"
              badge={<Badge tone="green"><Zap className="w-3 h-3" />Fastest</Badge>}
              chips={<>
                {timeChip('< 10 min')}
                <Badge tone="blue">{smsUrl.includes('Vaulter') ? 'Day shift · 4 AM – 4 PM' : 'Night shift · 4 PM – 4 AM'}</Badge>
              </>}
              text="Encrypted, secure messaging. Auto-routes to the active shift agent based on your local time."
              cta="Open Signal"
            />

            <ContactCard
              href={getTelegramUrl(settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps", useAuthStore.getState().user)}
              target="_blank" rel="noopener noreferrer"
              icon={Send} tone="cyan" title="Telegram Support"
              chips={timeChip('< 5 min')}
              text="Quick response via Telegram. Our team is online 24/7."
              cta="Open Telegram"
            />

            <ContactCard
              href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://m.me/vaultsweeps'}
              target="_blank" rel="noopener noreferrer"
              icon={MessageCircle} tone="blue" title="Facebook Messenger"
              chips={timeChip('< 15 min')}
              text="Chat with us on Facebook Messenger for quick support."
              cta="Open Messenger"
            />

            <ContactCard
              href="mailto:supportvaultsweeps@gmail.com"
              icon={Mail} tone="purple" title="Email Support"
              chips={timeChip('< 2 hours')}
              text="Send us an email for detailed inquiries. Response within 2 hours."
              cta="supportvaultsweeps@gmail.com"
            />
          </div>

          <Card>
            <SectionHeading title="Response times" action={<Clock className="w-4 h-4 text-muted" />} />
            <ul className="divide-y divide-[var(--border-subtle)]">
              {RESPONSE_TIMES.map(([ch, time, color]) => (
                <li key={ch} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0">
                  <span className="flex items-center gap-3 min-w-0 text-[15px] text-primary">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="truncate">{ch}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>{time}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
