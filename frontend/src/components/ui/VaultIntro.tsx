'use client'

// useLayoutEffect fires synchronously BEFORE browser paint on the client.
// This means we can show the dark vault screen in the SAME frame as hydration
// — eliminating the homepage flash entirely for first-time visitors.
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const N_BLADES = 10
const CX = 500, CY = 500
const OUTER_R  = 448
const INNER_R  = 408
const PIVOT_R  = 248
const OPEN_DEG = 84

const BLADE_PTS: [number, number][] = [
  [   0,    0],
  [-265, -148],
  [-432,    0],
  [-265,  148],
]

function d2r(d: number) { return (d * Math.PI) / 180 }

/** Fades out and hides the server-rendered pre-screen div */
function dismissPreScreen() {
  const el = document.getElementById('vs-prescreen')
  if (!el) return
  el.style.transition = 'opacity 0.5s ease'
  el.style.opacity = '0'
  setTimeout(() => {
    if (el) el.style.display = 'none'
  }, 550)
}

export default function VaultIntro() {
  // 0 = skip/done  1–5 = animation phases
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    // Runs client-side after first paint

    try {
      const seen = sessionStorage.getItem('vaultIntroSeen')
      if (seen) {
        // Already seen — dismiss the static pre-screen instantly and stop
        dismissPreScreen()
        return
      }
    } catch (_) { /* sessionStorage blocked (incognito restrictions etc.) */ }

    // First visit — begin the animation sequence
    setPhase(1)

    const T = [
      setTimeout(() => setPhase(2),  400),
      setTimeout(() => setPhase(3),  800),
      setTimeout(() => setPhase(4), 2200),
      setTimeout(() => setPhase(5), 2900),
      setTimeout(() => {
        setPhase(0)
        dismissPreScreen()
        try { sessionStorage.setItem('vaultIntroSeen', 'true') } catch (_) {}
      }, 3800),
    ]
    return () => T.forEach(clearTimeout)
  }, [])

  const isActivating = phase >= 2
  const isOpening    = phase >= 3
  const isOpen       = phase >= 4
  const isExiting    = phase >= 5

  // Blades (stable — no deps change)
  const blades = Array.from({ length: N_BLADES }, (_, i) => ({
    i,
    baseDeg: (i * 360) / N_BLADES,
    px: CX + PIVOT_R * Math.cos((i * Math.PI * 2) / N_BLADES),
    py: CY + PIVOT_R * Math.sin((i * Math.PI * 2) / N_BLADES),
  }))

  if (phase === 0) return null

  return (
    <AnimatePresence>
      {phase > 0 && (
        <motion.div
          key="vault-intro"
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none"
          style={{ backgroundColor: '#020710', willChange: 'opacity', contain: 'strict' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isExiting ? 0 : 1 }}
          transition={{ duration: isExiting ? 0.9 : 0.4, ease: 'easeInOut' }}
        >
          {/* Deep atmospheric background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 85% 75% at 50% 50%, #04142c 0%, #020710 72%)',
            }}
          />

          {/* Ambient light bloom (when open) */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: '65%', aspectRatio: '1', willChange: 'opacity, filter' }}
            animate={{
              background: isOpen
                ? 'radial-gradient(circle, rgba(0,100,255,0.2) 0%, rgba(80,0,200,0.1) 55%, transparent 75%)'
                : 'radial-gradient(circle, rgba(0,40,120,0.04) 0%, transparent 70%)',
              filter: isOpen ? 'blur(45px)' : 'blur(20px)',
            }}
            transition={{ duration: 1.2 }}
          />

          {/* ── Vault container ── */}
          <motion.div
            className="relative"
            style={{ width: 'min(88vw, 88vh, 560px)', aspectRatio: '1' }}
            initial={{ scale: 1.07 }}
            animate={{ scale: 1.0 }}
            transition={{ duration: 5.5, ease: 'easeOut' }}
          >
            {/* ══ LAYER 1: intro.png — stationary, revealed by iris opening ══ */}
            <motion.div
              className="absolute"
              style={{
                inset: '-1%',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                clipPath: 'circle(0% at 50% 50%)',
              }}
              animate={{
                clipPath: isOpening
                  ? 'circle(50% at 50% 50%)'
                  : 'circle(0% at 50% 50%)',
              }}
              transition={{ duration: 1.4, ease: [0.22, 0.08, 0.12, 1.0] }}
            >
              <img
                src="/intro.png"
                alt="Vault Sweeps"
                style={{
                  width: '90%',
                  height: '90%',
                  objectFit: 'contain',
                  display: 'block',
                }}
                draggable={false}
              />
            </motion.div>

            {/* ══ LAYER 2: SVG vault mechanism ══ */}
            <svg
              viewBox="0 0 1000 1000"
              className="absolute inset-0 w-full h-full"
              style={{ zIndex: 2, overflow: 'visible' }}
            >
              <defs>
                <radialGradient id="vi-blade" cx="42%" cy="28%" r="78%">
                  <stop offset="0%"   stopColor="#304e6a" />
                  <stop offset="25%"  stopColor="#1a3048" />
                  <stop offset="60%"  stopColor="#0d1e30" />
                  <stop offset="100%" stopColor="#050c18" />
                </radialGradient>
                <radialGradient id="vi-ring" cx="50%" cy="12%" r="95%">
                  <stop offset="0%"   stopColor="#607890" />
                  <stop offset="20%"  stopColor="#324c64" />
                  <stop offset="52%"  stopColor="#1a2e40" />
                  <stop offset="100%" stopColor="#070f1c" />
                </radialGradient>
                <radialGradient id="vi-bolt" cx="30%" cy="25%" r="72%">
                  <stop offset="0%"   stopColor="#b0d0f0" />
                  <stop offset="35%"  stopColor="#3e6e92" />
                  <stop offset="100%" stopColor="#0c1c2e" />
                </radialGradient>
                <radialGradient id="vi-center" cx="50%" cy="50%" r="55%">
                  <stop offset="0%"   stopColor="#101e32" />
                  <stop offset="100%" stopColor="#040a16" />
                </radialGradient>
                <radialGradient id="vi-lbolt" cx="35%" cy="25%" r="70%">
                  <stop offset="0%"   stopColor="#648ab0" />
                  <stop offset="55%"  stopColor="#1e3a50" />
                  <stop offset="100%" stopColor="#0a1826" />
                </radialGradient>
                <filter id="vi-shadow">
                  <feDropShadow dx="0" dy="3" stdDeviation="10" floodColor="rgba(0,0,0,0.95)" />
                </filter>
                <filter id="vi-glow">
                  <feGaussianBlur stdDeviation="10" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="vi-ringshadow">
                  <feDropShadow dx="0" dy="0" stdDeviation="22" floodColor="rgba(0,0,0,1)" />
                </filter>
                {/* Hard clip: blades never escape the vault boundary */}
                <clipPath id="vi-iris-clip">
                  <circle cx={CX} cy={CY} r={INNER_R + 6} />
                </clipPath>
              </defs>

              {/* ── Iris blades ── */}
              <g clipPath="url(#vi-iris-clip)">
                {blades.map(({ i, baseDeg, px, py }) => (
                  <motion.g
                    key={i}
                    initial={{ rotate: 0 }}
                    animate={{ rotate: isOpening ? OPEN_DEG : 0 }}
                    transition={{ duration: 1.4, ease: [0.18, 0.05, 0.08, 1.0] }}
                    style={{ willChange: 'transform' }}
                    transformTemplate={({ rotate: r }) => {
                      const deg = typeof r === 'number' ? r : 0
                      return `translate(${px} ${py}) rotate(${baseDeg + deg})`
                    }}
                  >
                    {/* Shadow layer */}
                    <polygon
                      points={BLADE_PTS.map(([x, y]) => `${x + 4},${y + 6}`).join(' ')}
                      fill="rgba(0,0,0,0.5)"
                      style={{ filter: 'blur(7px)' }}
                    />
                    {/* Blade body */}
                    <polygon
                      points={BLADE_PTS.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill="url(#vi-blade)"
                      filter="url(#vi-shadow)"
                    />
                    {/* Top metallic edge */}
                    <line
                      x1={BLADE_PTS[0][0]} y1={BLADE_PTS[0][1]}
                      x2={BLADE_PTS[1][0]} y2={BLADE_PTS[1][1]}
                      stroke="rgba(130,200,245,0.28)" strokeWidth="2"
                    />
                    {/* Bottom shadow edge */}
                    <line
                      x1={BLADE_PTS[0][0]} y1={BLADE_PTS[0][1]}
                      x2={BLADE_PTS[3][0]} y2={BLADE_PTS[3][1]}
                      stroke="rgba(0,0,0,0.8)" strokeWidth="2"
                    />
                    {/* Tip edges */}
                    <line
                      x1={BLADE_PTS[1][0]} y1={BLADE_PTS[1][1]}
                      x2={BLADE_PTS[2][0]} y2={BLADE_PTS[2][1]}
                      stroke="rgba(80,150,200,0.12)" strokeWidth="1.5"
                    />
                    <line
                      x1={BLADE_PTS[3][0]} y1={BLADE_PTS[3][1]}
                      x2={BLADE_PTS[2][0]} y2={BLADE_PTS[2][1]}
                      stroke="rgba(0,0,0,0.5)" strokeWidth="1.5"
                    />
                    {/* Center groove */}
                    <line x1="-38" y1="0" x2="-390" y2="0"
                      stroke="rgba(55,105,150,0.18)" strokeWidth="1.5" />
                    {/* Pivot joint */}
                    <circle cx="0" cy="0" r="14" fill="url(#vi-bolt)" />
                    <circle cx="0" cy="0" r="6" fill="#050c1a" />
                    <circle cx="-3" cy="-3" r="3" fill="rgba(170,230,255,0.22)" />
                  </motion.g>
                ))}
              </g>

              {/* ── Center disk ── */}
              <motion.g
                style={{ transformOrigin: `${CX}px ${CY}px`, willChange: 'opacity, transform' }}
                animate={{ opacity: isOpening ? 0 : 1, scale: isOpening ? 0.85 : 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <circle cx={CX} cy={CY} r={78}
                  fill="url(#vi-center)" stroke="rgba(45,90,130,0.4)" strokeWidth="2.5" />
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <line key={deg}
                    x1={CX + 13 * Math.cos(d2r(deg))} y1={CY + 13 * Math.sin(d2r(deg))}
                    x2={CX + 68 * Math.cos(d2r(deg))} y2={CY + 68 * Math.sin(d2r(deg))}
                    stroke="rgba(50,95,140,0.5)" strokeWidth="3.5" strokeLinecap="round"
                  />
                ))}
                <circle cx={CX} cy={CY} r={19} fill="url(#vi-bolt)" />
                <circle cx={CX} cy={CY} r={8} fill="#030b18" />
                <circle cx={CX - 4} cy={CY - 4} r={3.5} fill="rgba(150,220,255,0.22)" />
              </motion.g>

              {/* ── Inner frame ring ── */}
              <circle cx={CX} cy={CY} r={INNER_R + 14}
                fill="none" stroke="url(#vi-ring)" strokeWidth="28"
                filter="url(#vi-ringshadow)" />
              <circle cx={CX} cy={CY} r={INNER_R}
                fill="none" stroke="rgba(65,120,175,0.2)" strokeWidth="1.5" />
              <circle cx={CX} cy={CY} r={INNER_R + 28}
                fill="none" stroke="rgba(32,62,100,0.22)" strokeWidth="1.2" />

              {/* ── 8 locking bolts (retract on activation) ── */}
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI * 2) / 8
                const br = INNER_R + 16
                const bx = CX + br * Math.cos(a), by = CY + br * Math.sin(a)
                const ex = CX + (br - 28) * Math.cos(a), ey = CY + (br - 28) * Math.sin(a)
                return (
                  <motion.g key={i}
                    style={{ willChange: 'opacity, transform' }}
                    animate={{ opacity: isOpening ? 0 : 1 }}
                    transition={{ duration: 0.15, delay: i * 0.03 + 0.05 }}
                  >
                    <motion.line
                      x1={bx} y1={by} x2={ex} y2={ey}
                      stroke="#3a6888" strokeWidth="5.5" strokeLinecap="round"
                      animate={{ x2: isActivating ? bx : ex, y2: isActivating ? by : ey }}
                      transition={{ duration: 0.2, delay: i * 0.03 + 0.04 }}
                    />
                    <circle cx={bx} cy={by} r={8} fill="url(#vi-lbolt)" />
                    <circle cx={bx} cy={by} r={3.5} fill="#040e1c" />
                  </motion.g>
                )
              })}

              {/* ── Outer vault ring ── */}
              <circle cx={CX} cy={CY} r={OUTER_R}
                fill="none" stroke="url(#vi-ring)" strokeWidth="52"
                filter="url(#vi-ringshadow)" />
              <circle cx={CX} cy={CY} r={OUTER_R + 24}
                fill="none" stroke="rgba(60,105,160,0.14)" strokeWidth="3" />
              <circle cx={CX} cy={CY} r={OUTER_R - 24}
                fill="none" stroke="rgba(10,22,44,0.9)" strokeWidth="2.5" />
              <circle cx={CX} cy={CY} r={OUTER_R + 10}
                fill="none" stroke="rgba(35,65,105,0.2)" strokeWidth="1.2" />
              <circle cx={CX} cy={CY} r={OUTER_R - 10}
                fill="none" stroke="rgba(35,65,105,0.2)" strokeWidth="1.2" />

              {/* ── 12 outer bolts ── */}
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI * 2) / 12
                const bx = CX + OUTER_R * Math.cos(a), by = CY + OUTER_R * Math.sin(a)
                return (
                  <g key={i}>
                    <circle cx={bx} cy={by} r={22} fill="url(#vi-ring)" />
                    <circle cx={bx} cy={by} r={19} fill="url(#vi-bolt)" />
                    <circle cx={bx} cy={by} r={9}  fill="#060f1e" />
                    <line x1={bx-6} y1={by}   x2={bx+6} y2={by}   stroke="rgba(2,8,20,0.95)" strokeWidth="2.8" />
                    <line x1={bx}   y1={by-6} x2={bx}   y2={by+6} stroke="rgba(2,8,20,0.95)" strokeWidth="2.8" />
                    <circle cx={bx-4} cy={by-4} r={4} fill="rgba(165,225,255,0.2)" />
                  </g>
                )
              })}

              {/* ── Blue neon seam light ── */}
              <motion.circle
                cx={CX} cy={CY} r={INNER_R - 2}
                fill="none" strokeWidth="4" filter="url(#vi-glow)"
                style={{ willChange: 'stroke, opacity' }}
                animate={{
                  stroke: isOpening
                    ? 'rgba(0,140,255,0.0)'
                    : isActivating
                      ? 'rgba(0,150,255,0.6)'
                      : 'rgba(0,140,255,0.0)',
                  opacity: isOpening ? 0 : 1,
                }}
                transition={{ duration: 0.4 }}
              />

              {/* ── Interior ambient glow (when fully open) ── */}
              <motion.circle
                cx={CX} cy={CY} r={INNER_R - 15}
                fill="none" stroke="rgba(40,100,255,0.1)"
                strokeWidth={INNER_R * 0.25}
                style={{ willChange: 'opacity' }}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.8 }}
              />

              {/* ── Subtle rotating detail ring ── */}
              <motion.g
                style={{ transformOrigin: `${CX}px ${CY}px`, willChange: 'transform' }}
                animate={{ rotate: isOpen ? 8 : isActivating ? 4 : 0 }}
                transition={{ duration: 2.0, ease: [0.3, 0, 0.1, 1] }}
              >
                <circle cx={CX} cy={CY} r={INNER_R + 38}
                  fill="none" stroke="rgba(40,75,115,0.12)" strokeWidth="1"
                  strokeDasharray="4 20" />
              </motion.g>
            </svg>

            {/* ── Ambient outer glow ── */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{ inset: '-12%', zIndex: 0, willChange: 'box-shadow' }}
              animate={{
                boxShadow: isOpen
                  ? '0 0 160px 60px rgba(0,80,220,0.12), 0 0 300px 120px rgba(60,0,180,0.06)'
                  : isActivating
                    ? '0 0 70px 25px rgba(0,60,160,0.08)'
                    : '0 0 0 0 transparent',
              }}
              transition={{ duration: 1.2 }}
            />
          </motion.div>

          {/* ── Status text ── */}
          <AnimatePresence>
            {phase <= 2 && (
              <motion.div
                className="absolute bottom-[8%] inset-x-0 flex justify-center pointer-events-none"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.55 }}
              >
                <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.55em] text-[#1e4060] uppercase">
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >●</motion.span>
                  {phase === 1 ? 'Security Protocol Active' : 'Unlocking Vault'}
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >●</motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
