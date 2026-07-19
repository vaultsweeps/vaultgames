'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'
import confetti from 'canvas-confetti'
import apiClient from '@/lib/api'
import toast from 'react-hot-toast'

export default function PremiumWheel({ prizes, canSpin, onSpinComplete }: { prizes: any[], canSpin: boolean, onSpinComplete: () => void }) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const controls = useAnimation()
  
  // Audio context for sound effects
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    // Initialize audio context on first interaction to comply with browser auto-play policies
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }
    window.addEventListener('click', initAudio, { once: true })
    return () => window.removeEventListener('click', initAudio)
  }, [])

  const playTickSound = () => {
    if (!audioCtxRef.current) return
    const osc = audioCtxRef.current.createOscillator()
    const gainNode = audioCtxRef.current.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtxRef.current.currentTime + 0.05)
    
    gainNode.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.05)
    
    osc.connect(gainNode)
    gainNode.connect(audioCtxRef.current.destination)
    
    osc.start()
    osc.stop(audioCtxRef.current.currentTime + 0.05)
  }

  const playWinSound = () => {
    if (!audioCtxRef.current) return
    const osc = audioCtxRef.current.createOscillator()
    const gainNode = audioCtxRef.current.createGain()
    osc.type = 'triangle'
    
    // Play a happy chime
    const now = audioCtxRef.current.currentTime
    osc.frequency.setValueAtTime(440, now) // A4
    osc.frequency.setValueAtTime(554.37, now + 0.1) // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.2) // E5
    osc.frequency.setValueAtTime(880, now + 0.3) // A5
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.8)
    
    osc.connect(gainNode)
    gainNode.connect(audioCtxRef.current.destination)
    
    osc.start(now)
    osc.stop(now + 0.8)
  }

  const handleSpin = async () => {
    if (!canSpin || isSpinning || prizes.length === 0) return
    setIsSpinning(true)

    try {
      // 1. Call API to get result securely
      const res = await apiClient.post('/wheel/spin')
      const winData = res.data.data
      const winningPrizeIndex = prizes.findIndex(p => p.id === winData.prize.id)

      if (winningPrizeIndex === -1) throw new Error('Prize not found')

      // 2. Calculate rotation
      const sliceAngle = 360 / prizes.length
      // The pointer is at the top (0 degrees).
      // We want the winning slice to land at the top.
      // If index 0 is at 0 degrees initially, its center is at sliceAngle/2.
      // Let's calculate exactly where to stop.
      const spins = 5 // Spin 5 times for dramatic effect
      const targetRotation = spins * 360 + (360 - (winningPrizeIndex * sliceAngle))
      
      const newTotalRotation = rotation + targetRotation

      // Simulate tick sounds during animation
      let tickInterval = setInterval(playTickSound, 150)
      setTimeout(() => clearInterval(tickInterval), 2500)
      setTimeout(() => {
        tickInterval = setInterval(playTickSound, 300)
      }, 2500)
      setTimeout(() => clearInterval(tickInterval), 4000)

      await controls.start({
        rotate: newTotalRotation,
        transition: {
          duration: 4,
          ease: [0.2, 0.8, 0.2, 1], // Custom easing for smooth deceleration
        }
      })

      setRotation(newTotalRotation % 360)
      
      // 3. Win effects
      playWinSound()
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#ffffff', '#3b82f6', '#fbbf24']
      })
      
      toast.success(`You won ${winData.prize.label}!`)
      
      setTimeout(() => {
        setIsSpinning(false)
        onSpinComplete()
      }, 2000)

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to spin')
      setIsSpinning(false)
    }
  }

  // Generate conic gradient for the wheel
  const sliceAngle = 360 / Math.max(1, prizes.length)
  const conicGradient = prizes.map((prize, i) => {
    const startAngle = i * sliceAngle
    const endAngle = (i + 1) * sliceAngle
    return `${prize.color} ${startAngle}deg ${endAngle}deg`
  }).join(', ')

  return (
    <div className="relative w-full max-w-[400px] aspect-square rounded-full flex items-center justify-center p-4">
      {/* Outer Glow & Border */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-900 shadow-[0_0_50px_rgba(59,130,246,0.5)] border-4 border-slate-900" />
      
      {/* Decorative Dots */}
      <div className="absolute inset-2 rounded-full border border-white/20">
        {Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={i}
            className="absolute w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]"
            style={{
              top: '50%', left: '50%',
              transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-185px)`
            }}
          />
        ))}
      </div>

      {/* The Spinning Wheel */}
      <motion.div
        animate={controls}
        initial={{ rotate: 0 }}
        style={{
          background: `conic-gradient(${conicGradient})`,
        }}
        className="relative w-full h-full rounded-full border-4 border-slate-900 shadow-inner overflow-hidden"
      >
        {prizes.map((prize, i) => {
          const rotation = i * sliceAngle + (sliceAngle / 2)
          return (
            <div
              key={prize.id}
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white font-bold text-lg drop-shadow-md whitespace-nowrap">
                {prize.label}
              </div>
              {/* Divider lines */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-1/2 bg-slate-900/40" style={{ transform: `rotate(${-sliceAngle/2}deg)`, transformOrigin: 'bottom center' }} />
            </div>
          )
        })}
      </motion.div>

      {/* Center Spin Button */}
      <button 
        onClick={handleSpin}
        disabled={!canSpin || isSpinning}
        className="absolute z-20 w-20 h-20 bg-gradient-to-b from-white to-slate-200 rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-900 transition-transform active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed group"
      >
        <span className="font-black text-slate-900 text-lg group-disabled:text-slate-500">
          SPIN
        </span>
      </button>

      {/* Pointer Triangle */}
      <div className="absolute -top-4 z-30 pointer-events-none drop-shadow-2xl">
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 48L0 0H40L20 48Z" fill="url(#paint0_linear)"/>
          <defs>
            <linearGradient id="paint0_linear" x1="20" y1="0" x2="20" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F8FAFC"/>
              <stop offset="1" stopColor="#94A3B8"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}
