'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { publicApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useShallow } from 'zustand/react/shallow'
import { getSignalUrl } from '@/lib/signal'

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
  },
  {
    id: '4',
    badge: 'EVERY SUNDAY',
    title: 'SUNDAY FREEPLAY',
    subtitle: 'Free $3 every week',
    description: 'Deposit $5+ this week, then text us on Signal to claim.',
    ctaText: 'Claim on Signal',
    ctaLink: '/bonuses',
    ctaKind: 'signal',
    gradient: 'from-[#07060f] via-[#1a1033] to-[#3b2208]',
    accent: '#F5C451',
    imageUrl: '/images/promogirl.png',
    isTransparent: true,
    premium: true,
    // look: warm gold light, hairline gold frame, big faint "$3", the cut-out's flat table edges faded out
    glow: 'radial-gradient(55% 80% at 78% 62%, rgba(245,196,81,0.30), transparent 70%), radial-gradient(40% 60% at 8% 0%, rgba(139,92,246,0.25), transparent 70%)',
    frame: 'border-amber-300/25',
    badgeClass: 'text-amber-200 bg-amber-400/15 border-amber-300/30',
    subClass: 'text-amber-200',
    imageBox: 'top-auto h-[280px] sm:top-0 sm:h-auto aspect-[1129/1393] right-2 sm:right-6 lg:right-10',
    bigText: '$3',
    bigTextClass: 'text-[230px] right-[27%]',
    bigTextFill: 'linear-gradient(180deg, rgba(253,224,71,0.38), rgba(245,158,11,0.04))',
    edgeFade: true
  },
  {
    id: '5',
    badge: 'MORE WAYS TO EARN',
    title: '30% BONUS',
    subtitle: 'On every recharge',
    description: 'Added directly in your game when you recharge, not to your wallet. Refer a friend and earn up to $10.',
    descClass: 'max-w-[162px]',
    ctaText: 'Get 30% Bonus',
    ctaLink: '/games',
    authView: 'register',
    ctaSecondary: { text: 'Refer & Earn', link: '/dashboard/invite' },
    mobileCta: { text: 'Refer & Earn', link: '/dashboard/invite' },
    gradient: 'from-[#050a24] via-[#0a1a63] to-[#3b1a7a]',
    accent: '#38BDF8',
    imageUrl: '/images/prompgirl1.png',
    isTransparent: true,
    premium: true,
    // look: cool blue light, hairline sky frame, big faint "30%"; a full-length figure, so no edge fading
    glow: 'radial-gradient(50% 80% at 76% 55%, rgba(56,189,248,0.32), transparent 70%), radial-gradient(45% 60% at 8% 0%, rgba(168,85,247,0.30), transparent 70%)',
    frame: 'border-sky-300/25',
    badgeClass: 'text-sky-200 bg-sky-400/15 border-sky-300/30',
    subClass: 'text-sky-200',
    imageBox: 'top-auto h-[280px] sm:top-0 sm:h-auto aspect-[407/613] right-2 sm:right-8 lg:right-16',
    bigText: '30%',
    bigTextClass: 'text-[200px] right-[25%]',
    bigTextFill: 'linear-gradient(180deg, rgba(125,211,252,0.40), rgba(59,130,246,0.04))',
    edgeFade: false
  }
]

// Soft left / right / bottom edges for the premium slide's cut-out, so the table blends into the background
const PREMIUM_MASK = 'linear-gradient(to right, transparent 0%, black 22%), linear-gradient(to left, transparent 0%, black 10%), linear-gradient(to top, transparent 0%, black 16%)'

