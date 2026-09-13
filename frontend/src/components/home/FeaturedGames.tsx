'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, Gamepad2 } from 'lucide-react'
import Image from 'next/image'
import Loader from '@/components/ui/Loader'
import { useAuthStore } from '@/store/authStore'

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

export default function FeaturedGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const { isAuthenticated, openAuthModal } = useAuthStore()

  const handleGameClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      openAuthModal('login')
    }
  }

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await publicApi.getFeaturedGames()
        const sortedGames = res.data.data.sort((a: Game, b: Game) => (b.providerId ? 1 : 0) - (a.providerId ? 1 : 0))
        setGames(sortedGames)
      } catch (err) {
        console.error('Failed to fetch featured games', err)
      } finally {
        setLoading(false)
      }
    }
    fetchGames()
  }, [])
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start gap-3 mb-6">
          <Gamepad2 className="w-8 h-8 text-cyan-400" />
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Our games
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {loading ? (
            <div className="col-span-full py-16 flex justify-center"><Loader fullScreen={false} /></div>
          ) : games.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted">No games found.</div>
          ) : games.map((game, i) => (
            <div key={game.id} className="relative group perspective-1000">
              {/* Premium Ambient Colored Glow behind the card */}
              <div className={`absolute -inset-1.5 bg-gradient-to-br ${COLORS[i % COLORS.length].replace('/20', '').replace('/20', '')} opacity-0 group-hover:opacity-30 blur-xl rounded-[2.5rem] transition-opacity duration-700 pointer-events-none z-0`}></div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                whileHover={{ y: -8, scale: 1.03 }}
                style={{ willChange: 'transform' }}
                className="relative z-10 aspect-[4/5] rounded-[22px] overflow-hidden cursor-pointer bg-[#10141d] border border-white/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,1)] transition-all duration-500 ease-out"
              >
                <Link href={`/games/${game.name.toLowerCase().replace(/[\s_.-]+/g, '')}`} onClick={handleGameClick} className="absolute inset-0 z-20" aria-label={game.name}></Link>
                
                {/* Game thumbnail - Brighter & More Saturated */}
                <div className="absolute inset-0 bg-[#0a0a0a]">
                  {game.thumbnailUrl && !imgErrors[game.id] ? (
                    <Image
                      src={game.thumbnailUrl}
                      alt={game.name}
                      width={400}
                      height={500}
                      unoptimized={game.thumbnailUrl.startsWith('http')}
                      className="w-full h-full object-cover saturate-[1.15] contrast-[1.05] group-hover:saturate-[1.3] group-hover:brightness-110 group-hover:scale-110 transition-all duration-700 ease-out"
                      onError={() => setImgErrors(prev => ({ ...prev, [game.id]: true }))}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${COLORS[i % COLORS.length]}`}>
                      <Gamepad2 className="w-12 h-12 text-white/40 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  )}
                </div>
                
                {/* Refined gradient overlay - Only dark at the very bottom for text legibility, transparent above */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent h-[60%] top-auto group-hover:from-black opacity-90 transition-opacity duration-500"></div>

                {/* Top Badges - Premium styling */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-30 pointer-events-none">
                  {game.isFeatured && (
                    <span className="text-[10px] font-black tracking-widest text-white bg-gradient-to-r from-orange-500 to-red-600 px-2.5 py-1 rounded-md shadow-[0_0_12px_rgba(239,68,68,0.5)] border border-white/20">
                      HOT
                    </span>
                  )}
                  {!game.providerId && (
                    <span className="ml-auto text-[10px] font-bold text-violet-100 bg-violet-600/80 border border-violet-400/50 px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-[0_0_12px_rgba(139,92,246,0.4)]">
                      🤖 Agent
                    </span>
                  )}
                </div>

                {/* Game info overlay (bottom left, flush text) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between z-10">
                  <h3 className="font-sans font-bold text-white text-[16px] sm:text-[18px] tracking-tight truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {game.name}
                  </h3>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
