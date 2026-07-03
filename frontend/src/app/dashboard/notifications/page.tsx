'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Info, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react'
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <ShieldCheck className="w-5 h-5 text-green-400" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-400" />
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />
      default: return <Info className="w-5 h-5 text-neon-blue" />
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-neon-blue" /> Notifications
          </h2>
          <p className="text-slate-400 text-sm mt-1">Stay updated with your account activity</p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={markAllAsRead}
            className="text-xs bg-white/5 hover:bg-white/10 text-white font-mono px-4 py-2 rounded-lg transition-colors border border-white/10"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-card p-12 text-center border border-white/5">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-1">No notifications yet</h3>
            <p className="text-slate-500 text-sm">You're all caught up!</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((notif, i) => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  notif.isRead 
                    ? 'bg-[#13161F] border-white/5 opacity-70' 
                    : 'bg-[#1A1E29] border-white/10 hover:border-white/20 shadow-lg'
                }`}
              >
                <div className="flex gap-4">
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notif.isRead ? 'bg-white/5' : 'bg-white/10'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-bold truncate ${notif.isRead ? 'text-slate-300' : 'text-white'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-500 ml-2 shrink-0">
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{notif.message}</p>
                  </div>
                  {!notif.isRead && (
                    <div className="shrink-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
