'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Headset } from 'lucide-react'
import { publicApi } from '@/lib/api'

const SignalIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
    <path d="M19 23h10M19 27h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.29c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.027l-2.96-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.626.56z"/>
  </svg>
)

const MessengerIcon = () => (
  <svg viewBox="0 0 32 32" className="w-[18px] h-[18px]" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.268 2 2 7.925 2 15.208c0 4.135 1.98 7.826 5.08 10.274V30l4.647-2.554A15.18 15.18 0 0 0 16 27.833c7.732 0 14-5.925 14-13.208S23.732 2 16 2zm1.393 17.793-3.558-3.794-6.943 3.794 7.636-8.107 3.648 3.794 6.853-3.794-7.636 8.107z"/>
  </svg>
)

interface ContactItem {
  key: string
  href: string
  icon: React.ReactNode
  label: string
  badge?: string
  gradient: string
  glow: string
}

interface Props {
  inlinePill?: boolean
}

export default function ExpandableContactFab({ inlinePill = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    publicApi.getSettings().then(res => {
      setSettings(res.data?.data || {})
    }).catch(() => {})
  }, [])

  const currentHour = new Date().getHours()
  const isDayShift = currentHour >= 4 && currentHour < 16
  const signalDayUrl = process.env.NEXT_PUBLIC_SIGNAL_DAY_URL
  const signalNightUrl = process.env.NEXT_PUBLIC_SIGNAL_NIGHT_URL
  const signalUrl = isDayShift ? (signalDayUrl || signalNightUrl) : (signalNightUrl || signalDayUrl)

  const telegramUrl = settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'
  const facebookUrl = settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'

  const contacts: ContactItem[] = [
    ...(signalUrl ? [{
      key: 'signal',
      href: signalUrl,
      icon: <SignalIcon />,
      label: 'Signal Support',
      badge: isDayShift ? 'D' : 'N',
      gradient: 'from-[#2563eb] to-[#1d4ed8]',
      glow: 'rgba(37,99,235,0.6)',
    }] : []),
    {
      key: 'telegram',
      href: telegramUrl,
      icon: <TelegramIcon />,
      label: 'Telegram',
      gradient: 'from-[#0EA5E9] to-[#0284C7]',
      glow: 'rgba(14,165,233,0.55)',
    },
    {
      key: 'messenger',
      href: facebookUrl,
      icon: <MessengerIcon />,
      label: 'Messenger',
      gradient: 'from-[#7C3AED] to-[#6D28D9]',
      glow: 'rgba(124,58,237,0.55)',
    },
  ]

  const buttonSize = inlinePill ? 'w-9 h-9' : 'w-12 h-12'
  const iconSize = inlinePill ? 'w-[18px] h-[18px]' : 'w-5 h-5'

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close when clicking outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Fan-out buttons above the trigger */}
            <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2.5 z-50">
              {contacts.map((c, i) => (
                <motion.a
                  key={c.key}
                  initial={{ opacity: 0, scale: 0.6, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, y: 8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.055 }}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={c.label}
                  onClick={() => setIsOpen(false)}
                  className={`group relative w-10 h-10 bg-gradient-to-br ${c.gradient} rounded-full flex items-center justify-center border border-white/15 hover:scale-110 active:scale-95 transition-transform duration-150`}
                  style={{ boxShadow: `0 4px 18px ${c.glow}` }}
                >
                  {c.icon}
                  {c.badge && (
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-black text-white flex items-center justify-center shadow-md ${isDayShift ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    >
                      {c.badge}
                    </span>
                  )}
                  {/* Label tooltip */}
                  <span className="absolute right-full mr-2.5 whitespace-nowrap bg-[#0f0f1e]/95 backdrop-blur text-white/90 text-[11px] font-semibold px-2 py-0.5 rounded-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-white/8 shadow-xl">
                    {c.label}
                  </span>
                </motion.a>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close support' : 'Support'}
        className={`relative ${buttonSize} rounded-full flex items-center justify-center transition-all duration-200 z-50 ${
          inlinePill
            ? `${isOpen ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/8'}`
            : `bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white shadow-xl border border-white/15`
        }`}
        style={inlinePill ? undefined : { boxShadow: '0 4px 24px rgba(124,58,237,0.5)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="x"
              initial={{ rotate: -80, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 80, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <X className={iconSize} />
            </motion.span>
          ) : (
            <motion.span key="chat"
              initial={{ rotate: 80, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -80, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center"
            >
              <Headset className={iconSize} />
            </motion.span>
          )}
        </AnimatePresence>
        {/* Pulse ring when closed (desktop standalone only) */}
        {!isOpen && !inlinePill && (
          <span className="absolute inset-0 rounded-full animate-ping bg-violet-500/30 pointer-events-none" style={{ animationDuration: '2.5s' }} />
        )}
      </button>
    </div>
  )
}
