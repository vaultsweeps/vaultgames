'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const N_BLADES = 10
const CX = 500, CY = 500
const OUTER_R  = 448   // outer ring radius
const INNER_R  = 408   // opening radius — larger so logo shows fully
const PIVOT_R  = 248   // blade pivot ring radius
const OPEN_DEG = 84    // degrees each blade rotates open

// Blade local shape (pivot = origin, blade reaches toward center = –x direction)
const BLADE_PTS: [number, number][] = [
  [   0,    0],   // pivot
  [-265, -148],   // upper reach
  [-432,    0],   // deepest reach (past center)
  [-265,  148],   // lower reach
]

function d2r(d: number) { return (d * Math.PI) / 180 }

export default function VaultIntro() {
  const [phase, setPhase] = useState(0)
  // 0=hidden  1=vault-in  2=activating  3=opening  4=open/hold  5=exit  6=done

  useEffect(() => {
    const seen = sessionStorage.getItem('vaultIntroSeen')
    if (seen) return

    setPhase(1)
    const T = [
      setTimeout(() => setPhase(2),  900),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 3700),
      setTimeout(() => setPhase(5), 4700),
      setTimeout(() => {
        setPhase(6)
        sessionStorage.setItem('vaultIntroSeen', 'true')
      }, 5800),
    ]
    return () => T.forEach(clearTimeout)
  }, [])

  const isActivating = phase >= 2
  const isOpening    = phase >= 3
  const isOpen       = phase >= 4
  const isExiting    = phase >= 5

  const blades = useMemo(() =>
    Array.from({ length: N_BLADES }, (_, i) => ({
      i,
      baseDeg: (i * 360) / N_BLADES,
      px: CX + PIVOT_R * Math.cos((i * Math.PI * 2) / N_BLADES),
      py: CY + PIVOT_R * Math.sin((i * Math.PI * 2) / N_BLADES),
    })), [])

  if (phase === 0 || phase === 6) return null

  return (
    <AnimatePresence>
      {phase < 6 && (
        <motion.div
          key="vault-intro"
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none"
          style={{ backgroundColor: '#020710' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isExiting ? 0 : 1 }}
          transition={{ duration: isExiting ? 1.2 : 0.6, ease: 'easeInOut' }}
        >
          {/* ── deep space bg ── */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 85% 75% at 50% 50%, #04142c 0%, #020710 72%)',
          }} />

          {/* ── subtle ambient light bloom behind vault when open ── */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: '65%', aspectRatio: '1' }}
            animate={{
              background: isOpen
                ? 'radial-gradient(circle, rgba(0,100,255,0.18) 0%, rgba(80,0,200,0.08) 50%, transparent 75%)'
                : 'radial-gradient(circle, rgba(0,40,120,0.05) 0%, transparent 70%)',
              filter: isOpen ? 'blur(40px)' : 'blur(20px)',
            }}
            transition={{ duration: 2.0 }}
          />

          {/* ── vault container ── */}
          <motion.div
            className="relative"
            style={{ width: 'min(88vw, 88vh, 560px)', aspectRatio: '1' }}
            // Subtle camera push-in over the full duration
            initial={{ scale: 1.07 }}
            animate={{ scale: 1.0 }}
            transition={{ duration: 5.5, ease: 'easeOut' }}
          >
            {/* ══ LAYER 1: intro.png — stationary, revealed by expanding clip-path ══ */}
            <motion.div
              className="absolute"
              style={{
                // Make the logo container slightly LARGER than the vault frame
                // so the logo fully fills the inner ring opening
                inset: '-2%',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                clipPath: 'circle(0% at 50% 50%)',
              }}
              animate={{
                // Expand to 48% so it fills the inner ring (INNER_R/OUTER_R ≈ 91%)
                // We add a little extra so no edge is clipped by the blade ring
                clipPath: isOpening
                  ? 'circle(50% at 50% 50%)'
                  : 'circle(0% at 50% 50%)',
              }}
              transition={{ duration: 2.0, ease: [0.22, 0.08, 0.12, 1.0] }}
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
                {/* Metal gradients */}
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

                {/* Clip blades so they never escape the vault boundary */}
                <clipPath id="vi-iris-clip">
                  <circle cx={CX} cy={CY} r={INNER_R + 5} />
                </clipPath>
              </defs>

              {/* ── Iris blades (clipped to inner ring) ── */}
              <g clipPath="url(#vi-iris-clip)">
                {blades.map(({ i, baseDeg, px, py }) => (
                  <motion.g
                    key={i}
                    initial={{ rotate: 0 }}
                    animate={{ rotate: isOpening ? OPEN_DEG : 0 }}
                    transition={{
                      duration: 2.0,
                      ease: [0.18, 0.05, 0.08, 1.0],  // mechanical: slow start, release
                    }}
                    transformTemplate={({ rotate: r }) => {
                      const deg = typeof r === 'number' ? r : 0
                      return `translate(${px} ${py}) rotate(${baseDeg + deg})`
                    }}
                  >
                    {/* Blade shadow */}
                    <polygon
                      points={BLADE_PTS.map(([x, y]) => `${x + 4},${y + 6}`).join(' ')}
                      fill="rgba(0,0,0,0.55)"
                      style={{ filter: 'blur(7px)' }}
                    />
                    {/* Main blade body */}
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
                    {/* Far tip edges */}
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
                    {/* Surface scratches */}
                    <line x1="-95" y1="-48" x2="-225" y2="-36"
                      stroke="rgba(90,155,205,0.08)" strokeWidth="1" />
                    <line x1="-115" y1="52" x2="-285" y2="42"
                      stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                    {/* Pivot joint */}
                    <circle cx="0" cy="0" r="14" fill="url(#vi-bolt)" />
                    <circle cx="0" cy="0" r="6" fill="#050c1a" />
                    <circle cx="-3" cy="-3" r="3" fill="rgba(170,230,255,0.22)" />
                  </motion.g>
                ))}
              </g>

              {/* ── Center disk (fades out as iris opens) ── */}
              <motion.g
                animate={{ opacity: isOpening ? 0 : 1, scale: isOpening ? 0.85 : 1 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
                transition={{ duration: 0.7, delay: 0.25 }}
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

              {/* ── 8 locking bolts on inner ring (retract) ── */}
              {Array.from({ length: 8 }, (_, i) => {
                const a  = (i * Math.PI * 2) / 8
                const br = INNER_R + 16
                const bx = CX + br * Math.cos(a), by = CY + br * Math.sin(a)
                const ex = CX + (br - 28) * Math.cos(a), ey = CY + (br - 28) * Math.sin(a)
                return (
                  <motion.g key={i}
                    animate={{ opacity: isOpening ? 0 : 1 }}
                    transition={{ duration: 0.2, delay: i * 0.065 + 0.1 }}
                  >
                    <motion.line
                      x1={bx} y1={by} x2={ex} y2={ey}
                      stroke="#3a6888" strokeWidth="5.5" strokeLinecap="round"
                      animate={{
                        x2: isActivating ? bx : ex,
                        y2: isActivating ? by : ey,
                      }}
                      transition={{ duration: 0.28, delay: i * 0.065 + 0.08 }}
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
              {/* Rim highlights */}
              <circle cx={CX} cy={CY} r={OUTER_R + 24}
                fill="none" stroke="rgba(60,105,160,0.14)" strokeWidth="3" />
              <circle cx={CX} cy={CY} r={OUTER_R - 24}
                fill="none" stroke="rgba(10,22,44,0.9)" strokeWidth="2.5" />
              {/* Machining grooves */}
              <circle cx={CX} cy={CY} r={OUTER_R + 10}
                fill="none" stroke="rgba(35,65,105,0.2)" strokeWidth="1.2" />
              <circle cx={CX} cy={CY} r={OUTER_R - 10}
                fill="none" stroke="rgba(35,65,105,0.2)" strokeWidth="1.2" />

              {/* ── 12 outer bolts ── */}
              {Array.from({ length: 12 }, (_, i) => {
                const a  = (i * Math.PI * 2) / 12
                const bx = CX + OUTER_R * Math.cos(a)
                const by = CY + OUTER_R * Math.sin(a)
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

              {/* ── Blue seam neon (activating, disappears when opening starts) ── */}
              <motion.circle
                cx={CX} cy={CY} r={INNER_R - 2}
                fill="none" strokeWidth="4" filter="url(#vi-glow)"
                animate={{
                  stroke: isOpening
                    ? 'rgba(0,140,255,0.0)'
                    : isActivating
                      ? 'rgba(0,150,255,0.6)'
                      : 'rgba(0,140,255,0.0)',
                  opacity: isOpening ? 0 : 1,
                }}
                transition={{ duration: 0.7 }}
              />

              {/* ── Light from inside when fully open ── */}
              <motion.circle
                cx={CX} cy={CY} r={INNER_R - 15}
                fill="none" stroke="rgba(40,100,255,0.12)"
                strokeWidth={INNER_R * 0.25}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 1.8 }}
              />

              {/* ── Subtle outer ring slow rotation (premium feel) ── */}
              <motion.g
                style={{ transformOrigin: `${CX}px ${CY}px` }}
                initial={{ rotate: 0 }}
                animate={{ rotate: isOpen ? 8 : isActivating ? 4 : 0 }}
                transition={{ duration: 3.5, ease: [0.3, 0, 0.1, 1] }}
              >
                {/* Second inner detail ring that rotates — very subtle */}
                <circle cx={CX} cy={CY} r={INNER_R + 38}
                  fill="none" stroke="rgba(40,75,115,0.12)" strokeWidth="1"
                  strokeDasharray="4 20" />
              </motion.g>
            </svg>

            {/* ── Ambient outer glow (HTML layer, outside SVG) ── */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{ inset: '-12%', zIndex: 0 }}
              animate={{
                boxShadow: isOpen
                  ? '0 0 160px 60px rgba(0,80,220,0.12), 0 0 300px 120px rgba(60,0,180,0.06)'
                  : isActivating
                    ? '0 0 70px 25px rgba(0,60,160,0.08)'
                    : '0 0 0 0 transparent',
              }}
              transition={{ duration: 1.8 }}
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
                  <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                    ●
                  </motion.span>
                  {phase === 1 ? 'Security Protocol Active' : 'Unlocking Vault'}
                  <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }}>
                    ●
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
