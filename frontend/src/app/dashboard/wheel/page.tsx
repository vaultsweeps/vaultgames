'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, AlertCircle } from 'lucide-react'
import { wheelApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Card, Button, PageHeader, SectionHeading, IconTile, Skeleton, GiftIcon, TONES } from '@/components/dashboard/ui'

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

// Gold that stays readable on both dark and light surfaces.
const GOLD_TEXT = 'color-mix(in srgb, #F59E0B 80%, var(--text-primary))'

// ─── Cooldown Timer Component ─────────────────────────────────────────────────
function CooldownTimer({ nextSpinAt, className }: { nextSpinAt: string; className?: string }) {
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
  return <span className={className || 'font-bold text-primary tabular-nums'}>{timeLeft}</span>
}

// Display helpers (presentation only — same rules the wheel segments and result modal already use)
const prizeFigure = (p: WheelPrize) => (p.percentage ? `${p.percentage}%` : `$${p.amount}`)
const prizeKind = (p: WheelPrize) =>
  p.type === 'deposit_bonus' ? 'Deposit bonus' : p.title.includes('Freeplay') ? 'Freeplay' : 'Cash'

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
    <div>
      <PageHeader
        title="Daily Spin"
        subtitle="Get prizes every day in the win-win lottery wheel of luck!"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-4 sm:gap-5 items-start">

        {/* ── Wheel card ── */}
        <Card className="relative overflow-hidden !px-3 min-[400px]:!px-5 sm:!px-8 !py-6 sm:!py-9">
          {/* soft static glow behind the wheel */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
            style={{ background: 'radial-gradient(60% 55% at 50% 46%, rgba(59,130,246,0.20) 0%, rgba(251,191,36,0.06) 55%, transparent 80%)' }} />

          <div className="relative flex flex-col items-center">
            {/* Pointer */}
            <div className="relative z-20 mb-[-10px]" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))' }}>
              <svg width="40" height="32" viewBox="0 0 40 32">
                <defs>
                  <linearGradient id="ptGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FDE68A" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                </defs>
                <polygon points="20,32 0,0 40,0" fill="url(#ptGrad)" />
                <polygon points="20,32 0,0 40,0" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
              </svg>
            </div>

            {/* Wheel Outer Ring */}
            <div className="relative w-full aspect-square" style={{ maxWidth: 360 }}>
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
                    className="absolute w-2.5 h-2.5 min-[400px]:w-3 min-[400px]:h-3 rounded-full z-10 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
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
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 rounded-full transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                style={{
                  width: '28%',
                  height: '28%',
                  background: 'transparent',
                  cursor: config?.eligible && !spinning ? 'pointer' : 'not-allowed',
                }}
                aria-label="Spin the wheel"
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} role="alert"
                className="mt-5 w-full max-w-sm flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] leading-snug"
                style={{ background: TONES.red.bg, color: TONES.red.fg, boxShadow: `inset 0 0 0 1px ${TONES.red.ring}` }}>
                <AlertCircle className="w-[18px] h-[18px] flex-shrink-0 mt-px" />
                <span className="min-w-0 break-words">{error}</span>
              </motion.div>
            )}

            {/* Spin button (below wheel, for clarity) */}
            <Button
              size="lg"
              onClick={handleSpin}
              disabled={!config?.eligible || spinning || loading}
              className="mt-6 sm:mt-7 w-full sm:w-auto sm:min-w-[260px]"
            >
              {loading ? 'Loading…' : spinning ? 'Spinning…' : config?.eligible ? 'Spin the wheel' : 'Come back later'}
            </Button>

            {/* Not eligible message */}
            {config && !config.eligible && config.nextSpinAt && (
              <p className="mt-3 text-secondary text-[13px] text-center lg:hidden">
                Next spin available in: <CooldownTimer nextSpinAt={config.nextSpinAt} className="font-semibold text-primary tabular-nums" />
              </p>
            )}
          </div>
        </Card>

        {/* ── Side column: status + prizes ── */}
        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* Eligibility / next spin */}
          {loading && !config ? (
            <Card>
              <div className="flex items-center gap-4">
                <Skeleton className="w-11 h-11" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </Card>
          ) : config && (
            <Card>
              {config.eligible ? (
                <div className="flex items-start gap-4">
                  <IconTile icon={Check} tone="green" size="md" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-secondary">Daily spin</p>
                    <p className="mt-1 text-[17px] font-semibold leading-snug" style={{ color: TONES.green.fg }}>
                      You haven&apos;t spun the wheel for 24 hours.
                    </p>
                    <p className="mt-1 text-[14px] text-secondary">You are eligible to spin!</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <IconTile icon={Clock} tone="orange" size="md" />
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold leading-snug" style={{ color: TONES.orange.fg }}>Already spun today.</p>
                    <p className="mt-1 text-[13px] text-secondary">Next spin in</p>
                    {config.nextSpinAt && (
                      <p className="mt-0.5">
                        <CooldownTimer nextSpinAt={config.nextSpinAt} className="text-[28px] sm:text-[32px] leading-tight font-bold text-primary tabular-nums" />
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Prizes */}
          {prizes.length > 0 && (
            <Card>
              <SectionHeading title="Prizes on the wheel" />
              <ul className="flex flex-wrap gap-2">
                {prizes.map(p => (
                  <li key={p.id}
                    className="inline-flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-full bg-surface-elevated border border-border-subtle text-[13px]">
                    <span className="font-bold tabular-nums" style={{ color: GOLD_TEXT }}>{prizeFigure(p)}</span>
                    <span className="text-secondary">{prizeKind(p)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Win Modal */}
      <AnimatePresence>
        {showWin && winResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowWin(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Spin result"
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 240 }}
              onClick={e => e.stopPropagation()}
              className="ds-card relative overflow-hidden text-center max-w-sm w-full p-6 sm:p-8"
            >
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                style={{ background: 'radial-gradient(90% 55% at 50% 0%, rgba(251,191,36,0.20) 0%, transparent 70%)' }} />
              <div className="relative">
                <div className="w-20 h-20 mx-auto -mb-1"><GiftIcon /></div>
                <h2 className="text-[22px] font-bold text-primary tracking-tight">Congratulations!</h2>
                <p className="mt-1 text-[14px] text-secondary">You won from the Daily Spin</p>

                <div className="mt-5 rounded-2xl px-4 py-5"
                  style={{ background: TONES.gold.bg, boxShadow: `inset 0 0 0 1px ${TONES.gold.ring}` }}>
                  <div className="text-[44px] leading-none font-bold tabular-nums" style={{ color: GOLD_TEXT }}>
                    {winResult.percentage ? `${winResult.percentage}%` : `$${winResult.amount}`}
                  </div>
                  <div className="mt-2 text-[13px] font-semibold text-primary">
                    {winResult.type === 'deposit_bonus' ? 'Deposit Bonus' : winResult.title.includes('Freeplay') ? 'Freeplay Credit' : 'Cash Reward'}
                  </div>
                </div>

                <p className="mt-4 mb-6 text-[13px] text-secondary leading-relaxed">
                  {winResult.type === 'deposit_bonus'
                    ? 'This bonus will be applied to your next deposit.'
                    : 'This reward has been added to your wallet balance.'}
                </p>

                <Button full onClick={() => setShowWin(false)}>
                  Collect reward
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
