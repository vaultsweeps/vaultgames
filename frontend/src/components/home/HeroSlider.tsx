'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import Link from 'next/link'
import { publicApi } from '@/lib/api'

const DEFAULT_SLIDES = [
  {
    id: '1',
    title: 'ENTER THE NEXUS',
    subtitle: 'The Ultimate Gaming Universe',
    description: 'Join millions of players in the most immersive gaming platform ever created. Download, play, and dominate.',
    ctaText: 'PLAY NOW',
    ctaLink: '/games',
    ctaSecondary: 'View Bonuses',
    ctaSecondaryLink: '/bonuses',
    gradient: 'from-blue-900/80 via-dark-900/60 to-purple-900/80',
    accent: '#00D4FF',
    badge: '🎮 500+ GAMES AVAILABLE',
  },
  {
    id: '2',
    title: 'CLAIM YOUR BONUS',
    subtitle: 'Up to 500% Welcome Bonus',
    description: 'New to NexusGaming? Start your journey with an incredible welcome package. Claim your bonus today.',
    ctaText: 'CLAIM BONUS',
    ctaLink: '/register',
    ctaSecondary: 'Learn More',
    ctaSecondaryLink: '/bonuses',
    gradient: 'from-purple-900/80 via-dark-900/60 to-pink-900/80',
    accent: '#7B2FFF',
    badge: '🔥 LIMITED TIME OFFER',
  },
  {
    id: '3',
    title: 'INSTANT CASHOUT',
    subtitle: 'Fast & Secure Withdrawals',
    description: 'Experience lightning-fast withdrawals with our automated payment system. Your winnings, your way.',
    ctaText: 'START EARNING',
    ctaLink: '/register',
    ctaSecondary: 'Cashout Rules',
    ctaSecondaryLink: '/cashout-rules',
    gradient: 'from-cyan-900/80 via-dark-900/60 to-blue-900/80',
    accent: '#00FFC8',
    badge: '⚡ INSTANT PROCESSING',
  },
]

const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 10 + 5,
  delay: Math.random() * 5,
}))

interface Slide {
  id: string
  title: string
  subtitle: string
  description: string
  ctaText: string
  ctaLink: string
  ctaSecondary?: string
  ctaSecondaryLink?: string
  gradient: string
  accent: string
  badge?: string
  imageUrl?: string
}

interface HeroSliderProps {
  slides?: Slide[]
}

export default function HeroSlider({ slides: propSlides }: HeroSliderProps) {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES)
  const [current, setCurrent] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [mounted, setMounted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Fetch banners from API and map to slide format
  useEffect(() => {
    publicApi.getBanners()
      .then(res => {
        const banners = res.data.data
        if (banners && banners.length > 0) {
          const mapped: Slide[] = banners.map((b: any, idx: number) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle || '',
            description: b.subtitle || b.title,
            ctaText: b.ctaText || 'EXPLORE NOW',
            ctaLink: b.ctaLink || '/games',
            gradient: DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length].gradient,
            accent: DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length].accent,
            imageUrl: b.imageUrl,
          }))
          setSlides(mapped)
        }
      })
      .catch(() => { /* keep default slides */ })
  }, [])

  const next = () => setCurrent(c => (c + 1) % slides.length)
  const prev = () => setCurrent(c => (c - 1 + slides.length) % slides.length)

  useEffect(() => {
    setMounted(true)
    if (isPlaying) {
      intervalRef.current = setInterval(next, 5000)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, slides.length])

  const slide = slides[current]

  return (
    <div className="relative h-screen min-h-[600px] overflow-hidden bg-dark-900">
      {/* Animated grid background */}
      <div className="absolute inset-0 cyber-grid opacity-30" />

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {mounted && PARTICLES.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-neon-blue/40"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          {slide.imageUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-60" 
              style={{ backgroundImage: `url(${slide.imageUrl})` }}
            />
          )}

          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} ${slide.imageUrl ? 'opacity-90' : ''}`} />

          {/* Dynamic lighting orbs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: slide.accent }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-15"
            style={{ backgroundColor: slide.accent }}
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.1, 0.2] }}
            transition={{ duration: 5, repeat: Infinity }}
          />

          {/* Content */}
          <div className="relative z-10 h-full flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-3xl">
                {/* Badge */}
                {slide.badge && (
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 border"
                    style={{ borderColor: `${slide.accent}40` }}
                  >
                    <span className="text-xs font-mono tracking-widest" style={{ color: slide.accent }}>
                      {slide.badge}
                    </span>
                  </motion.div>
                )}

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="font-mono text-sm tracking-[0.3em] uppercase mb-3"
                  style={{ color: slide.accent }}
                >
                  {slide.subtitle}
                </motion.p>

                {/* Main title */}
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="font-display font-black text-5xl sm:text-6xl lg:text-8xl text-white leading-none mb-6"
                  style={{ textShadow: `0 0 60px ${slide.accent}40` }}
                >
                  {slide.title}
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-slate-300 text-lg sm:text-xl max-w-xl mb-8 leading-relaxed"
                >
                  {slide.description}
                </motion.p>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap gap-4"
                >
                  <Link href={slide.ctaLink}
                    className="btn-primary flex items-center gap-2 text-sm py-3 px-8"
                    style={{ boxShadow: `0 0 30px ${slide.accent}40` }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {slide.ctaText}
                  </Link>
                  {slide.ctaSecondary && (
                    <Link href={slide.ctaSecondaryLink || '#'} className="btn-neon text-sm py-3 px-8">
                      {slide.ctaSecondary}
                    </Link>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 glass rounded-full flex items-center justify-center text-white hover:border-neon-blue/40 border border-white/10 transition-all hover:scale-110 group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:text-neon-blue transition-colors" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 glass rounded-full flex items-center justify-center text-white hover:border-neon-blue/40 border border-white/10 transition-all hover:scale-110 group"
      >
        <ChevronRight className="w-5 h-5 group-hover:text-neon-blue transition-colors" />
      </button>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current ? 'w-8 h-2 bg-neon-blue shadow-neon-blue' : 'w-2 h-2 bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* Auto-play toggle */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute bottom-8 right-6 z-20 w-8 h-8 glass rounded-full flex items-center justify-center text-slate-400 hover:text-white border border-white/10 transition-all text-xs"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Slide counter */}
      <div className="absolute bottom-8 left-6 z-20 font-mono text-xs text-slate-500">
        <span className="text-neon-blue">{String(current + 1).padStart(2, '0')}</span>
        <span className="mx-1">/</span>
        {String(slides.length).padStart(2, '0')}
      </div>
    </div>
  )
}