export default function HeroSlider() {
  const [slides, setSlides] = useState(DEFAULT_BANNERS)
  const [current, setCurrent] = useState(0)
  // "Claim on Signal" goes to whichever Signal account is on shift now; refreshed every minute
  const [signalUrl, setSignalUrl] = useState('')
  useEffect(() => {
    setSignalUrl(getSignalUrl())
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    return () => clearInterval(t)
  }, [])
  const { isAuthenticated, openAuthModal } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      openAuthModal: state.openAuthModal
    }))
  )

  const handleCtaClick = (e: React.MouseEvent, view: string = 'login') => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal(view === 'register' ? 'register' : 'login')
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
      <div className="relative w-full h-[300px] sm:h-[320px] lg:h-[380px] rounded-[2rem] overflow-hidden shadow-[0_0_40px_rgba(123,47,255,0.15)] group bg-surface">
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
          {slide.premium && (
            <>
              {/* coloured light behind the model plus a hairline frame (colours come from the slide) */}
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: slide.glow }} />
              <div aria-hidden className={`absolute inset-0 rounded-[2rem] border pointer-events-none ${slide.frame}`} />
              {/* big faint figure behind the model on wide screens — carries the offer at a glance */}
              {slide.bigText && (
                <div
                  aria-hidden
                  className={`hidden lg:block absolute top-1/2 -translate-y-1/2 leading-none font-black tracking-tighter select-none pointer-events-none ${slide.bigTextClass}`}
                  style={{ background: slide.bigTextFill, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                >
                  {slide.bigText}
                </div>
              )}
            </>
          )}
          
          <div className="relative z-10 flex h-full items-center">
            <div className="w-2/3 lg:w-1/2 p-6 pb-9 sm:p-10 lg:p-12 text-left z-20">
              {slide.badge && (
                <motion.span
                  key={`badge-${slide.id}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`inline-block mb-2 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-[0.18em] border ${slide.badgeClass}`}
                >
                  {slide.badge}
                </motion.span>
              )}
              <motion.h1 
                key={`title-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.03, duration: 0.25 }}
                className={`${slide.premium ? 'text-[28px]' : 'text-3xl'} sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-2 tracking-tight drop-shadow-md`}
              >
                {slide.title}
              </motion.h1>
              <motion.p 
                key={`subtitle-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.06, duration: 0.25 }}
                className={`text-base sm:text-xl font-bold mb-2 drop-shadow-md ${slide.premium ? slide.subClass : 'text-white'}`}
              >
                {slide.subtitle}
              </motion.p>
              <motion.p 
                key={`desc-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.09, duration: 0.25 }}
                className={`text-xs sm:text-sm text-white/90 ${slide.premium ? 'mb-4' : 'mb-6'} sm:mb-6 ${slide.descClass || 'max-w-xs'} sm:max-w-sm drop-shadow-md`}
              >
                {slide.description}
              </motion.p>
              
              <motion.div
                key={`cta-${slide.id}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.25 }}
              >
                {slide.ctaKind === 'signal' ? (
                  <a
                    href={signalUrl || slide.ctaLink}
                    target={isAuthenticated && signalUrl ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => handleCtaClick(e, slide.authView)}
                    className="btn-liquid btn-signup-beam inline-block text-white font-bold py-2.5 px-6 sm:py-3 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-base"
                  >
                    <span className="btn-liquid-content">{slide.ctaText}</span>
                  </a>
                ) : (
                  <Link href={slide.ctaLink} onClick={(e) => handleCtaClick(e, slide.authView)} className={`btn-liquid btn-signup-beam ${slide.mobileCta ? 'hidden sm:inline-block' : 'inline-block'} text-white font-bold py-2.5 px-6 sm:py-3 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-base`}>
                    <span className="btn-liquid-content">{slide.ctaText}</span>
                  </Link>
                )}
                {slide.mobileCta && (
                  <Link
                    href={slide.mobileCta.link}
                    onClick={(e) => handleCtaClick(e, slide.authView)}
                    className="btn-liquid btn-signup-beam sm:hidden inline-block text-white font-bold py-2.5 px-6 rounded-xl text-sm"
                  >
                    <span className="btn-liquid-content">{slide.mobileCta.text}</span>
                  </Link>
                )}
                {slide.ctaSecondary && (
                  <Link
                    href={slide.ctaSecondary.link}
                    onClick={(e) => handleCtaClick(e, slide.authView)}
                    className="hidden sm:inline-block ml-3 align-top py-2.5 px-6 sm:py-3 sm:px-7 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold text-white border border-white/30 hover:bg-white/10 transition-colors"
                  >
                    {slide.ctaSecondary.text}
                  </Link>
                )}
              </motion.div>
            </div>

            {/* 3D Girl Image (Right side) */}
            <motion.div 
              key={`img-${slide.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ willChange: 'transform, opacity' }}
              className={`absolute bottom-0 ${slide.premium ? slide.imageBox : 'top-0 right-0 w-[45%] sm:w-[48%] lg:w-[50%]'} z-10 flex items-end justify-end pointer-events-none`}
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
                style={slide.premium ? (slide.edgeFade ? {
                  willChange: 'transform',
                  WebkitMaskImage: PREMIUM_MASK,
                  maskImage: PREMIUM_MASK,
                  WebkitMaskComposite: 'source-in, source-in',
                  maskComposite: 'intersect, intersect'
                } : { willChange: 'transform' }) : !slide.isTransparent ? {
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
                  className={`${slide.isTransparent ? 'object-contain object-bottom' : 'object-cover object-top'} ${slide.premium ? 'drop-shadow-[0_12px_32px_rgba(0,0,0,0.65)]' : ''}`}
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

        {/* Slide indicators — on phones they sit centred along the bottom edge (below the CTA button); from sm up they
            stay at the bottom-left as before. Each button has extra padding so it is easy to tap. */}
        <div className="flex absolute bottom-0.5 left-5 sm:bottom-4 sm:left-10 lg:left-12 z-30 items-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
              className="py-2.5 px-0.5"
            >
              <span
                className={`block transition-all duration-300 rounded-full h-1 ${
                  i === current ? 'w-8 bg-yellow-400' : 'w-4 bg-white/30 hover:bg-white/60'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
