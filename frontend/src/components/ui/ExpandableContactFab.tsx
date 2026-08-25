'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Headset } from 'lucide-react'
import { publicApi } from '@/lib/api'

/* ─── SVG Icons ────────────────────────────────────────────── */
const SignalIcon = () => (
  <svg viewBox="0 0 48 48" className="w-[18px] h-[18px]" fill="none">
    <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
    <path d="M19 23h10M19 27h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
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

/* ─── Beam Ring (rotating conic-gradient) ─────────────────── */
function BeamRing({ color = '#7C3AED', color2 = '#2563EB', size = 44 }: { color?: string; color2?: string; size?: number }) {
  return (
    <span
      className="absolute inset-0 rounded-full pointer-events-none animate-spin-slow"
      style={{
        background: `conic-gradient(from 0deg, transparent 60%, ${color2}80 80%, ${color} 100%, transparent)`,
        padding: 2,
        borderRadius: '50%',
        animationDuration: '2.8s',
        zIndex: -1,
      }}
    />
  )
}

interface ContactItem {
  key: string; href: string; icon: React.ReactNode; label: string
  badge?: string; gradient: string; glow: string; beamColor: string; beamColor2: string
}
interface Props { inlinePill?: boolean }

export default function ExpandableContactFab({ inlinePill = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    publicApi.getSettings().then(res => setSettings(res.data?.data || {})).catch(() => {})
  }, [])

  const currentHour = new Date().getHours()
  const isDayShift = currentHour >= 4 && currentHour < 16
  const signalUrl = isDayShift
    ? (process.env.NEXT_PUBLIC_SIGNAL_DAY_URL || process.env.NEXT_PUBLIC_SIGNAL_NIGHT_URL)
    : (process.env.NEXT_PUBLIC_SIGNAL_NIGHT_URL || process.env.NEXT_PUBLIC_SIGNAL_DAY_URL)
  const telegramUrl = settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'
  const facebookUrl = settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'

  const contacts: ContactItem[] = [
    ...(signalUrl ? [{
      key: 'signal', href: signalUrl, icon: <SignalIcon />, label: 'Signal Support',
      badge: isDayShift ? 'D' : 'N',
      gradient: 'from-[#1D4ED8] to-[#2563EB]',
      glow: 'rgba(37,99,235,0.65)', beamColor: '#60A5FA', beamColor2: '#1D4ED8',
    }] : []),
    {
      key: 'telegram', href: telegramUrl, icon: <TelegramIcon />, label: 'Telegram',
      gradient: 'from-[#0369A1] to-[#0EA5E9]',
      glow: 'rgba(14,165,233,0.6)', beamColor: '#38BDF8', beamColor2: '#0369A1',
    },
    {
      key: 'messenger', href: facebookUrl, icon: <MessengerIcon />, label: 'Messenger',
      gradient: 'from-[#6D28D9] to-[#7C3AED]',
      glow: 'rgba(124,58,237,0.6)', beamColor: '#A78BFA', beamColor2: '#6D28D9',
    },
  ]

  const btnBase = inlinePill
    ? `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${isOpen ? 'bg-violet-500/25 text-violet-200' : 'text-white/45 hover:text-white/90 hover:bg-white/8'}`
    : `w-12 h-12 rounded-full flex items-center justify-center text-white border border-white/15 bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-[0_0_24px_rgba(124,58,237,0.55)] hover:shadow-[0_0_32px_rgba(124,58,237,0.8)] transition-all duration-300`

  return (
    <div className="relative flex items-center justify-center" style={{ zIndex: 60 }}>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2 z-50">
              {contacts.map((c, i) => (
                <motion.a
                  key={c.key}
                  initial={{ opacity: 0, scale: 0.5, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: 8 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28, delay: i * 0.06 }}
                  href={c.href} target="_blank" rel="noopener noreferrer"
                  aria-label={c.label} onClick={() => setIsOpen(false)}
                  className={`group relative w-11 h-11 bg-gradient-to-br ${c.gradient} rounded-full flex items-center justify-center border border-white/15 hover:scale-110 active:scale-95 transition-transform duration-150 overflow-visible`}
                  style={{ boxShadow: `0 4px 20px ${c.glow}` }}
                >
                  {/* Beam ring on each expanded button */}
                  <BeamRing color={c.beamColor} color2={c.beamColor2} />
                  {c.icon}
                  {c.badge && (
                    <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-black text-white flex items-center justify-center shadow-md ${isDayShift ? 'bg-amber-500 shadow-amber-500/50' : 'bg-indigo-500 shadow-indigo-500/50'}`}>
                      {c.badge}
                    </span>
                  )}
                  {/* Tooltip */}
                  <span className="absolute right-full mr-2.5 whitespace-nowrap bg-[#0d0d1f]/95 backdrop-blur-sm text-white/85 text-[11px] font-semibold px-2.5 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-white/8 shadow-2xl">
                    {c.label}
                  </span>
                </motion.a>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main toggle */}
      <button
        onClick={() => setIsOpen(v => !v)}
        aria-label={isOpen ? 'Close support' : 'Contact Support'}
        className={`relative ${btnBase}`}
      >
        {/* Spinning beam ring (standalone mode only) */}
        {!inlinePill && !isOpen && (
          <span
            className="absolute inset-[-3px] rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, transparent 50%, rgba(139,92,246,0.6) 75%, rgba(99,102,241,0.9) 90%, transparent)',
              borderRadius: '50%',
              animation: 'spin 2.4s linear infinite',
              zIndex: -1,
            }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {isOpen
            ? <motion.span key="x" initial={{ rotate: -80, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 80, opacity: 0, scale: 0.5 }} transition={{ duration: 0.18 }} className="flex"><X className="w-[18px] h-[18px]" /></motion.span>
            : <motion.span key="h" initial={{ rotate: 80, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: -80, opacity: 0, scale: 0.5 }} transition={{ duration: 0.18 }} className="flex"><Headset className="w-[18px] h-[18px]" /></motion.span>
          }
        </AnimatePresence>
      </button>
    </div>
  )
}
