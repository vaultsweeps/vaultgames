'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Info, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react'
import { Button, EmptyState, IconTile, PageHeader, Skeleton, TONES, cn, type Tone } from '@/components/dashboard/ui'
import { notificationsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  createdAt: string
  link?: string
}

// Lucide icons vs the shared IconTile prop type (propTypes invariance on size/strokeWidth). Remove once ui.tsx accepts LucideIcon.
const asIcon = (i: unknown): any => i

const TYPE_STYLE: Record<string, { icon: typeof Info; tone: Tone }> = {
  success: { icon: ShieldCheck, tone: 'green' },
  warning: { icon: AlertTriangle, tone: 'orange' },
  error: { icon: XCircle, tone: 'red' },
  info: { icon: Info, tone: 'cyan' },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getAll()
      setNotifications(res.data.data)
    } catch (err) {
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch {
      toast.error('Could not update notification')
    }
  }

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast.success('All marked as read')
    } catch {
      toast.error('Could not update notifications')
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="max-w-3xl pb-6">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `Stay updated with your account activity · ${unreadCount} unread` : 'Stay updated with your account activity'}
        actions={
          notifications.some(n => !n.isRead) && (
            <Button variant="secondary" size="sm" onClick={markAllAsRead}>
              <Check size={16} strokeWidth={2.25} /> Mark all as read
            </Button>
          )
        }
      />

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-[92px] !rounded-[20px]" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="ds-card">
            <EmptyState icon={asIcon(Bell)} title="No notifications yet" text="You're all caught up!" />
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((notif, i) => {
              const s = TYPE_STYLE[notif.type] || TYPE_STYLE.info
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                  className={cn(
                    'relative flex gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-[20px] border transition-colors',
                    notif.isRead
                      ? 'bg-surface-elevated border-border-subtle'
                      : 'ds-card !border-border-strong cursor-pointer hover:brightness-110'
                  )}
                  style={!notif.isRead ? { boxShadow: `inset 3px 0 0 ${TONES[s.tone].fg}, 0 14px 34px -18px rgba(0,0,0,0.5)` } : undefined}
                >
                  <div className={notif.isRead ? 'opacity-60' : undefined}>
                    <IconTile icon={asIcon(s.icon)} tone={s.tone} size="md" className="!rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={cn('text-[15px] font-semibold leading-snug break-words', notif.isRead ? 'text-secondary' : 'text-primary')}>
                        {notif.title}
                      </h3>
                      {!notif.isRead && (
                        <span aria-label="Unread" className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TONES[s.tone].fg, boxShadow: `0 0 0 4px ${TONES[s.tone].bg}` }} />
                      )}
                    </div>
                    <p className="mt-1 text-[14px] text-secondary leading-relaxed break-words">{notif.message}</p>
                    <p className="mt-2 text-xs text-muted">{new Date(notif.createdAt).toLocaleDateString()}</p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
