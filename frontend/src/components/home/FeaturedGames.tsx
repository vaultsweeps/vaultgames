'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Download, Star, ChevronRight, Gamepad2 } from 'lucide-react'

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
}

export default function FeaturedGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await publicApi.getFeaturedGames()
        setGames(res.data.data)
      } catch (err) {
        console.error('Failed to fetch featured games', err)
      } finally {
        setLoading(false)
      }
    }
    fetchGames()
  }, [])
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Featured</p>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-white">
              TOP <span className="gradient-text">GAMES</span>
            </h2>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Link href="/games" className="btn-neon text-xs flex items-center gap-2">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-10 text-slate-500">Loading games...</div>
          ) : games.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-500">No games found.</div>
          ) : games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -5 }}
              className="glass-card overflow-hidden group cursor-pointer"
            >
              {/* Game thumbnail */}
              <div className={`h-48 bg-gradient-to-br ${COLORS[i % COLORS.length]} relative overflow-hidden`}>
                <div className="absolute inset-0 cyber-grid opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {game.thumbnailUrl ? (
                    <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <Gamepad2 className="w-16 h-16 text-white/20 group-hover:text-white/40 transition-all group-hover:scale-110 duration-300" />
                  )}
                </div>
                {game.isFeatured && (
                  <div className="absolute top-3 left-3 bg-neon-blue/20 border border-neon-blue/40 rounded-full px-2 py-0.5 text-xs font-mono text-neon-blue">
                    FEATURED
                  </div>
                )}
                <div className="absolute top-3 right-3 glass rounded-full px-2 py-0.5 text-xs text-slate-400 border border-white/10">
                  {game.category}
                </div>
              </div>

              {/* Game info */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display font-bold text-white text-sm group-hover:text-neon-blue transition-colors">{game.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-yellow-400 ml-2">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{game.rating}</span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">{game.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Download className="w-3 h-3" />
                    {(game.downloadCount / 1000).toFixed(0)}K downloads
                  </div>
                  <span className="text-xs font-mono text-neon-blue/60">v{game.version}</span>
                </div>
              </div>

              <div className="px-5 pb-5">
                <Link href={`/games/${game.id}`} className="btn-neon text-xs w-full text-center block py-2">
                  View & Download
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
