'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Headset } from 'lucide-react'
import { publicApi } from '@/lib/api'

const SignalIcon = () => (
  <svg viewBox="0 0 64 64" className="w-[20px] h-[20px]" fill="none">
    {/* Signal messenger logo - shield/speech bubble shape */}
    <path d="M32 4C16.536 4 4 16.536 4 32c0 5.23 1.484 10.117 4.06 14.27L4 60l13.897-3.998A27.87 27.87 0 0 0 32 60c15.464 0 28-12.536 28-28S47.464 4 32 4z" fill="white" fillOpacity="0.95"/>
    <path d="M20 30h24M20 37h16" stroke="#1D4ED8" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="32" cy="23" r="4" fill="#1D4ED8"/>
  </svg>
)
const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" fill="white">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.29c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.027l-2.96-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.626.56z"/>
  </svg>
)
const MessengerIcon = () => (
  <svg viewBox="0 0 32 32" className="w-[17px] h-[17px]" fill="white">
    <path d="M16 2C8.268 2 2 7.925 2 15.208c0 4.135 1.98 7.826 5.08 10.274V30l4.647-2.554A15.18 15.18 0 0 0 16 27.833c7.732 0 14-5.925 14-13.208S23.732 2 16 2zm1.393 17.793-3.558-3.794-6.943 3.794 7.636-8.107 3.648 3.794 6.853-3.794-7.636 8.107z"/>
  </svg>
)

interface ContactItem {
  key: string; href: string; icon: React.ReactNode; label: string
  badge?: string; gradient: string; glow: string; beam: string
}
interface Props { inlinePill?: boolean }

export default function ExpandableContactFab({ inlinePill = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    publicApi.getSettings().then(res => setSettings(res.data?.data || {})).catch(() => {})
  }, [])

  // Initialize with actual hour to avoid wrong URL on first render
  const [currentHour, setCurrentHour] = useState(() => {
    if (typeof window !== 'undefined') return new Date().getHours()
    return 12 // default to midday (day shift) on server
  })
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setCurrentHour(new Date().getHours()); setMounted(true) }, [])

  const isDayShift = currentHour >= 4 && currentHour < 16
  const signalDayUrl = settings.signal_day_url || process.env.NEXT_PUBLIC_SIGNAL_DAY_URL
  const signalNightUrl = settings.signal_night_url || process.env.NEXT_PUBLIC_SIGNAL_NIGHT_URL
  const signalUrl = isDayShift
    ? (signalDayUrl || signalNightUrl || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#')
    : (signalNightUrl || signalDayUrl || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#')
  const telegramUrl = settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'
  const facebookUrl = settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'

  const contacts: ContactItem[] = [
    {
      key: 'signal', href: signalUrl, icon: <SignalIcon />, label: 'Signal',
      badge: isDayShift ? 'D' : 'N',
      gradient: 'from-[#1D4ED8] to-[#3B82F6]',
      glow: 'rgba(59,130,246,0.7)',
      beam: 'conic-gradient(from 0deg, transparent 55%, #93C5FD 78%, #3B82F6 90%, transparent)',
    },
    {
      key: 'telegram', href: telegramUrl, icon: <TelegramIcon />, label: 'Telegram',
      gradient: 'from-[#0369A1] to-[#0EA5E9]',
      glow: 'rgba(14,165,233,0.65)',
      beam: 'conic-gradient(from 0deg, transparent 55%, #7DD3FC 78%, #0EA5E9 90%, transparent)',
    },
    {
      key: 'messenger', href: facebookUrl, icon: <MessengerIcon />, label: 'Messenger',
      gradient: 'from-[#6D28D9] to-[#8B5CF6]',
      glow: 'rgba(139,92,246,0.65)',
      beam: 'conic-gradient(from 0deg, transparent 55%, #C4B5FD 78%, #8B5CF6 90%, transparent)',
    },
  ]

  return (
    <div className="relative flex items-center justify-center" style={{ zIndex: 60 }}>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-3 z-50">
              {contacts.map((c, i) => (
                <motion.div
                  key={c.key}
                  initial={{ opacity: 0, scale: 0.4, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.4, y: 10 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30, delay: i * 0.06 }}
                  className="relative group flex items-center justify-center"
                >
                  {/* Spinning beam ring ONLY for Signal */}
                  {c.key === 'signal' && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        inset: -3,
                        borderRadius: '50%',
                        background: c.beam,
                        animation: 'spin 2.2s linear infinite',
                      }}
                    />
                  )}
                  {/* Button */}
                  <a
                    href={c.href} target="_blank" rel="noopener noreferrer"
                    aria-label={c.label} onClick={() => setIsOpen(false)}
                    className={`relative w-[46px] h-[46px] bg-gradient-to-br ${c.gradient} rounded-full flex items-center justify-center border border-white/20 hover:scale-110 active:scale-95 transition-transform duration-150`}
                    style={{ boxShadow: `0 4px 20px ${c.glow}`, zIndex: 1 }}
                  >
                    {c.icon}
                    {c.badge && (
                      <span className={`absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full text-[9px] font-black text-white flex items-center justify-center shadow-lg border border-white/20 ${isDayShift ? 'bg-[#F59E0B]' : 'bg-[#6366F1]'}`}>
                        {c.badge}
                      </span>
                    )}
                  </a>
                  {/* Tooltip */}
                  <span className="absolute right-full mr-3 whitespace-nowrap bg-[#0f0f23]/95 backdrop-blur-md text-white/90 text-xs font-semibold px-3 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 shadow-xl">
                    {c.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main toggle */}
      <div className="relative flex items-center justify-center">
        {/* SPINNING BEAM RING — wraps around the button */}
        {!isOpen && (
          <div
            className="absolute pointer-events-none"
            style={{
              inset: inlinePill ? -3 : -4,
              borderRadius: '50%',
              background: inlinePill
                ? 'conic-gradient(from 0deg, transparent 40%, rgba(167,139,250,0.8) 75%, #A855F7 88%, rgba(216,180,254,1) 95%, transparent)'
                : 'conic-gradient(from 0deg, transparent 50%, rgba(167,139,250,0.6) 72%, #8B5CF6 88%, rgba(99,102,241,0.9) 96%, transparent)',
              animation: 'spin 2.2s linear infinite',
            }}
          />
        )}
        <button
          onClick={() => setIsOpen(v => !v)}
          aria-label={isOpen ? 'Close support' : 'Contact Support'}
          className={`relative flex items-center justify-center transition-all duration-200 active:scale-90 ${
            inlinePill
              ? `w-[46px] h-[46px] rounded-[18px] bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#4F46E5] border border-violet-400/50 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]`
              : `w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white border border-violet-400/30`
          }`}
          style={inlinePill ? undefined : {
            boxShadow: '0 0 0 1px rgba(139,92,246,0.3), 0 4px 24px rgba(124,58,237,0.5)',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen
              ? <motion.span key="x"
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.18 }}
                  className="flex">
                  <X className="w-[18px] h-[18px]" />
                </motion.span>
              : <motion.span key="h"
                  initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.18 }}
                  className="flex">
                  <Headset className="w-[18px] h-[18px]" />
                </motion.span>
            }
          </AnimatePresence>
        </button>
      </div>
    </div>
  )
}
