'use client'
import { useState, useEffect, useCallback, memo } from 'react'
import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'
import Image from 'next/image'
import { useAuthStore } from '@/store/authStore'
import { useShallow } from 'zustand/react/shallow'

import { publicApi } from '@/lib/api'

const COLORS = ['from-blue-600/20 to-cyan-600/20', 'from-purple-600/20 to-pink-600/20', 'from-green-600/20 to-teal-600/20', 'from-orange-600/20 to-red-600/20', 'from-indigo-600/20 to-blue-600/20', 'from-yellow-600/20 to-orange-600/20']

interface Game {
  id: string
  name: string
  category: string
  version: string
  downloadCount: number
  rating: number
  thumbnailUrl: string | null
  isFeatured: boolean
  description: string
  providerId: string | null
}

// ─── Data loading: one shared request, memory + session cache ─────────────────
// Every mount (home, /games, coming back via the nav) shares the same list, so navigating away and
// returning never re-fetches or re-creates the cards, and two mounts never fire two requests.
const CACHE_KEY = 'vs_featured_games'
const CACHE_TTL = 5 * 60 * 1000
let gamesCache: { data: Game[]; ts: number } | null = null
let inflight: Promise<Game[]> | null = null

const freshMemo = () => (gamesCache && Date.now() - gamesCache.ts < CACHE_TTL ? gamesCache.data : null)

function loadFeaturedGames(): Promise<Game[]> {
  const fresh = freshMemo()
  if (fresh) return Promise.resolve(fresh)
  if (inflight) return inflight

  // Serve from session cache for 5 min — avoids re-fetching on homepage revisit
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL) {
        gamesCache = { data, ts }
        return Promise.resolve(data)
      }
    }
  } catch (_) {}

  inflight = (async () => {
    const res = await publicApi.getFeaturedGames()
    let fetched: Game[] = res.data.data || []

    // Inject thumbnails for specific games
    fetched = fetched.map((game: Game) => {
      const lowerName = game.name.toLowerCase()
      if (lowerName.includes('panda master') || lowerName.includes('pandamaster')) {
        return { ...game, thumbnailUrl: '/image.png' }
      }
      if (lowerName.includes('riversweeps') || lowerName.includes('river sweeps')) {
        return { ...game, thumbnailUrl: '/images/river.png' }
      }
      return game
    })

    const sorted = fetched.sort((a: Game, b: Game) => (b.providerId ? 1 : 0) - (a.providerId ? 1 : 0))
    gamesCache = { data: sorted, ts: Date.now() }
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: sorted, ts: gamesCache.ts }))
    } catch (_) {}
    return sorted
  })().finally(() => { inflight = null })

  return inflight
}

// Cards above the fold load eagerly; everything else is lazy.
const EAGER_COUNT = 4
const SKELETON_COUNT = 10
const CARD_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, (max-width: 1800px) 20vw, 340px'

function SkeletonCard() {
  return (
    <div className="relative aspect-[4/5] lg:aspect-[7/9] rounded-[22px] lg:rounded-[26px] overflow-hidden border border-white/5 gc-shimmer" aria-hidden>
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 lg:p-6">
        <div className="h-4 w-2/3 rounded-full bg-white/10" />
      </div>
    </div>
  )
}

/**
 * One game card. Owns its own image-loaded state, so an image finishing (or failing) re-renders only
 * this card — never the whole grid. The card box has a fixed aspect ratio, so nothing shifts while
 * images load.
 */
const GameCard = memo(function GameCard({ game, index, onClick }: { game: Game; index: number; onClick: (e: React.MouseEvent) => void }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const hasImage = !!game.thumbnailUrl && !failed
  const eager = index < EAGER_COUNT

  return (
    <div className="relative group">
      <div
        className={`relative aspect-[4/5] lg:aspect-[7/9] rounded-[22px] lg:rounded-[26px] overflow-hidden cursor-pointer bg-[#10141d] border border-white/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out active:scale-[0.98] [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:shadow-[0_18px_40px_-12px_rgba(99,102,241,0.45)] ${hasImage && !loaded ? 'gc-shimmer' : ''}`}
        style={{ contain: 'layout paint style' }}
      >
        <Link href={`/games/${game.name.toLowerCase().replace(/[\s_.-]+/g, '')}`} onClick={onClick} className="absolute inset-0 z-20" aria-label={game.name}></Link>

        {/* Game thumbnail — fades/settles in once decoded */}
        <div className="absolute inset-0 bg-[#0a0a0a]">
          {hasImage ? (
            <Image
              src={game.thumbnailUrl as string}
              alt={game.name}
              fill
              sizes={CARD_SIZES}
              priority={eager}
              // Thumbnails are an admin-typed URL from an arbitrary CDN/blog host, so they are never valid
              // targets for Next's image optimizer allowlist — render the original file directly instead.
              unoptimized={(game.thumbnailUrl as string).startsWith('http')}
              draggable={false}
              className={`object-cover saturate-[1.15] contrast-[1.05] transition-[opacity,transform] duration-500 ease-out [@media(hover:hover)]:group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${COLORS[index % COLORS.length]}`}>
              <Gamepad2 className="w-12 h-12 text-white/40" />
            </div>
          )}
        </div>

        {/* Dark only at the very bottom for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/95 via-black/10 to-transparent opacity-90 pointer-events-none"></div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-30 pointer-events-none">
          {!game.providerId && (
            <span className="ml-auto text-[10px] font-bold text-violet-100 bg-violet-600/80 border border-violet-400/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_12px_rgba(139,92,246,0.4)]">
              🤖 Agent
            </span>
          )}
        </div>

        {/* Game info overlay (bottom left, flush text) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 lg:p-6 flex items-end justify-between z-10">
          <h3 className="font-sans font-bold text-white text-[16px] sm:text-[18px] lg:text-[19px] 2xl:text-[21px] tracking-tight truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {game.name}
          </h3>
        </div>
      </div>
    </div>
  )
})

export default function FeaturedGames() {
  // On client-side navigation the list is already in memory → render cards immediately, no skeleton.
  const [games, setGames] = useState<Game[]>(() => freshMemo() ?? [])
  const [loading, setLoading] = useState(() => !freshMemo())

  const { isAuthenticated, openAuthModal } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      openAuthModal: state.openAuthModal
    }))
  )

  const handleGameClick = useCallback((e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
    }
  }, [isAuthenticated, openAuthModal])

  useEffect(() => {
    let alive = true // ignore the result if the user already navigated away
    loadFeaturedGames()
      .then(list => { if (alive) setGames(list) })
      .catch(err => { console.error('Failed to fetch featured games', err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <section className="py-8">
      <div className="max-w-7xl lg:max-w-[1824px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex items-center justify-start gap-3 mb-6">
          <Gamepad2 className="w-8 h-8 text-cyan-400" />
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Our games
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-5 2xl:gap-6">
          {loading ? (
            Array.from({ length: SKELETON_COUNT }, (_, i) => <SkeletonCard key={i} />)
          ) : games.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted">No games found.</div>
          ) : games.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} onClick={handleGameClick} />
          ))}
        </div>
      </div>
    </section>
  )
}
