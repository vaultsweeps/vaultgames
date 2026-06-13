'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Users, Download, Gamepad2, Trophy } from 'lucide-react'

const STATS = [
  { icon: Download, value: 2500000, label: 'Total Downloads', suffix: '+', color: '#00D4FF' },
  { icon: Users, value: 850000, label: 'Active Members', suffix: '+', color: '#7B2FFF' },
  { icon: Gamepad2, value: 500, label: 'Available Games', suffix: '+', color: '#00FFC8' },
  { icon: Trophy, value: 150000, label: 'Community Players', suffix: '+', color: '#FF2D9B' },
]

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 2000
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setCount(target); clearInterval(timer); return }
      setCount(Math.floor(current))
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, target])

  const formatted = count >= 1000000
    ? (count / 1000000).toFixed(1) + 'M'
    : count >= 1000 ? (count / 1000).toFixed(0) + 'K' : count.toString()

  return <span ref={ref}>{formatted}{suffix}</span>
}

export default function StatsSection() {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/5 via-transparent to-neon-purple/5" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">By the numbers</p>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-white">
            PLATFORM <span className="gradient-text">STATISTICS</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              className="glass-card p-8 text-center group cursor-default"
            >
              <div className="mb-4 flex justify-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}40` }}>
                  <stat.icon className="w-7 h-7" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl mb-2" style={{ color: stat.color }}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
