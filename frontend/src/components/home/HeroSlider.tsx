'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { publicApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useShallow } from 'zustand/react/shallow'

const DEFAULT_BANNERS = [
  {
    id: '1',
    title: 'Welcome to Vault Sweeps',
    subtitle: 'Get +100% up to 1 000 USD',
    description: 'Collect your first deposit bonus right now',
    ctaText: 'Claim now',
    ctaLink: '/verify',
    gradient: 'from-blue-900 via-indigo-800 to-[#2c162b]',
    accent: '#00D4FF',
    imageUrl: '/images/slide1.png',
    isTransparent: false
  },
  {
    id: '2',
    title: 'CASH METHODS',
    subtitle: 'Make deposits your way',
    description: 'Make deposits through any cash deposit method that is convenient for you!',
    ctaText: 'Make Deposit',
    ctaLink: '/dashboard/deposits',
    gradient: 'from-[#16a34a] via-[#22c55e] to-[#4ade80]',
    accent: '#00FFC8',
    imageUrl: '/images/promo-girl.png?v=3',
    isTransparent: true
  },
  {
    id: '3',
    title: 'BONUS ZONE',
    subtitle: 'Earn Diamonds, play games!',
    description: 'Unlock real cash rewards instantly with our premium bonus system.',
    ctaText: 'View more',
    ctaLink: '/bonuses',
    gradient: 'from-pink-700 via-rose-500 to-[#f78201]',
    accent: '#FFD700',
    imageUrl: '/images/slide3.png',
    isTransparent: false
  }
]

export default function HeroSlider() {
  const [slides, setSlides] = useState(DEFAULT_BANNERS)
  const [current, setCurrent] = useState(0)
  const { isAuthenticated, openAuthModal } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      openAuthModal: state.openAuthModal
    }))
  )

  const handleCtaClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
    }
  }

  const goTo = (index: number) => {
    setCurrent(((index % slides.length) + slides.length) % slides.length)
  }

  // Auto-play timer — re-arms on every `current` change (auto-advance, dot click, or a manual swipe
  // below), so a swipe never gets immediately undone by the timer firing a moment later.
  useEffect(() => {
    const timer = setInterval(() => goTo(current + 1), 5000)
    return () => clearInterval(timer)
  }, [current, slides.length])

  // Swipe: a real drag gesture (touch or mouse) that rubber-bands back to center on release —
  // dragConstraints locks it to 0 so it's a gesture detector, not a physically-dragged track; the actual
  // slide change is a discrete index update using the same keyed-remount transition dots already use.
  // touchAction: 'pan-y' keeps vertical page scroll working normally for a swipe that starts on the hero.
  const SWIPE_DISTANCE = 60
  const SWIPE_VELOCITY = 400
  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) goTo(current + 1)
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) goTo(current - 1)
  }

  const slide = slides[current]
  const nextSlide = slides[(current + 1) % slides.length]

  // Once the first slide has painted, quietly fetch the next slide's art so the swap never shows an
  // empty gradient waiting on the image.
  const [warmNext, setWarmNext] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWarmNext(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="pt-6 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative w-full h-[280px] sm:h-[320px] lg:h-[380px] rounded-[2rem] overflow-hidden shadow-[0_0_40px_rgba(123,47,255,0.15)] group bg-surface">
        <motion.div
          key={slide.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragEnd={handleDragEnd}
          style={{ touchAction: 'pan-y' }}
          className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} transition-all duration-500 cursor-grab active:cursor-grabbing`}
        >
          {/* subtle overlay */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
          
          <div className="relative z-10 flex h-full items-center">
            <div className="w-2/3 lg:w-1/2 p-6 sm:p-10 lg:p-12 text-left z-20">
              <motion.h1 
                key={`title-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.03, duration: 0.25 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-2 tracking-tight drop-shadow-md"
              >
                {slide.title}
              </motion.h1>
              <motion.p 
                key={`subtitle-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.06, duration: 0.25 }}
                className="text-base sm:text-xl font-bold text-white mb-2 drop-shadow-md"
              >
                {slide.subtitle}
              </motion.p>
              <motion.p 
                key={`desc-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.09, duration: 0.25 }}
                className="text-xs sm:text-sm text-white/90 mb-6 max-w-xs sm:max-w-sm drop-shadow-md"
              >
                {slide.description}
              </motion.p>
              
              <motion.div
                key={`cta-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.25 }}
              >
                <Link href={slide.ctaLink} onClick={handleCtaClick} className="btn-liquid btn-signup-beam inline-block text-white font-bold py-2.5 px-6 sm:py-3 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-base">
                  <span className="btn-liquid-content">{slide.ctaText}</span>
                </Link>
              </motion.div>
            </div>

            {/* 3D Girl Image (Right side) */}
            <motion.div 
              key={`img-${slide.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ willChange: 'transform, opacity' }}
              className="absolute right-0 bottom-0 top-0 w-[45%] sm:w-[48%] lg:w-[50%] z-10 flex items-end justify-end pointer-events-none"
            >
              <style jsx>{`
                @keyframes eyeBlink {
                  0%, 90%, 100% { filter: brightness(1); transform: scaleY(1); }
                  95% { filter: brightness(0.95); transform: scaleY(0.98); }
                }
                .animate-character {
                  animation: eyeBlink 5s infinite ease-in-out;
                }
              `}</style>
              {/* Simulated realistic subtle floating animation for the character */}
              <motion.div
                animate={{ 
                  y: [0, -5, 0],
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className={`relative h-full w-full animate-character`}
                style={!slide.isTransparent ? {
                  willChange: 'transform',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, black 18%)'
                } : { willChange: 'transform' }}
              >
                <Image
                  src={slide.imageUrl} 
                  alt="Promo character"
                  fill
                  sizes="(max-width: 640px) 46vw, (max-width: 1024px) 48vw, 640px"
                  priority={current === 0}
                  className={`${slide.isTransparent ? 'object-contain object-bottom' : 'object-cover object-top'}`}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {warmNext && nextSlide && nextSlide.id !== slide.id && (
          <div aria-hidden className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none">
            <Image src={nextSlide.imageUrl} alt="" fill sizes="(max-width: 640px) 46vw, (max-width: 1024px) 48vw, 640px" loading="eager" />
          </div>
        )}

        {/* Slide indicators — hidden on mobile to avoid overlapping the CTA button */}
        <div className="hidden sm:flex absolute bottom-6 left-10 lg:left-12 z-30 items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`transition-all duration-300 rounded-full h-1 ${
                i === current ? 'w-8 bg-yellow-400' : 'w-4 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
