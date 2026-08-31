'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, RotateCw, Gem, Users, Wrench, X, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import WheelModal from '@/components/wheel/WheelModal'

const MAINTENANCE_KEYS = ['VIP Club']

type QuickLink = {
  title: string
  subtitle: string
  icon: any
  href: string
  action?: string
  gradient: string
  glow: string
}

const LINKS: QuickLink[] = [
  {
    title: 'VIP Club',
    subtitle: 'Exclusive perks',
    icon: Crown,
    href: '/vip',
    gradient: 'linear-gradient(150deg, #1B3FAE 0%, #3E7BFF 100%)',
    glow: 'rgba(47,107,255,0.4)',
  },
  {
    title: 'Daily Spin',
    subtitle: 'Free daily prize',
    icon: RotateCw,
    href: '#',
    action: 'modal',
    gradient: 'linear-gradient(150deg, #C2540A 0%, #FFA338 100%)',
    glow: 'rgba(242,129,30,0.4)',
  },
  {
    title: 'Bonus Zone',
    subtitle: 'Live promotions',
    icon: Gem,
    href: '/bonuses',
    gradient: 'linear-gradient(150deg, #00695E 0%, #00CBB4 100%)',
    glow: 'rgba(0,169,154,0.4)',
  },
  {
    title: 'Refer & Earn',
    subtitle: 'Earn up to $10',
    icon: Users,
    href: '/dashboard/invite',
    gradient: 'linear-gradient(150deg, #0F6A36 0%, #34D06A 100%)',
    glow: 'rgba(31,174,85,0.4)',
  }
]

export default function QuickLinks() {
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [maintenanceTitle, setMaintenanceTitle] = useState('')
  const [showWheelModal, setShowWheelModal] = useState(false)
  const { isAuthenticated, openAuthModal } = useAuthStore()

  const handleClick = (e: React.MouseEvent, link: any) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
      return
    }

    if (MAINTENANCE_KEYS.includes(link.title)) {
      e.preventDefault()
      setMaintenanceTitle(link.title)
      setShowMaintenance(true)
      return
    }

    if (link.action === 'modal' && link.title === 'Daily Spin') {
      e.preventDefault()
      setShowWheelModal(true)
    }
  }

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {LINKS.map((link, i) => (
            <Link href={link.href} key={i} onClick={(e) => handleClick(e, link)} aria-label={`${link.title} — ${link.subtitle}`}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 h-28 sm:h-32 lg:h-36 flex flex-col justify-between cursor-pointer"
                style={{ background: link.gradient, boxShadow: `0 10px 24px -8px ${link.glow}` }}
              >
                {/* Spotlight glow behind the icon, plus a top sheen for depth */}
                <div aria-hidden className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white blur-2xl opacity-30" />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, transparent 40%, rgba(0,0,0,0.12) 100%)' }}
                />

                {/* Hover sheen sweep */}
                <div
                  aria-hidden
                  className="absolute inset-0 -translate-x-[120%] group-hover:translate-x-[120%] transition-transform duration-700 ease-out"
                  style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.22) 50%, transparent 58%)' }}
                />

                <div className="relative z-10 flex items-start justify-between">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 border border-white/25 backdrop-blur-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
                  >
                    <link.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" />
                </div>

                <div className="relative z-10">
                  <h3 className="font-display font-bold text-white text-sm sm:text-base leading-tight tracking-wide drop-shadow-sm">
                    {link.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/75 mt-0.5 leading-tight">
                    {link.subtitle}
                  </p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      {/* Maintenance Popup */}
      <AnimatePresence>
        {showMaintenance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowMaintenance(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-surface border border-border-strong rounded-2xl p-7 max-w-sm w-full shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />

              <button
                aria-label="Close maintenance popup"
                onClick={() => setShowMaintenance(false)}
                className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mt-2">
                <div className="w-16 h-16 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-orange-400" />
                </div>
                <h3 className="text-xl font-display font-bold text-white mb-1">{maintenanceTitle}</h3>
                <p className="text-orange-400 font-semibold text-sm mb-3">Under Maintenance · Coming Soon</p>
                <p className="text-secondary text-sm leading-relaxed">
                  This feature is currently being built and will be available very soon. Stay tuned!
                </p>
              </div>

              <button
                onClick={() => setShowMaintenance(false)}
                className="mt-6 w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <WheelModal isOpen={showWheelModal} onClose={() => setShowWheelModal(false)} />
    </>
  )
}
