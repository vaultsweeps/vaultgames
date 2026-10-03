'use client'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Home, Gift, Users } from 'lucide-react'

const ExpandableContactFab = dynamic(() => import('@/components/ui/ExpandableContactFab'), { ssr: false })

// Fixed-size slots (40px + 2px gap) so the active indicator can glide by index.
const BOTTOM_NAV_ITEMS = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/games', label: 'Games', match: (p: string) => p.startsWith('/games') },
  { href: '/bonuses', label: 'Bonuses', match: (p: string) => p.startsWith('/bonuses') },
  { href: '/dashboard/invite', label: 'Refer & Earn', match: (p: string) => p.startsWith('/dashboard/invite') },
] as const
const BOTTOM_SLOT = 42

/**
 * Floating mobile navigation bar. Used by the public site (menu button opens the site drawer) and by
 * every dashboard page (menu button opens the dashboard drawer). Hidden from 1024px up.
 */
export default function MobileBottomBar({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  const pathname = usePathname()
  const activeNavIdx = BOTTOM_NAV_ITEMS.findIndex(item => item.match(pathname))

  return (
    <div
      className="mobile-nav-stable lg:hidden fixed bottom-4 left-1/2 z-50 flex justify-center items-center gap-2 pointer-events-none"
      style={{
        transform: 'translate3d(-50%, 0, 0)',
        willChange: 'transform',
      }}
    >

      {/* Main Nav Pill — slim, flat icons, gliding active indicator */}
      <div
        className="relative rounded-full px-1.5 py-1 flex items-center gap-0.5 pointer-events-auto"
        style={{
          background: 'linear-gradient(160deg, #0c0d22 0%, #080918 100%)',
          border: '1px solid rgba(80,100,220,0.28)',
          boxShadow: '0 8px 28px rgba(0,0,30,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
          contain: 'layout style'
        }}
      >
        {/* Sliding active indicator (transform-only, so it never triggers layout) */}
        <motion.span
          aria-hidden
          className="absolute left-1.5 top-1 w-10 h-10 rounded-full pointer-events-none"
          initial={false}
          animate={{ x: Math.max(activeNavIdx, 0) * BOTTOM_SLOT, opacity: activeNavIdx >= 0 ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.6 }}
          style={{
            background: 'linear-gradient(145deg, rgba(99,102,241,0.34), rgba(59,130,246,0.18))',
            boxShadow: 'inset 0 0 0 1px rgba(130,150,255,0.35), 0 0 14px rgba(99,102,241,0.35)',
            willChange: 'transform',
          }}
        />

        {BOTTOM_NAV_ITEMS.map((item, i) => {
          const active = i === activeNavIdx
          return (
            <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined}
              className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full active:scale-95"
            >
              <motion.span
                className="flex items-center justify-center"
                initial={false}
                animate={{ scale: active ? 1.12 : 1, opacity: active ? 1 : 0.6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {i === 0 && <Home className="w-[20px] h-[20px]" strokeWidth={2.2} style={{ color: '#d6e2ff', filter: active ? 'drop-shadow(0 0 5px rgba(140,180,255,0.8))' : undefined }} />}
                {i === 1 && (
                  <span className="w-[26px] h-[26px] rounded-full overflow-hidden flex items-center justify-center" style={{ filter: 'brightness(1.25) saturate(1.15)' }}>
                    <Image src="/images/vault-sweeps-logo.png" alt="Games" width={26} height={26} className="w-full h-full object-cover" />
                  </span>
                )}
                {i === 2 && <Gift className="w-[20px] h-[20px]" strokeWidth={2.2} style={{ color: '#ffb347', filter: active ? 'drop-shadow(0 0 5px rgba(255,140,0,0.8))' : undefined }} />}
                {i === 3 && <Users className="w-[20px] h-[20px]" strokeWidth={2.2} style={{ color: '#d6e2ff', filter: active ? 'drop-shadow(0 0 5px rgba(140,180,255,0.8))' : undefined }} />}
              </motion.span>
            </Link>
          )
        })}

        {/* Contact FAB inside pill */}
        <div className="relative z-10 w-10 h-10 flex items-center justify-center">
          <ExpandableContactFab inlinePill />
        </div>

      </div>

      {/* Menu Toggle Button */}
      <button
        onClick={onToggleMenu}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className="w-[52px] h-[52px] rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] flex items-center justify-center text-white shadow-lg pointer-events-auto active:scale-95"
        style={{ transition: 'background-color 0.2s ease, transform 0.1s ease' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {menuOpen
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-[21px] h-[21px]" /></motion.span>
            : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-[21px] h-[21px]" /></motion.span>
          }
        </AnimatePresence>
      </button>
    </div>
  )
}
