'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gift, Zap, Star, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface SignupRewardPopupProps {
  isOpen: boolean
  onClose: () => void
}

function FloatingParticle({ delay, x, size, color }: { delay: number; x: number; size: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, bottom: 0, width: size, height: size, background: color }}
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: -320, opacity: [1, 1, 0], rotate: 360 }}
      transition={{ duration: 2.2 + Math.random(), delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.5 + Math.random() * 2 }}
    />
  )
}

const PARTICLES = [
  { delay: 0, x: 10, size: 8, color: '#00D4FF' },
  { delay: 0.2, x: 25, size: 6, color: '#FFD700' },
  { delay: 0.4, x: 45, size: 10, color: '#FF2D9B' },
  { delay: 0.1, x: 60, size: 7, color: '#00FFC8' },
  { delay: 0.6, x: 75, size: 5, color: '#7B2FFF' },
  { delay: 0.3, x: 88, size: 9, color: '#FFD700' },
  { delay: 0.8, x: 33, size: 6, color: '#FF6B35' },
  { delay: 0.5, x: 55, size: 8, color: '#00D4FF' },
]

export default function WelcomeBonusPopup({ isOpen, onClose }: SignupRewardPopupProps) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => setPulse(p => !p), 2400)
    return () => clearInterval(interval)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="reward-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            key="reward-card"
            initial={{ scale: 0.82, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
            className="relative w-full max-w-md overflow-hidden"
            style={{
              borderRadius: '28px',
              background: 'linear-gradient(160deg, #0d1117 0%, #0f1622 50%, #100c1f 100%)',
              border: '1px solid rgba(123,47,255,0.3)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(123,47,255,0.18), 0 30px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Animated gradient top border */}
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, #7B2FFF, #00D4FF, #FF2D9B, #FFD700, #7B2FFF)', backgroundSize: '300% 100%' }}
            />

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {PARTICLES.map((p, i) => <FloatingParticle key={i} {...p} />)}
            </div>

            {/* Radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 -translate-y-1/2 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(123,47,255,0.22) 0%, transparent 70%)' }}
            />

            {/* Close button */}
            <button onClick={onClose}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              aria-label="Close reward popup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 px-8 pt-10 pb-8 text-center">
              {/* Badge */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold tracking-widest uppercase"
                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700' }}
              >
                <Sparkles className="w-3 h-3" />
                Welcome Reward Unlocked
                <Sparkles className="w-3 h-3" />
              </motion.div>

              {/* 100% */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="mb-2"
              >
                <div className="relative inline-block">
                  <motion.div
                    animate={{ scale: pulse ? 1.15 : 1, opacity: pulse ? 0.5 : 0.2 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #7B2FFF 0%, transparent 70%)', filter: 'blur(12px)' }}
                  />
                  <span
                    className="font-display font-black leading-none select-none"
                    style={{
                      fontSize: 'clamp(80px, 22vw, 116px)',
                      background: 'linear-gradient(135deg, #7B2FFF 0%, #00D4FF 40%, #FF2D9B 70%, #FFD700 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 0 40px rgba(123,47,255,0.6))',
                    }}
                  >
                    100%
                  </span>
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-display font-bold text-xl text-white mb-1"
              >
                SIGNUP BONUS
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-sm mb-7"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                On your first deposit — instantly credited to your game balance
              </motion.p>

              {/* Feature highlights */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
                className="flex items-center justify-center gap-5 mb-7"
              >
                {[
                  { icon: Zap, label: 'Instant Credit', color: '#00D4FF' },
                  { icon: Gift, label: 'No Wagering', color: '#00FFC8' },
                  { icon: Star, label: 'New Users Only', color: '#FFD700' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative overflow-hidden rounded-2xl"
              >
                <Link
                  href="/verify"
                  onClick={onClose}
                  id="signup-reward-cta"
                  className="group relative w-full flex items-center justify-center gap-2.5 py-4 px-6 font-bold text-sm text-white overflow-hidden transition-all active:scale-[0.98] hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, #7B2FFF 0%, #00D4FF 100%)',
                    boxShadow: '0 8px 32px rgba(123,47,255,0.45), 0 2px 8px rgba(0,0,0,0.3)',
                    borderRadius: '16px',
                    display: 'flex',
                  }}
                >
                  {/* Shine sweep animation */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.22) 50%, transparent 80%)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: 'linear' }}
                  />
                  <span className="relative font-black tracking-wide text-white">VERIFY ACCOUNT TO CLAIM</span>
                  <ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </Link>
              </motion.div>

              {/* Terms */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-4 text-[11px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Bonus applied automatically on first deposit. See{' '}
                <Link href="/bonuses" onClick={onClose} className="underline underline-offset-2 hover:opacity-60 transition-opacity">
                  Bonus Terms
                </Link>
                {' '}for eligibility and conditions.
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
