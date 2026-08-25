'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X, Headset } from 'lucide-react'
import { publicApi } from '@/lib/api'

const SignalIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
    <path d="M19 23h10M19 27h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.29c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.027l-2.96-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.626.56z"/>
  </svg>
)

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 3.313 1.344 6.313 3.516 8.484L3 24l3.516-.516C8.344 24.656 10.172 25 12 25c6.627 0 12-5.372 12-12S18.627 0 12 0zm6.188 16.5l-1.875-1.124C15.75 16.375 14.25 17 12 17c-3.75 0-6.75-2.625-6.75-6s3-6 6.75-6c3.75 0 6.75 2.625 6.75 6 0 1.875-.75 3.375-1.875 4.5l1.313 3-3-1.875v.875z"/>
  </svg>
)

const fabVariants = {
  hidden: { opacity: 0, scale: 0.5, y: 12 },
  visible: (i: number) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 22, delay: i * 0.06 }
  }),
  exit: (i: number) => ({
    opacity: 0, scale: 0.5, y: 8,
    transition: { duration: 0.15, delay: i * 0.04 }
  })
}

export default function ExpandableContactFab() {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    publicApi.getSettings().then(res => {
      setSettings(res.data?.data || {})
    }).catch(() => {})
  }, [])

  // Signal: auto-route by time of day using env vars (day 4 AM–4 PM, night otherwise)
  const currentHour = new Date().getHours()
  const isDayShift = currentHour >= 4 && currentHour < 16
  const signalDayUrl = process.env.NEXT_PUBLIC_SIGNAL_DAY_URL
  const signalNightUrl = process.env.NEXT_PUBLIC_SIGNAL_NIGHT_URL
  const signalUrl = isDayShift ? (signalDayUrl || signalNightUrl) : (signalNightUrl || signalDayUrl)
  const shiftLabel = isDayShift ? 'D' : 'N'

  const telegramUrl = settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'
  const facebookUrl = settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'

  const contacts = [
    ...(signalUrl ? [{
      key: 'signal',
      href: signalUrl,
      icon: <SignalIcon />,
      label: 'Signal Support',
      badge: shiftLabel,
      bg: 'from-[#3a76f0] to-[#1d4ed8]',
      shadow: 'rgba(59,130,246,0.5)',
    }] : []),
    {
      key: 'telegram',
      href: telegramUrl,
      icon: <TelegramIcon />,
      label: 'Telegram Support',
      bg: 'from-[#29B6F6] to-[#0288D1]',
      shadow: 'rgba(41,182,246,0.5)',
    },
    {
      key: 'messenger',
      href: facebookUrl,
      icon: <MessengerIcon />,
      label: 'Facebook Messenger',
      bg: 'from-[#9C27B0] to-[#7B1FA2]',
      shadow: 'rgba(156,39,176,0.5)',
    },
  ]

  return (
    <div className="relative pointer-events-auto z-50 flex flex-col items-center">
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-3">
            {contacts.map((c, i) => (
              <motion.a
                key={c.key}
                custom={i}
                variants={fabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={c.label}
                className={`relative w-12 h-12 bg-gradient-to-br ${c.bg} rounded-full flex items-center justify-center shadow-xl border border-white/15 hover:scale-110 transition-transform duration-200`}
                style={{ boxShadow: `0 4px 20px ${c.shadow}` }}
              >
                {c.icon}
                {c.badge && (
                  <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-black text-white flex items-center justify-center shadow-md ${isDayShift ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                    {c.badge}
                  </span>
                )}
                {/* Tooltip */}
                <span className="absolute right-full mr-3 whitespace-nowrap bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 border border-white/10 shadow-xl">
                  {c.label}
                </span>
              </motion.a>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        aria-label={isOpen ? 'Close support menu' : 'Open support menu'}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-white shadow-xl border border-white/15"
        style={{ boxShadow: '0 4px 24px rgba(124,58,237,0.55)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <Headset className="w-5 h-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
