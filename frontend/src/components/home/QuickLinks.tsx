'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, RotateCw, Gem, Users, Wrench, X, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useShallow } from 'zustand/react/shallow'
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
  border: string
  accent: string
  image: string
  gradientId: string
}

const LINKS: QuickLink[] = [
  {
    title: 'VIP Club',
    subtitle: 'Exclusive perks',
    icon: Crown,
    href: '/vip',
    gradient: 'linear-gradient(145deg, #0f172a 0%, #1d4ed8 50%, #8b5cf6 100%)',
    glow: 'rgba(59, 130, 246, 0.4)',
    border: 'rgba(59, 130, 246, 0.3)',
    accent: '#8b5cf6',
    image: '/images/3d_crown.jpg',
    gradientId: 'gold-3d',
  },
  {
    title: 'Daily Spin',
    subtitle: 'Free daily prize',
    icon: RotateCw,
    href: '#',
    action: 'modal',
    gradient: 'linear-gradient(145deg, #431407 0%, #c2410c 50%, #facc15 100%)',
    glow: 'rgba(245, 158, 11, 0.4)',
    border: 'rgba(245, 158, 11, 0.3)',
    accent: '#facc15',
    image: '/images/3d_wheel.jpg',
    gradientId: 'amber-3d',
  },
  {
    title: 'Bonus Zone',
    subtitle: 'Live promotions',
    icon: Gem,
    href: '/bonuses',
    gradient: 'linear-gradient(145deg, #2e1065 0%, #6d28d9 50%, #ec4899 100%)',
    glow: 'rgba(168, 85, 247, 0.4)',
    border: 'rgba(168, 85, 247, 0.3)',
    accent: '#ec4899',
    image: '/images/3d_gift.jpg',
    gradientId: 'amethyst-3d',
  },
  {
    title: 'Refer & Earn',
    subtitle: 'Earn up to $10',
    icon: Users,
    href: '/dashboard/invite',
    gradient: 'linear-gradient(145deg, #022c22 0%, #059669 50%, #22d3ee 100%)',
    glow: 'rgba(16, 185, 129, 0.4)',
    border: 'rgba(16, 185, 129, 0.3)',
    accent: '#22d3ee',
    image: '/images/3d_people.jpg',
    gradientId: 'emerald-3d',
  }
]

export default function QuickLinks() {
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [maintenanceTitle, setMaintenanceTitle] = useState('')
  const [showWheelModal, setShowWheelModal] = useState(false)
  const { isAuthenticated, openAuthModal } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      openAuthModal: state.openAuthModal
    }))
  )

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
      {/* 3D SVG Materials definition */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <linearGradient id="gold-3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="75%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          
          <linearGradient id="amber-3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#9a3412" />
            <stop offset="75%" stopColor="#fdba74" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>

          <linearGradient id="amethyst-3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e8ff" />
            <stop offset="25%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#5b21b6" />
            <stop offset="75%" stopColor="#d8b4fe" />
            <stop offset="100%" stopColor="#3b0764" />
          </linearGradient>

          <linearGradient id="emerald-3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d1fae5" />
            <stop offset="25%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="75%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>
        </defs>
      </svg>

      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {LINKS.map((link, i) => (
            <Link href={link.href} key={i} onClick={(e) => handleClick(e, link)} aria-label={`${link.title} — ${link.subtitle}`}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -3, filter: 'brightness(1.15)' }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 h-28 sm:h-32 lg:h-36 flex flex-col justify-between cursor-pointer border border-transparent transition-all duration-300"
                style={{ 
                  background: link.gradient, 
                  boxShadow: `0 8px 24px -8px ${link.glow}, inset 0 1px 1px 0 rgba(255,255,255,0.2)`,
                  borderColor: link.border 
                }}
              >
                {/* Radial background glow/lighting */}
                <div 
                  aria-hidden 
                  className="absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-70"
                  style={{ background: `radial-gradient(100% 100% at 100% 0%, ${link.accent}40 0%, transparent 60%)` }} 
                />

                {/* Subtle bottom-left lighting */}
                <div 
                  aria-hidden 
                  className="absolute inset-0 opacity-20"
                  style={{ background: `radial-gradient(100% 100% at 0% 100%, #ffffff20 0%, transparent 50%)` }} 
                />

                {/* Hover sheen sweep */}
                <div
                  aria-hidden
                  className="absolute inset-0 -translate-x-[120%] group-hover:translate-x-[120%] transition-transform duration-700 ease-out z-0"
                  style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.15) 50%, transparent 58%)' }}
                />

                {/* 3D Decorative Image */}
                <div 
                  className="absolute -right-4 top-1/2 -translate-y-1/2 w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 opacity-90 group-hover:scale-110 group-hover:-rotate-3 group-hover:opacity-100 transition-all duration-700 ease-out pointer-events-none z-0"
                  style={{ 
                    mixBlendMode: 'screen',
                    WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 40%, transparent 70%)',
                    maskImage: 'radial-gradient(circle at 50% 50%, black 40%, transparent 70%)'
                  }}
                >
                  <img src={link.image} alt="" className="w-full h-full object-contain opacity-90 drop-shadow-2xl" />
                </div>

                <div className="relative z-10 flex items-start justify-between">
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 z-10 group">
                    {/* Deep Ambient Occlusion - Solid drop shadow instead of blurred multiply */}
                    <link.icon className="absolute top-2 left-1 w-full h-full opacity-40" strokeWidth={3} stroke="#000" style={{ filter: 'blur(2px)' }} />

                    {/* Extrusion Base (3D Thickness/Volume) */}
                    <link.icon className="absolute top-[3px] left-[1.5px] w-full h-full" strokeWidth={2.5} stroke="#000" opacity={0.6} />
                    <link.icon className="absolute top-[2px] left-[1px] w-full h-full" strokeWidth={2.5} stroke="#000" opacity={0.4} />
                    <link.icon className="absolute top-[1px] left-[0.5px] w-full h-full" strokeWidth={2.5} stroke="#000" opacity={0.2} />

                    {/* Main Metallic/Plastic Face */}
                    <link.icon className="absolute inset-0 w-full h-full" strokeWidth={2.5} stroke={`url(#${link.gradientId})`} />

                    {/* Specular Highlight / Bevel (Rim lighting) */}
                    <link.icon className="absolute -top-[1px] -left-[1px] w-full h-full opacity-90" strokeWidth={1} stroke="#ffffff" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-1 group-hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.4)] transition-all duration-300" />
                </div>

                <div className="relative z-10">
                  <h3 className="font-display font-bold text-white text-sm sm:text-base leading-tight tracking-wide drop-shadow-md">
                    {link.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/80 mt-0.5 leading-tight drop-shadow-sm font-medium">
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
