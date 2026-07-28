'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, Gamepad2 } from 'lucide-react'
import Image from 'next/image'
import Loader from '@/components/ui/Loader'

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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full py-16 flex justify-center"><Loader fullScreen={false} /></div>
          ) : games.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted">No games found.</div>
          ) : games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
              whileHover={{ y: -5, scale: 1.02 }}
              style={{ willChange: 'transform' }}
              className="relative aspect-square rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden group cursor-pointer shadow-lg bg-surface"
            >
              <Link href={`/games/${game.id}`} className="absolute inset-0 z-20" aria-label={game.name}></Link>
              
              {/* Game thumbnail */}
              <div className={`absolute inset-0 bg-gradient-to-br ${COLORS[i % COLORS.length]}`}>
                {game.thumbnailUrl && !imgErrors[game.id] ? (
                  <Image
                    src={game.thumbnailUrl}
                    alt={game.name}
                    fill
                    unoptimized={game.thumbnailUrl.startsWith('http')}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                    onError={() => setImgErrors(prev => ({ ...prev, [game.id]: true }))}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="w-16 h-16 text-white/20 group-hover:text-white/40 transition-all duration-300" />
                  </div>
                )}
              </div>
              {/* Inner gradient for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

              {/* Badges */}
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-30 pointer-events-none">
                {game.isFeatured && (
                  <span className="text-[10px] font-mono font-bold text-neon-blue bg-neon-blue/10 border border-neon-blue/30 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-lg">
                    FEATURED
                  </span>
                )}
                {!game.providerId && (
                  <span className="ml-auto text-[10px] font-bold text-violet-200 bg-violet-600/40 border border-violet-500/40 px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-lg">
                    🤖 Agent
                  </span>
                )}
              </div>

              {/* Game info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between z-10">
                <h3 className="font-display font-bold text-white text-lg sm:text-xl drop-shadow-md truncate">{game.name}</h3>
                

              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-center">
           <Link href="/games" className="glass px-8 py-3 rounded-full text-sm font-bold text-secondary hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2">
             View All Games <ChevronRight className="w-4 h-4" />
           </Link>
        </div>
      </div>
    </section>
  )
}
