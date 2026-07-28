'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, RotateCw, Gem, Users, Wrench, X } from 'lucide-react'

const MAINTENANCE_KEYS = ['VIP Club', 'Daily Spin']

const LINKS = [
  {
    title: 'VIP Club',
    icon: Crown,
    href: '/vip',
    gradient: 'from-[#ff9a44] to-[#fc6076]',
    shadowColor: 'rgba(255, 154, 68, 0.4)',
    iconColor: 'text-yellow-200',
  },
  {
    title: 'Daily Spin',
    icon: RotateCw,
    href: '#',
    gradient: 'from-[#4facfe] to-[#00f2fe]',
    shadowColor: 'rgba(79, 172, 254, 0.4)',
    iconColor: 'text-blue-100',
  },
  {
    title: 'Bonus Zone',
    icon: Gem,
    href: '/bonuses',
    gradient: 'from-[#43e97b] to-[#38f9d7]',
    shadowColor: 'rgba(67, 233, 123, 0.4)',
    iconColor: 'text-green-100',
  },
  {
    title: 'Refer & Earn',
    icon: Users,
    href: '/dashboard/invite',
    gradient: 'from-[#fa709a] to-[#fee140]',
    shadowColor: 'rgba(250, 112, 154, 0.4)',
    iconColor: 'text-pink-100',
  }
]

export default function QuickLinks() {
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [maintenanceTitle, setMaintenanceTitle] = useState('')

  const handleClick = (e: React.MouseEvent, title: string) => {
    if (MAINTENANCE_KEYS.includes(title)) {
      e.preventDefault()
      setMaintenanceTitle(title)
      setShowMaintenance(true)
    }
  }

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {LINKS.map((link, i) => (
            <Link href={link.href} key={i} onClick={(e) => handleClick(e, link.title)} aria-label={link.title}>
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${link.gradient} p-4 sm:p-5 h-24 sm:h-28 lg:h-32 flex items-center justify-between group transition-shadow cursor-pointer`}
                style={{ boxShadow: `0 8px 24px ${link.shadowColor}` }}
              >
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-white/10 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <h3 className="font-bold text-white text-base sm:text-lg lg:text-xl drop-shadow-md z-10 w-1/2 leading-tight">
                  {link.title}
                </h3>

                <div className="relative z-10 opacity-90 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-300">
                  <link.icon className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 ${link.iconColor} drop-shadow-lg`} strokeWidth={1.5} />
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
    </>
  )
}
