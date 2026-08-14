'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { wheelApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { X, Sparkles } from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface WheelPrize {
  id: string
  index: number
  title: string
  amount: number | null
  percentage: number | null
  type: 'cash' | 'deposit_bonus'
}

interface WheelConfig {
  prizes: WheelPrize[]
  eligible: boolean
  nextSpinAt: string | null
  reason: string
  lastSpinAt: string | null
}

interface WheelModalProps {
  isOpen: boolean
  onClose: () => void
}

/* ─────────────────────────────────────────────
   Design tokens
───────────────────────────────────────────── */
// Alternating segment colours: vivid sapphire blue vs rich royal purple
// with bright, readable inner zones and deep outer edges for a dimensional look
const SEG = [
  { inner: '#2a5fb8', mid: '#1238a0', outer: '#070e2e' },  // Sapphire blue
  { inner: '#7b2dce', mid: '#4a148c', outer: '#1a0535' },  // Royal purple
]

// Special color for Try Again segments
const TRY_AGAIN_SEG = { inner: '#4a4a4a', mid: '#2a2a2a', outer: '#111111' }

const LIT_COUNT = 6
const BULB_TOTAL = 32

/* ─────────────────────────────────────────────
   Cooldown timer
───────────────────────────────────────────── */
function CooldownTimer({ nextSpinAt }: { nextSpinAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = new Date(nextSpinAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Ready!'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [nextSpinAt])

  return (
    <span
      className="font-mono font-black tabular-nums tracking-widest drop-shadow-md"
      style={{ fontSize: 24, color: '#f9ca24' }}
    >
      {timeLeft}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function WheelModal({ isOpen, onClose }: WheelModalProps) {
  /* ── Auth / balance ── */
  const { isAuthenticated, fetchBalance } = useAuthStore()

  /* ── State ── */
  const [config, setConfig] = useState<WheelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winResult, setWinResult] = useState<WheelPrize | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [error, setError] = useState('')
  
  // Lighting & Effects
  const [lightPhase, setLightPhase] = useState(0)
  const [hostessAction, setHostessAction] = useState<'idle' | 'push'>('idle')
  
  const spinLockRef = useRef(false)

  /* ── Marquee light animation ── */
  useEffect(() => {
    const ms = spinning ? 35 : 180
    const id = setInterval(() => setLightPhase(p => (p + 1) % BULB_TOTAL), ms)
    return () => clearInterval(id)
  }, [spinning])

  /* ── Load config ── */
  const loadConfig = useCallback(async () => {
    if (!isAuthenticated || !isOpen) return
    try {
      setLoading(true)
      const res = await wheelApi.getConfig()
      setConfig(res.data.data)
    } catch {
      setError('Failed to load wheel configuration.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isOpen])

  /* ── Reset on open ── */
  useEffect(() => {
    if (isOpen) {
      loadConfig()
      setRotation(0)
      setWinResult(null)
      setShowWin(false)
      setError('')
      setSpinning(false)
      setHostessAction('idle')
      spinLockRef.current = false
    }
  }, [isOpen, loadConfig])

  /* ── Spin handler ── */
  const handleSpin = async () => {
    if (!config?.eligible || spinning || spinLockRef.current) return
    spinLockRef.current = true
    setSpinning(true)
    setError('')
    setShowWin(false)
    
    // Trigger Hostess physical interaction
    setHostessAction('push')

    try {
      const res = await wheelApi.spin()
      const { winningIndex, prize } = res.data.data

      const count = config.prizes.length
      const segDeg = 360 / count
      const targetAngle = winningIndex * segDeg + segDeg / 2

      const currentVisual = rotation % 360
      const needed = (360 - targetAngle) % 360
      const delta = (needed - currentVisual + 360) % 360
      const newRotation = rotation + 360 * 9 + delta // 9 full dramatic heavy spins

      setRotation(newRotation)
      setWinResult(prize)

      // Hostess returns to idle naturally after her forceful push
      setTimeout(() => {
        setHostessAction('idle')
      }, 800)

      // If it's a Try Again, they now have a 48h cooldown just like a win.
      const isTryAgain = prize.title === 'Try Again' || prize.amount === 0

      setTimeout(() => {
        setSpinning(false)
        setShowWin(true)
        if (!isTryAgain) {
          fetchBalance()
        }
        loadConfig() // Reload config to start the 48h cooldown for ALL spins
        spinLockRef.current = false
      }, 8_500) // 8.5 seconds of heavy spinning
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Something went wrong.')
      setSpinning(false)
      setHostessAction('idle')
      spinLockRef.current = false
    }
  }

  if (!isOpen) return null

  /* ── Derived values ── */
  const prizes = config?.prizes ?? Array.from({ length: 14 }, (_, i) => ({
    id: `ph${i}`, index: i, title: i % 2 === 0 ? 'Cash' : 'Bonus',
    amount: 0, percentage: null, type: 'cash' as const,
  }))
  const count = prizes.length || 14
  const segDeg = 360 / count
  const isEligible = config?.eligible === true
  const hasConfig = config !== null

  // Chasing bulbs
  const litSet = new Set(
    Array.from({ length: LIT_COUNT }, (_, k) =>
      (lightPhase + (BULB_TOTAL / LIT_COUNT) * k) % BULB_TOTAL | 0
    )
  )

  /* ──────────────────────────────────────── */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="wheel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-[#000000]"
          onClick={() => { if (!spinning) onClose() }}
        >
          {/* ── Realistic Casino Ambient Background ── */}


          {/* ── Casino Hostess ── */}
          {/* MOBILE: girl fixed on left ~48% width, hand bleeds into wheel area (wheel z-40 > girl z-10) */}
          {/* DESKTOP: restore original — girl fixed left, content padded to clear her */}
          <div
            className="fixed left-0 bottom-0 pointer-events-none z-10"
            style={{
              /* Mobile: take up left ~48% so hand edge overlaps centered wheel */
              width: 'clamp(150px, 48vw, 48vw)',
              height: 'clamp(300px, 88vh, 88vh)',
              mixBlendMode: 'screen',
              filter: 'contrast(1.2) brightness(0.85)',
            }}
          >
            {/* Mobile: object-right-bottom so her right hand is the part closest to the wheel */}
            <Image
              src="/images/casino-host-new.png"
              alt="Casino Hostess"
              fill
              className="object-contain object-right-bottom md:object-bottom"
              priority
            />
          </div>

          {/* DESKTOP override: restore original full-size girl */}
          <div
            className="hidden md:block fixed left-0 bottom-0 pointer-events-none z-10"
            style={{
              width: 'clamp(110px, 32vw, 520px)',
              height: 'clamp(280px, 90vh, 1000px)',
              mixBlendMode: 'screen',
              filter: 'contrast(1.2) brightness(0.85)',
            }}
          >
            <Image
              src="/images/casino-host-new.png"
              alt="Casino Hostess"
              fill
              className="object-contain object-bottom"
              priority
            />
          </div>

          {/* ════════════════════ MAIN UI WRAPPER ════════════════════ */}
          <div
            onClick={e => e.stopPropagation()}
            className="relative z-20 w-full min-h-full flex flex-col items-center justify-start pt-5 pb-6 md:pl-[32vw] lg:pl-[480px]"
          >
            {/* Close button — always top-right */}
            <button
              onClick={() => { if (!spinning) onClose() }}
              disabled={spinning}
              aria-label="Close"
              className="absolute top-4 right-4 md:top-6 md:right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-40 hover:bg-white/10"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <X size={18} />
            </button>

            {/* ── Title ── */}
            <div className="z-50 text-center w-full pointer-events-none shrink-0 mb-4">
              <h1
                className="font-black tracking-[0.25em] uppercase leading-none"
                style={{
                  fontSize: 'clamp(28px, 5vw, 60px)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  background: 'linear-gradient(180deg, #ffffff 0%, #fffae8 30%, #f9ca24 60%, #d35400 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Daily Spin
              </h1>
              <p
                className="uppercase font-bold tracking-[0.4em] mt-2"
                style={{ fontSize: 'clamp(9px, 1.2vw, 13px)', color: 'rgba(255,255,255,0.55)' }}
              >
                Experience the Ultimate Reward Wheel
              </p>
            </div>

            {/* ────── Physical 3D Arena ────── */}
            <div className="relative w-full flex-1 flex items-center justify-center overflow-visible" style={{ perspective: '1500px' }}>




              {/* ── CENTER: 3D Perspective Mounted Wheel ── */}
              {/* This container applies the massive 3D rotation mimicking a real heavy object sitting on a casino floor */}
              <motion.div 
                 className="relative flex flex-col items-center justify-center z-40"
                 style={{ 
                   transformStyle: 'preserve-3d',
                 }}
                 animate={{
                   rotateX: spinning ? [10, 15, 10] : 10,
                   rotateY: spinning ? [-6, -4, -6] : -6,
                 }}
                 transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                
                {/* ════ Gold Pedestal / Base Mount ════ */}
                <div 
                  className="absolute bottom-[-100px] w-[500px] h-[150px] rounded-[50%] pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(249,202,36,0.4) 0%, rgba(20,10,40,0.8) 50%, transparent 80%)',
                    boxShadow: '0 50px 100px rgba(0,0,0,0.9), inset 0 -5px 20px rgba(249,202,36,0.2)',
                    transform: 'translateZ(-100px)',
                    borderBottom: '3px solid rgba(249,202,36,0.1)'
                  }}
                />

                {/* ════ Fixed 3D Heavy Jewel Pointer ════ */}
                <div
                  className="absolute left-1/2 z-[60] pointer-events-none origin-top"
                  style={{
                    top: -15,
                    transform: 'translateX(-50%) translateZ(40px)', // Raised above wheel surface
                    filter: 'drop-shadow(0 15px 20px rgba(0,0,0,0.95)) drop-shadow(0 0 15px rgba(249,202,36,0.6))',
                  }}
                >
                  <motion.svg 
                    width="45" height="55" viewBox="0 0 30 50"
                    animate={spinning ? { rotateZ: [0, -15, 10, -5, 0] } : {}}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: "mirror" }}
                  >
                    <defs>
                      <linearGradient id="ptrFill" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fff" />
                        <stop offset="20%" stopColor="#fff8b0" />
                        <stop offset="50%" stopColor="#f9ca24" />
                        <stop offset="100%" stopColor="#b33939" />
                      </linearGradient>
                      <linearGradient id="ptrHighlight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    {/* Gem Body */}
                    <polygon points="15,50 0,15 8,0 22,0 30,15" fill="url(#ptrFill)" />
                    {/* Metal Bevels */}
                    <polygon points="15,50 0,15 8,0 22,0 30,15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                    <polygon points="15,50 8,0 22,0" fill="url(#ptrHighlight)" opacity="0.4" />
                    <line x1="15" y1="50" x2="15" y2="15" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
                  </motion.svg>
                </div>

                {/* ════ Thick 3D Golden Frame & Wheel Body ════ */}
                <div
                  className="relative rounded-full"
                  style={{
                    /* Mobile: min 200px. Desktop: up to 800px. Uses remaining viewport width via 85vw */
                    width: 'clamp(200px, min(85vw, 60vh), 800px)',
                    aspectRatio: '1 / 1',
                    padding: 'clamp(12px, 3vw, 32px)',
                    /* Master casing gradient for massive 3D depth */
                    background: 'conic-gradient(from 0deg, #3d2204 0%, #f9ca24 15%, #fffae8 25%, #d35400 40%, #1a0800 50%, #d35400 60%, #fffae8 75%, #f9ca24 85%, #3d2204 100%)',
                    boxShadow: [
                      'inset 0 0 0 4px rgba(255,255,255,0.4)',
                      'inset 0 -20px 50px rgba(0,0,0,0.8)',
                      'inset 0 20px 50px rgba(255,255,255,0.5)',
                      '0 40px 100px rgba(0,0,0,0.99)',
                      '0 0 150px rgba(249,202,36,0.2)'
                    ].join(', '),
                    transform: 'translateZ(20px)',
                  }}
                >
                  {/* Outer Frame Edge Grooves */}
                  <div className="absolute inset-0 rounded-full border-[3px] border-black/40 pointer-events-none" style={{ margin: '8px' }}></div>
                  <div className="absolute inset-0 rounded-full border-[2px] border-white/20 pointer-events-none" style={{ margin: '11px' }}></div>

                  {/* ── Marquee Bulbs embedded in the gold frame ── */}
                  <svg
                    viewBox="0 0 100 100"
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    style={{ overflow: 'visible' }}
                  >
                    {Array.from({ length: BULB_TOTAL }).map((_, i) => {
                      const angle = (i / BULB_TOTAL) * 360 - 90
                      const rad = (angle * Math.PI) / 180
                      const r = 45.5 // Position exactly on the thick gold bezel
                      const cx = 50 + r * Math.cos(rad)
                      const cy = 50 + r * Math.sin(rad)
                      const lit = litSet.has(i)
                      return (
                        <g key={i}>
                          {/* Bulb socket (dark inset) */}
                          <circle cx={cx} cy={cy} r="2.2" fill="#221" stroke="rgba(255,255,255,0.2)" strokeWidth="0.2" />
                          {/* Actual light bulb */}
                          <circle
                            cx={cx} cy={cy} r={lit ? 1.9 : 1.5}
                            fill={lit ? '#ffffff' : '#8a5c00'}
                            style={{
                              filter: lit ? 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #f9ca24)' : 'inset 0 0 2px #000',
                              transition: 'all 0.05s ease',
                            }}
                          />
                        </g>
                      )
                    })}
                  </svg>

                  {/* ── The Physical Spinning Disk ── */}
                  <div
                    className="w-full h-full rounded-full overflow-hidden relative"
                    style={{
                      border: '4px solid #000', // separating core from frame
                      boxShadow: 'inset 0 0 60px rgba(0,0,0,0.99), 0 0 20px rgba(0,0,0,0.8)',
                    }}
                  >
                    {/* Real Physical Motion Simulation */}
                    <motion.div
                      className="w-full h-full"
                      animate={{ rotate: rotation }}
                      transition={
                        spinning
                          // Custom physics: slow heavy start, massive acceleration, elastic micro-bounce at the end
                          ? { duration: 8.5, ease: [0.35, -0.05, 0.15, 1.02] }
                          : { duration: 0 }
                      }
                    >
                      <svg viewBox="0 0 200 200" className="w-full h-full block">
                        <defs>
                          {prizes.map((prize, i) => {
                            const isTryAgain = prize.title === 'Try Again'
                            const c = isTryAgain ? TRY_AGAIN_SEG : SEG[i % 2]
                            // Linear gradient from bright near-center to dark outer edge
                            // This gives each segment a vivid inner glow that fades to depth at the rim
                            return (
                              <linearGradient
                                key={i} id={`wsg${i}`}
                                x1="0%" y1="0%" x2="100%" y2="100%"
                              >
                                <stop offset="0%" stopColor={c.inner} stopOpacity="1" />
                                <stop offset="55%" stopColor={c.mid} stopOpacity="1" />
                                <stop offset="100%" stopColor={c.outer} stopOpacity="1" />
                              </linearGradient>
                            )
                          })}
                          {/* Strong multi-layer text shadow for maximum readability */}
                          <filter id="lblShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#000" floodOpacity="1" />
                          </filter>
                          {/* Extra outer glow for the dollar amount */}
                          <filter id="amtGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0  0 0 0 1 0" result="gold" />
                            <feMerge>
                              <feMergeNode in="gold" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {prizes.map((prize, i) => {
                          const sa = (i * segDeg - 90) * (Math.PI / 180)
                          const ea = ((i + 1) * segDeg - 90) * (Math.PI / 180)
                          const cx = 100, cy = 100, r = 100

                          const x1 = cx + r * Math.cos(sa)
                          const y1 = cy + r * Math.sin(sa)
                          const x2 = cx + r * Math.cos(ea)
                          const y2 = cy + r * Math.sin(ea)
                          const la = segDeg > 180 ? 1 : 0

                          const d = `M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 ${la} 1 ${x2} ${y2}Z`

                          // Radial orientation
                          const midA = (sa + ea) / 2
                          const lx = cx + 66 * Math.cos(midA)
                          const ly = cy + 66 * Math.sin(midA)
                          let labelRot = (midA * 180) / Math.PI + 90
                          if (labelRot > 90 && labelRot < 270) labelRot += 180

                          const isTryAgain = prize.title === 'Try Again'
                          let amt = ''
                          let sub = ''
                          let amtColor = '#FFFFFF'
                          let subColor = ''
                          let segGlow = ''

                          if (isTryAgain) {
                            amt = 'TRY'
                            sub = 'AGAIN'
                            subColor = '#ff6b6b' // red
                            segGlow = 'rgba(255,255,255,0.05)'
                          } else {
                            amt = prize.percentage ? `${prize.percentage}%` : `$${prize.amount}`
                            sub = prize.type === 'deposit_bonus' ? 'BONUS' : (prize.title ?? '').includes('Freeplay') ? 'FREE' : 'REWARD'
                            
                            // Per-segment unique accent colors for labels
                            const isBlue = i % 2 === 0
                            subColor = isBlue ? '#f9e24f' : '#a5f3fc'  // gold or cyan
                            segGlow  = isBlue ? 'rgba(41,127,255,0.18)' : 'rgba(139,92,246,0.18)'
                          }

                          return (
                            <g key={prize.id}>
                              {/* Segment Body */}
                              <path d={d} fill={`url(#wsg${i})`} />

                              {/* Subtle inner ambient glow band near outer rim */}
                              <path
                                d={`M${cx + (r-22)*Math.cos(sa)} ${cy + (r-22)*Math.sin(sa)}A${r-22} ${r-22} 0 ${la} 1 ${cx + (r-22)*Math.cos(ea)} ${cy + (r-22)*Math.sin(ea)}`}
                                fill="none" stroke={segGlow} strokeWidth="22"
                              />

                              {/* Premium bright gold separator lines */}
                              <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="rgba(249,202,36,0.85)" strokeWidth="1.5" />
                              {/* Highlight bevel on separator */}
                              <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" transform="translate(0.6,0.6)" />

                              {/* Outer arc bright rim highlight */}
                              <path d={`M${x1} ${y1}A${r} ${r} 0 ${la} 1 ${x2} ${y2}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="4" />

                              {/* Labels — only when config loaded */}
                              {hasConfig && (
                                <g transform={`translate(${lx},${ly}) rotate(${labelRot})`}>
                                  {/* Dollar/percentage amount — large, bold, bright white with gold glow */}
                                  <text
                                    x="0" y="-1"
                                    textAnchor="middle"
                                    fill={amtColor}
                                    fontSize="10"
                                    fontWeight="900"
                                    fontFamily="'Arial Black', Impact, sans-serif"
                                    letterSpacing="0.5"
                                    filter="url(#amtGlow)"
                                  >
                                    {amt}
                                  </text>
                                  {/* Sub-label — color-coded per segment type */}
                                  <text
                                    x="0" y="8.5"
                                    textAnchor="middle"
                                    fill={subColor}
                                    fontSize="5.5"
                                    fontFamily="'Arial Black', sans-serif"
                                    fontWeight="800"
                                    letterSpacing="1.5"
                                    filter="url(#lblShadow)"
                                  >
                                    {sub}
                                  </text>
                                </g>
                              )}
                            </g>
                          )
                        })}

                        {/* Subtle glass convex sheen — lightened so it doesn't darken segments */}
                        <circle cx="100" cy="100" r="100" fill="url(#glassGlow)" pointerEvents="none" />
                        <defs>
                           <radialGradient id="glassGlow" cx="32%" cy="28%" r="55%">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
                              <stop offset="45%" stopColor="rgba(255,255,255,0)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
                           </radialGradient>
                        </defs>
                      </svg>
                    </motion.div>
                  </div>{/* /inner spinning disk */}

                  {/* ════ Massive Raised Center SPIN Button ════ */}
                  {/* Positioned absolutely outside the SVG so it doesn't spin, with huge translateZ for extreme physical pop-out effect */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]"
                    style={{ transform: 'translateZ(40px)' }}
                  >
                    <motion.button
                      onClick={handleSpin}
                      disabled={spinning || !isEligible || !hasConfig}
                      className="relative rounded-full pointer-events-auto flex items-center justify-center group"
                      style={{
                        width: '28%',
                        height: '28%',
                        /* 3D Button construction */
                        background: (spinning || !isEligible)
                          ? 'radial-gradient(circle at 40% 30%, #333, #0a0a0a)'
                          : 'radial-gradient(circle at 40% 30%, #fffbd4 0%, #f9ca24 35%, #e67e22 65%, #8e44ad 150%)',
                        boxShadow: (spinning || !isEligible)
                          ? 'inset 0 10px 20px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.8)'
                          : 'inset 0 -10px 20px rgba(0,0,0,0.5), inset 0 8px 20px rgba(255,255,255,0.8), 0 15px 30px rgba(0,0,0,0.9), 0 0 50px rgba(249,202,36,0.6)',
                        border: '5px solid #111',
                        cursor: (spinning || !isEligible || !hasConfig) ? 'not-allowed' : 'pointer',
                      }}
                      animate={
                        isEligible && !spinning
                          ? { scale: [1, 1.04, 1], filter: ['brightness(1)', 'brightness(1.1)', 'brightness(1)'] }
                          : { scale: spinning ? 0.95 : 1 }
                      }
                      whileTap={isEligible && !spinning ? { scale: 0.9, filter: 'brightness(0.8)' } : {}}
                      transition={
                        isEligible && !spinning
                          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                          : { duration: 0.2 }
                      }
                    >
                      {/* Button Rim Bevel */}
                      <div className="absolute inset-0 rounded-full border-2 border-white/40 m-1 pointer-events-none mix-blend-overlay"></div>
                      
                      <span
                        className="relative z-10 select-none font-black uppercase leading-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                        style={{
                          fontFamily: 'Arial Black, Arial, sans-serif',
                          fontSize: 'clamp(14px, 3.5vw, 24px)',
                          letterSpacing: '0.15em',
                          color: (spinning || !isEligible) ? '#555' : '#ffffff',
                        }}
                      >
                        {spinning ? 'Wait' : 'SPIN'}
                      </span>
                    </motion.button>
                  </div>
                </div>{/* /gold frame */}
              </motion.div>
            </div>{/* /3d arena */}

            {/* ────── Info Panel (Below Wheel) ────── */}
            <div className="relative z-50 w-full max-w-[720px] shrink-0 px-4 mt-3 mb-4">
              {/* Error */}
              {error && (
                <div className="w-full text-center py-2 px-6 rounded-xl text-[13px] font-bold bg-red-900/60 border border-red-500/40 text-red-200 mb-3">
                  {error}
                </div>
              )}

              {!hasConfig ? (
                <div className="w-full flex items-center justify-center py-4">
                  <span className="text-sm uppercase tracking-[0.3em] font-bold text-yellow-400 animate-pulse">Preparing Game...</span>
                </div>
              ) : (
                <div
                  className="w-full rounded-2xl px-5 py-4"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {isEligible ? (
                    // Eligible: show checklist + CTA in a horizontal row
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex flex-col gap-2 flex-1">
                        {/* Check row: haven't spun */}
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background:'rgba(34,197,94,0.15)', border:'1.5px solid #22c55e', color:'#22c55e' }}>✓</div>
                          <p className="text-[13px] leading-snug" style={{ color:'rgba(255,255,255,0.75)' }}>You haven't spun the wheel in the last 48 hours</p>
                        </div>
                        {/* Check row: spin available */}
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background:'rgba(34,197,94,0.15)', border:'1.5px solid #22c55e', color:'#22c55e' }}>✓</div>
                          <p className="text-[13px] leading-snug" style={{ color:'rgba(255,255,255,0.75)' }}>Your free spin reward is available!</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-center">
                        <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Status</p>
                        <span className="inline-block px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide" style={{ background: 'linear-gradient(90deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 0 16px rgba(34,197,94,0.35)' }}>
                          ✓ Ready to Spin!
                        </span>
                        <p className="text-white/30 text-xs mt-1">Tap SPIN to play now</p>
                      </div>
                    </div>
                  ) : (
                    // Not eligible: show checklist + timer
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex flex-col gap-2 flex-1">
                        {/* Check row: already spun */}
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background:'rgba(239,68,68,0.15)', border:'1.5px solid #ef4444', color:'#ef4444' }}>✕</div>
                          <p className="text-[13px] leading-snug" style={{ color:'rgba(255,255,255,0.75)' }}>{config?.reason || 'You are not eligible to spin right now'}</p>
                        </div>
                        {/* Check row: come back */}
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background:'rgba(34,197,94,0.15)', border:'1.5px solid #22c55e', color:'#22c55e' }}>✓</div>
                          <p className="text-[13px] leading-snug" style={{ color:'rgba(255,255,255,0.75)' }}>Come back in 48 hours for your next free spin</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-center">
                        <p className="uppercase font-black tracking-[0.2em] mb-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Next Free Spin In</p>
                        {config?.nextSpinAt
                          ? <CooldownTimer nextSpinAt={config.nextSpinAt} />
                          : <span className="text-white/30 text-2xl">—</span>
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>{/* /main wrapper */}

          {/* ══════════════ EPIC WIN OVERLAY ══════════════ */}
          <AnimatePresence>
            {showWin && winResult && (
              <motion.div
                key="win-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 z-[120] flex items-center justify-center p-4"
                style={{
                  backdropFilter: 'blur(25px)',
                  background: 'radial-gradient(circle at center, rgba(30,10,60,0.85) 0%, rgba(0,0,0,0.95) 100%)',
                }}
              >
                {/* Advanced Confetti */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {winResult.title !== 'Try Again' && Array.from({ length: 45 }).map((_, i) => {
                    const colors = ['#f9ca24', '#ff4e50', '#a78bfa', '#00f2fe', '#fff']
                    return (
                      <motion.div
                        key={i}
                        className="absolute"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: '-5%',
                          width: Math.random() * 10 + 5,
                          height: Math.random() * 10 + 5,
                          background: colors[i % colors.length],
                          boxShadow: `0 0 10px ${colors[i % colors.length]}`,
                          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        }}
                        animate={{
                          y: ['0vh', '110vh'],
                          x: [0, (Math.random() - 0.5) * 200],
                          rotate: [0, Math.random() * 720],
                        }}
                        transition={{
                          duration: Math.random() * 3 + 2,
                          delay: Math.random() * 0.5,
                          ease: "easeIn",
                        }}
                      />
                    )
                  })}
                </div>

                {/* Heavy 3D Prize Box */}
                <motion.div
                  initial={{ scale: 0.5, y: 100, rotateX: 45 }}
                  animate={{ scale: 1, y: 0, rotateX: 0 }}
                  transition={{ type: "spring", damping: 15, mass: 1.2, stiffness: 200 }}
                  className="relative z-10 w-full max-w-[550px] p-10 md:p-14 text-center rounded-[3rem]"
                  style={{
                    background: 'linear-gradient(135deg, #1f0b3e 0%, #0a0314 100%)',
                    border: '4px solid #f9ca24',
                    boxShadow: '0 30px 100px rgba(0,0,0,0.99), 0 0 80px rgba(249,202,36,0.5), inset 0 0 50px rgba(249,202,36,0.1)',
                  }}
                >
                  {winResult.title === 'Try Again' ? (
                    <>
                      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#a0a0a0] rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

                      <h3 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#e0e0e0] to-[#808080] mb-4 uppercase tracking-[0.2em] drop-shadow-[0_5px_10px_rgba(0,0,0,0.9)]"
                          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}>
                        OOF!
                      </h3>
                      
                      <div className="my-8 py-10 px-6 rounded-3xl bg-black/80 border border-white/10 shadow-[inset_0_10px_30px_rgba(0,0,0,0.9),0_10px_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
                        <div className="text-5xl md:text-6xl font-black text-white/50 tracking-tighter drop-shadow-md">
                          TRY AGAIN
                        </div>
                      </div>
                      
                      <p className="text-white/60 text-sm md:text-base font-medium mb-10 px-4 leading-relaxed">
                        So close! Don't worry, you'll have better luck next time. Come back in 48 hours for your next free spin!
                      </p>
                      
                      <button
                        onClick={() => setShowWin(false)}
                        className="w-full py-5 rounded-full font-black text-xl uppercase tracking-[0.2em] text-white hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_rgba(0,0,0,0.6)]"
                        style={{
                          background: 'linear-gradient(to bottom, #4a4a4a, #2a2a2a)',
                          border: '2px solid #6a6a6a'
                        }}
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#f9ca24] rounded-full blur-[80px] opacity-40 mix-blend-screen pointer-events-none"></div>

                      <h3 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#ffeaa7] via-[#f9ca24] to-[#d35400] mb-4 uppercase tracking-[0.2em] drop-shadow-[0_5px_10px_rgba(0,0,0,0.9)]"
                          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                        WINNER!
                      </h3>
                      
                      <div className="my-8 py-10 px-6 rounded-3xl bg-black/80 border border-[#f9ca24]/30 shadow-[inset_0_10px_30px_rgba(0,0,0,0.9),0_10px_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                        <div className="text-7xl md:text-8xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
                             style={{ textShadow: '0 0 30px rgba(255,255,255,0.4)' }}>
                          {winResult.percentage ? `${winResult.percentage}%` : `$${winResult.amount}`}
                        </div>
                        <div className="text-[#f9ca24] font-black uppercase tracking-[0.3em] text-sm md:text-lg">
                          {winResult.type === 'deposit_bonus' ? 'Deposit Bonus' : winResult.title.includes('Freeplay') ? 'Freeplay Credit' : 'Real Cash'}
                        </div>
                      </div>
                      
                      <p className="text-purple-200/80 text-sm md:text-base font-medium mb-10 px-4 leading-relaxed">
                        {winResult.type === 'deposit_bonus' 
                          ? 'Incredible! Your massive bonus is locked in for your next deposit.' 
                          : 'Congratulations! Your real reward has been instantly deposited into your wallet.'}
                      </p>
                      
                      <button
                        onClick={onClose} // Close entirely so they see wallet
                        className="w-full py-5 rounded-full font-black text-xl uppercase tracking-[0.2em] text-white hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_40px_rgba(249,202,36,0.6)]"
                        style={{
                          background: 'linear-gradient(to bottom, #f9ca24, #d35400)',
                          border: '2px solid #ffeaa7'
                        }}
                      >
                        Collect Prize
                      </button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}