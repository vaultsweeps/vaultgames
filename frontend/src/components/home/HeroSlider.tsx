'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { publicApi } from '@/lib/api'

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

  // Auto-play timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  const slide = slides[current]

  return (
    <section className="pt-6 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative w-full h-[280px] sm:h-[320px] lg:h-[360px] rounded-[2rem] overflow-hidden shadow-[0_0_40px_rgba(123,47,255,0.15)] group bg-surface">
        <div
          key={slide.id}
          className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} transition-all duration-500`}
        >
          {/* subtle overlay */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
          
          <div className="relative z-10 flex h-full items-center">
            <div className="w-2/3 lg:w-1/2 p-6 sm:p-10 lg:p-12 text-left z-20">
              <motion.h1 
                key={`title-${slide.id}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-2 tracking-tight drop-shadow-md"
              >
                {slide.title}
              </motion.h1>
              <motion.p 
                key={`subtitle-${slide.id}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-base sm:text-xl font-bold text-white mb-2 drop-shadow-md"
              >
                {slide.subtitle}
              </motion.p>
              <motion.p 
                key={`desc-${slide.id}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs sm:text-sm text-white/90 mb-6 max-w-xs sm:max-w-sm drop-shadow-md"
              >
                {slide.description}
              </motion.p>
              
              <motion.div
                key={`cta-${slide.id}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Link href={slide.ctaLink} className="btn-liquid btn-signup-beam inline-block text-white font-bold py-2.5 px-6 sm:py-3 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-base">
                  <span className="btn-liquid-content">{slide.ctaText}</span>
                </Link>
              </motion.div>
            </div>

            {/* 3D Girl Image (Right side) */}
            <motion.div 
              key={`img-${slide.id}`}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
              className="absolute right-0 bottom-0 top-0 w-[55%] lg:w-[50%] z-10 flex items-end justify-end pointer-events-none"
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
              <motion.img 
                animate={{ 
                  y: [0, -5, 0],
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                style={!slide.isTransparent ? {
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, black 20%)'
                } : {}}
                src={slide.imageUrl} 
                alt="Promo character"
                className={`h-full w-full object-[center_15%] animate-character ${slide.isTransparent ? 'object-contain drop-shadow-2xl translate-y-[2%]' : 'object-cover'}`} 
              />
            </motion.div>
          </div>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-6 left-6 sm:left-10 lg:left-12 z-30 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
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
