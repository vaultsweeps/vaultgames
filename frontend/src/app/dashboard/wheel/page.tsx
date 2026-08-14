'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { wheelApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Color palette for segments ──────────────────────────────────────────────
const SEGMENT_COLORS = [
  { bg: '#1a3a8f', highlight: '#2455cc', text: '#ffffff', label: 'CASH' },
  { bg: '#1254b4', highlight: '#1a75e8', text: '#ffffff', label: 'FREEPLAY' },
  { bg: '#0d2d7a', highlight: '#1a4ab8', text: '#ffffff', label: 'DEPOSIT' },
  { bg: '#163a9c', highlight: '#2050d0', text: '#ffffff', label: 'CASH' },
  { bg: '#0f337d', highlight: '#1848b5', text: '#ffffff', label: 'FREEPLAY' },
  { bg: '#112d87', highlight: '#1c44c2', text: '#ffffff', label: 'DEPOSIT' },
  { bg: '#143590', highlight: '#1e50d4', text: '#ffffff', label: 'CASH' },
  { bg: '#0e3082', highlight: '#174ac0', text: '#ffffff', label: 'FREEPLAY' },
]

// ─── Cooldown Timer Component ─────────────────────────────────────────────────
function CooldownTimer({ nextSpinAt }: { nextSpinAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(nextSpinAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Ready!'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [nextSpinAt])
  return <span className="font-mono text-neon-blue font-bold">{timeLeft}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WheelPage() {
  const { isAuthenticated, fetchBalance } = useAuthStore()
  const [config, setConfig] = useState<WheelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winResult, setWinResult] = useState<WheelPrize | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [error, setError] = useState('')
  const [lightPhase, setLightPhase] = useState(0)
  const wheelRef = useRef<HTMLDivElement>(null)
  const spinLockRef = useRef(false)

  // Animate lights
  useEffect(() => {
    const id = setInterval(() => setLightPhase(p => (p + 1) % 12), spinning ? 80 : 200)
    return () => clearInterval(id)
  }, [spinning])

  // Load wheel config
  const loadConfig = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      setLoading(true)
      const res = await wheelApi.getConfig()
      setConfig(res.data.data)
    } catch (e: any) {
      setError('Failed to load wheel configuration.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSpin = async () => {
    if (!config?.eligible || spinning || spinLockRef.current) return
    spinLockRef.current = true
    setSpinning(true)
    setError('')
    setShowWin(false)

    try {
      const res = await wheelApi.spin()
      const { winningIndex, prize } = res.data.data
      const prizes = config.prizes
      const count = prizes.length

      // Degrees per segment
      const segmentDeg = 360 / count
      // The pointer is at the top (0°/360°). We want the CENTER of the winning segment under the pointer.
      // Segment i occupies from i*segmentDeg to (i+1)*segmentDeg measured clockwise from the top.
      // To put segment center at top: we need to rotate the wheel so that segment i is at top.
      // Center of segment i = i * segmentDeg + segmentDeg/2
      // We want (centerOfSegment - totalRotation) mod 360 = 0
      // So totalRotation = centerOfSegment + N*360 (multiple full rotations for effect)
      const targetAngle = winningIndex * segmentDeg + segmentDeg / 2

      // 5 full spins + land on target
      const totalSpin = 360 * 5 + ((360 - targetAngle) % 360)
      const newRotation = rotation + totalSpin

      setRotation(newRotation)
      setWinResult(prize)

      // Show win modal after animation completes (~5s)
      setTimeout(() => {
        setSpinning(false)
        setShowWin(true)
        fetchBalance()
        loadConfig()
        spinLockRef.current = false
      }, 5500)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Something went wrong. Please try again.')
      setSpinning(false)
      spinLockRef.current = false
    }
  }

  const prizes = config?.prizes || []
  const count = prizes.length || 14
  const segmentDeg = 360 / count

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050d1f] via-[#0a1535] to-[#061028] relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display font-black text-5xl md:text-7xl text-white tracking-widest mb-2"
            style={{ textShadow: '0 0 40px rgba(79,172,254,0.6), 0 0 80px rgba(79,172,254,0.3)' }}>
            WHEEL
          </h1>
          <p className="text-blue-200/70 text-sm md:text-base">Get prizes every day in the win-win lottery wheel of luck!</p>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12">

          {/* Left: Eligibility + Presenter (on desktop) */}
          <div className="flex flex-col items-center lg:items-start gap-4 lg:w-80 order-2 lg:order-1">
            {/* Presenter Image */}
            <div className="relative hidden lg:block">
              <Image
                src="/images/casino-presenter.png"
                alt="Casino Host"
                width={280}
                height={420}
                className="object-contain drop-shadow-2xl"
                style={{ filter: 'drop-shadow(0 0 30px rgba(79,172,254,0.3))' }}
                priority
              />
            </div>

            {/* Eligibility Cards */}
            {config && (
              <div className="space-y-3 w-full max-w-sm">
                <div className="bg-[#0d1f4d]/80 border border-blue-500/20 rounded-xl p-4 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.eligible ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-orange-500/20 border border-orange-500/30'}`}>
                      <span className="text-sm">{config.eligible ? '✓' : '○'}</span>
                    </div>
                    <div>
                      {config.eligible ? (
                        <p className="text-sm text-blue-100">
                          <span className="text-emerald-400 font-bold">You haven&apos;t spun the wheel for 24 hours.</span>
                          <br /><span className="text-blue-200/60 text-xs">You are eligible to spin!</span>
                        </p>
                      ) : (
                        <p className="text-sm text-blue-100">
                          <span className="text-orange-300 font-bold">Already spun today.</span>
                          <br />
                          <span className="text-blue-200/60 text-xs">Next spin in: </span>
                          {config.nextSpinAt && <CooldownTimer nextSpinAt={config.nextSpinAt} />}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Center: The Wheel */}
          <div className="relative order-1 lg:order-2 flex flex-col items-center">
            {/* Mobile presenter (shown above wheel on mobile) */}
            <div className="relative lg:hidden mb-4">
              <Image
                src="/images/casino-presenter.png"
                alt="Casino Host"
                width={120}
                height={180}
                className="object-contain drop-shadow-xl"
                style={{ filter: 'drop-shadow(0 0 20px rgba(79,172,254,0.3))' }}
              />
            </div>

            {/* Pointer */}
            <div className="relative z-20 mb-[-10px]" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
              <svg width="40" height="32" viewBox="0 0 40 32">
                <defs>
                  <linearGradient id="ptGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#64ffda" />
                    <stop offset="100%" stopColor="#1a8f6f" />
                  </linearGradient>
                </defs>
                <polygon points="20,32 0,0 40,0" fill="url(#ptGrad)" />
                <polygon points="20,32 0,0 40,0" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
              </svg>
            </div>

            {/* Wheel Outer Ring */}
            <div className="relative"
              style={{
                width: 'min(90vw, 360px)',
                height: 'min(90vw, 360px)',
              }}
            >
              {/* Glow ring */}
              <div className="absolute inset-[-8px] rounded-full pointer-events-none z-0"
                style={{
                  background: spinning
                    ? 'conic-gradient(from 0deg, #4facfe, #00f2fe, #4facfe, #00f2fe, #4facfe)'
                    : 'conic-gradient(from 0deg, #1a4a9e, #2060cc, #1a4a9e, #2060cc, #1a4a9e)',
                  filter: spinning ? 'blur(8px) brightness(1.5)' : 'blur(6px)',
                  opacity: 0.6,
                  transition: 'all 0.3s ease',
                }}
              />

              {/* Decorative lights around circumference */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 360) / 24 - 90
                const rad = angle * (Math.PI / 180)
                const r = 50 // percentage from center
                const x = 50 + r * Math.cos(rad)
                const y = 50 + r * Math.sin(rad)
                const isLit = (i % 12) === (lightPhase % 12) || (i % 12) === ((lightPhase + 6) % 12)
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-full z-10 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      background: isLit ? '#ffd700' : '#8a6800',
                      boxShadow: isLit ? '0 0 8px 3px rgba(255,215,0,0.7)' : 'none',
                    }}
                  />
                )
              })}

              {/* Spinning wheel */}
              <motion.div
                ref={wheelRef}
                className="absolute inset-[16px] rounded-full overflow-hidden"
                style={{
                  rotate: rotation,
                  transition: spinning
                    ? `transform 5s cubic-bezier(0.17, 0.67, 0.25, 1.0)`
                    : 'none',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 20px rgba(0,50,150,0.4)',
                }}
                animate={{ rotate: rotation }}
                transition={spinning ? { duration: 5, ease: [0.17, 0.67, 0.25, 1.0] } : { duration: 0 }}
              >
                {/* SVG Wheel segments */}
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <defs>
                    {prizes.map((_, i) => (
                      <linearGradient key={i} id={`seg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={SEGMENT_COLORS[i % SEGMENT_COLORS.length].highlight} />
                        <stop offset="100%" stopColor={SEGMENT_COLORS[i % SEGMENT_COLORS.length].bg} />
                      </linearGradient>
                    ))}
                    <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#1a3a8f" />
                      <stop offset="100%" stopColor="#0d1f5a" />
                    </radialGradient>
                    <filter id="innerShadow">
                      <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="rgba(0,0,0,0.8)" />
                    </filter>
                  </defs>

                  {prizes.map((prize, i) => {
                    const startAngle = (i * segmentDeg - 90) * (Math.PI / 180)
                    const endAngle = ((i + 1) * segmentDeg - 90) * (Math.PI / 180)
                    const cx = 100, cy = 100, r = 100

                    const x1 = cx + r * Math.cos(startAngle)
                    const y1 = cy + r * Math.sin(startAngle)
                    const x2 = cx + r * Math.cos(endAngle)
                    const y2 = cy + r * Math.sin(endAngle)

                    const largeArc = segmentDeg > 180 ? 1 : 0
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

                    // Label position (midpoint of arc)
                    const midAngle = (startAngle + endAngle) / 2
                    const labelR = 68
                    const lx = cx + labelR * Math.cos(midAngle)
                    const ly = cy + labelR * Math.sin(midAngle)
                    const labelRotation = (i * segmentDeg + segmentDeg / 2 - 90)

                    // Line separator between segments
                    const sepX = cx + r * Math.cos(startAngle)
                    const sepY = cy + r * Math.sin(startAngle)

                    const displayLabel = prize.percentage
                      ? `${prize.percentage}%`
                      : `$${prize.amount}`
                    const subLabel = prize.type === 'deposit_bonus' ? 'DEPOSIT' : prize.title.includes('Freeplay') ? 'FREEPLAY' : 'CASH'

                    return (
                      <g key={prize.id}>
                        <path d={d} fill={`url(#seg${i})`} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                        {/* Bevel highlight at outer edge */}
                        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                        {/* Text labels */}
                        <g transform={`translate(${lx}, ${ly}) rotate(${labelRotation})`}>
                          <text
                            x="0" y="-4"
                            textAnchor="middle"
                            fill="white"
                            fontSize="8"
                            fontWeight="900"
                            fontFamily="Arial, sans-serif"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                          >
                            {displayLabel}
                          </text>
                          <text
                            x="0" y="6"
                            textAnchor="middle"
                            fill="rgba(200,220,255,0.85)"
                            fontSize="5"
                            fontWeight="600"
                            fontFamily="Arial, sans-serif"
                          >
                            {subLabel}
                          </text>
                        </g>
                      </g>
                    )
                  })}

                  {/* Center hub */}
                  <circle cx="100" cy="100" r="30" fill="url(#centerGrad)"
                    stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  <circle cx="100" cy="100" r="28" fill="none"
                    stroke="rgba(255,255,255,0.06)" strokeWidth="2" />

                  {/* Center SPIN button effect */}
                  <circle cx="100" cy="100" r="25"
                    fill={spinning ? '#1a55d4' : '#1040b8'}
                    stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text
                    x="100" y="104"
                    textAnchor="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                    letterSpacing="1"
                  >
                    {spinning ? '...' : 'SPIN'}
                  </text>
                </svg>
              </motion.div>

              {/* Clickable center SPIN button overlay */}
              <button
                onClick={handleSpin}
                disabled={!config?.eligible || spinning || loading}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 rounded-full transition-all active:scale-95 focus:outline-none"
                style={{
                  width: 'calc(min(90vw, 360px) * 0.28)',
                  height: 'calc(min(90vw, 360px) * 0.28)',
                  background: 'transparent',
                  cursor: config?.eligible && !spinning ? 'pointer' : 'not-allowed',
                }}
                aria-label="Spin the wheel"
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center max-w-xs">
                {error}
              </motion.div>
            )}

            {/* Spin button (below wheel, for clarity) */}
            <motion.button
              onClick={handleSpin}
              disabled={!config?.eligible || spinning || loading}
              whileTap={config?.eligible && !spinning ? { scale: 0.95 } : {}}
              whileHover={config?.eligible && !spinning ? { scale: 1.05 } : {}}
              className={`mt-6 px-12 py-4 rounded-full font-black text-lg tracking-widest transition-all shadow-2xl ${
                config?.eligible && !spinning
                  ? 'bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-[#050d1f] hover:shadow-[0_0_30px_rgba(79,172,254,0.6)] cursor-pointer'
                  : 'bg-[#1a2a4a] text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'LOADING...' : spinning ? 'SPINNING...' : config?.eligible ? 'SPIN THE WHEEL' : 'COME BACK LATER'}
            </motion.button>

            {/* Not eligible message */}
            {config && !config.eligible && config.nextSpinAt && (
              <p className="mt-3 text-blue-200/50 text-xs text-center">
                Next spin available in: <CooldownTimer nextSpinAt={config.nextSpinAt} />
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Win Modal */}
      <AnimatePresence>
        {showWin && winResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowWin(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-[#0a1535] to-[#061028] border border-blue-500/30 rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl"
              style={{ boxShadow: '0 0 80px rgba(79,172,254,0.3)' }}
            >
              {/* Confetti emoji decorations */}
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-2xl font-black text-white mb-1 tracking-wide">CONGRATULATIONS!</h2>
              <p className="text-blue-200/60 text-sm mb-6">You won from the Daily Spin</p>

              <div className="bg-[#1a3a8f]/50 rounded-2xl p-6 mb-6 border border-blue-500/20">
                <div className="text-5xl font-black text-white mb-2">
                  {winResult.percentage ? `${winResult.percentage}%` : `$${winResult.amount}`}
                </div>
                <div className="text-blue-300 font-bold text-sm uppercase tracking-widest">
                  {winResult.type === 'deposit_bonus' ? 'Deposit Bonus' : winResult.title.includes('Freeplay') ? 'Freeplay Credit' : 'Cash Reward'}
                </div>
              </div>

              <p className="text-blue-200/50 text-xs mb-6">
                {winResult.type === 'deposit_bonus'
                  ? 'This bonus will be applied to your next deposit.'
                  : 'This reward has been added to your wallet balance.'}
              </p>

              <button
                onClick={() => setShowWin(false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-[#050d1f] font-black text-sm tracking-wider hover:opacity-90 transition-opacity"
              >
                COLLECT REWARD
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
