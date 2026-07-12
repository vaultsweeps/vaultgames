'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, Download, Search, Star, Eye, RefreshCw, Bot, X, MessageCircle, Send, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { gamesApi, publicApi } from '@/lib/api'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const PlayWithAgentModal = dynamic(() => import('@/components/modals/PlayWithAgentModal'), { ssr: false })


const COLORS = [
  'from-blue-600/20 to-cyan-600/20',
  'from-purple-600/20 to-pink-600/20',
  'from-green-600/20 to-teal-600/20',
  'from-orange-600/20 to-red-600/20',
  'from-indigo-600/20 to-blue-600/20',
  'from-yellow-600/20 to-orange-600/20',
  'from-pink-600/20 to-rose-600/20',
  'from-teal-600/20 to-cyan-600/20'
]

interface Game {
  id: string
  name: string
  category: string
  version: string
  downloadCount: number
  rating: number
  description: string
  thumbnailUrl: string | null
  downloadUrl: string | null
  isFeatured: boolean
  isActive: boolean
  providerId: string | null
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [agentGame, setAgentGame] = useState<Game | null>(null)
  const [settings, setSettings] = useState<any>({})
  const [visibleCount, setVisibleCount] = useState(12)

  const fetchGames = async () => {
    setLoading(true)
    try {
      const [gamesRes, settingsRes] = await Promise.all([
        gamesApi.getAll(),
        publicApi.getSettings().catch(() => ({ data: { data: {} } })),
      ])
      setGames(gamesRes.data.data || [])
      setSettings(settingsRes.data.data || {})
    } catch {
      toast.error('Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGames() }, [])

  const categories = ['All', ...Array.from(new Set(games.map(g => g.category).filter(Boolean)))]

  const filtered = games.filter(g =>
    (category === 'All' || g.category === category) &&
    (g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => (b.providerId ? 1 : 0) - (a.providerId ? 1 : 0))

  const visibleGames = filtered.slice(0, visibleCount)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setVisibleCount(12)
  }

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setVisibleCount(12)
  }

  const handleDownload = async (game: Game) => {
    setDownloading(game.id)
    try {
      const res = await gamesApi.download(game.id)
      const downloadUrl = res.data.data?.downloadUrl
      if (downloadUrl) {
        window.open(downloadUrl, '_blank')
        toast.success(`${game.name} download started!`)
      } else {
        toast.error('No download link available for this game yet.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const hasProvider = (game: Game) => !!game.providerId

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">GAMES LIBRARY</h2>
          <p className="text-secondary text-sm mt-1">Browse and download all available games.</p>
        </div>
        <button onClick={fetchGames} className="glass border border-border-strong rounded-xl px-3 py-2 text-secondary hover:text-white transition-all flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </motion.div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Search games..." value={search} onChange={handleSearchChange} className="input-neon pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.slice(0, 6).map(cat => (
            <button key={cat} onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${category === cat ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-secondary hover:text-white border border-border-strong'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neon-blue/70 inline-block" />
          Online Play (Provider)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400/70 inline-block" />
          Agent-Assisted Play
        </span>
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="glass-card h-64 animate-pulse">
              <div className="h-36 bg-white/5" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card py-16 text-center">
          <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-muted">{games.length === 0 ? 'No games available yet.' : 'No games match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleGames.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i % 12) * 0.04 }}
              className="glass-card overflow-hidden group hover:-translate-y-1 transition-all">
              {/* Thumbnail */}
              <div className={`h-36 bg-gradient-to-br ${COLORS[i % COLORS.length]} relative overflow-hidden`}>
                <div className="absolute inset-0 cyber-grid opacity-20" />
                {game.thumbnailUrl ? (
                  <Image src={game.thumbnailUrl} alt={game.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Gamepad2 className="w-12 h-12 text-white/20 group-hover:text-white/40 transition-colors" />
                  </div>
                )}
                {game.isFeatured && (
                  <span className="absolute top-2 left-2 text-xs font-mono text-neon-blue bg-neon-blue/10 border border-neon-blue/30 px-2 py-0.5 rounded-full">FEATURED</span>
                )}
                {/* Provider badge */}
                <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border font-medium ${
                  hasProvider(game)
                    ? 'text-neon-blue glass border-neon-blue/20'
                    : 'text-violet-300 bg-violet-500/10 border-violet-500/20'
                }`}>
                  {hasProvider(game) ? game.category : '🤖 Agent'}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-white text-sm font-bold leading-tight">{game.name}</h3>
                  {game.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-yellow-400 ml-2 flex-shrink-0">
                      <Star className="w-3 h-3 fill-current" />{game.rating}
                    </div>
                  )}
                </div>
                <p className="text-muted text-xs mb-3 line-clamp-2">{game.description || 'No description available.'}</p>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" />{game.downloadCount > 999 ? `${(game.downloadCount/1000).toFixed(0)}K` : game.downloadCount}</span>
                  {game.version && <span className="font-mono text-neon-blue/50">v{game.version}</span>}
                </div>

                <div className="flex gap-2">
                  <Link href={`/games/${game.id}`} className="btn-neon flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" /> Details
                  </Link>
                  <button
                    onClick={() => handleDownload(game)}
                    disabled={downloading === game.id || !game.downloadUrl}
                    className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1 disabled:opacity-50">
                    {downloading === game.id ? (
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    ) : <><Download className="w-3 h-3" /> Get</>}
                  </button>
                  {!hasProvider(game) && (
                    <button
                      onClick={() => setAgentGame(game)}
                      className="flex-1 text-xs py-1.5 flex items-center justify-center gap-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/40 transition-all font-medium"
                    >
                      <Bot className="w-3 h-3" /> Play
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && visibleCount < filtered.length && (
        <div className="flex justify-center mt-8">
          <button 
            onClick={() => setVisibleCount(v => v + 12)}
            className="glass px-6 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-white border border-border-strong transition-all hover:bg-white/5"
          >
            Load More Games
          </button>
        </div>
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedGame(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className={`h-40 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl mb-5 relative overflow-hidden`}>
              {selectedGame.thumbnailUrl
                ? <Image src={selectedGame.thumbnailUrl} alt={selectedGame.name} fill className="object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center"><Gamepad2 className="w-16 h-16 text-white/30" /></div>
              }
            </div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-display font-bold text-xl text-white">{selectedGame.name}</h3>
              {selectedGame.rating > 0 && <div className="flex items-center gap-1 text-yellow-400"><Star className="w-4 h-4 fill-current" /><span className="text-sm">{selectedGame.rating}</span></div>}
            </div>
            <div className="flex gap-2 mb-4">
              {selectedGame.category && <span className="text-xs glass px-2 py-1 rounded-lg text-secondary border border-border-strong">{selectedGame.category}</span>}
              {selectedGame.version && <span className="text-xs text-neon-blue/70 font-mono glass px-2 py-1 rounded-lg border border-neon-blue/10">v{selectedGame.version}</span>}
              {!hasProvider(selectedGame) && (
                <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Agent Play
                </span>
              )}
            </div>
            <p className="text-secondary text-sm leading-relaxed mb-5">{selectedGame.description || 'No description available.'}</p>
            <div className="flex gap-3">
              <div className="flex-1 flex gap-2">
                <button onClick={() => handleDownload(selectedGame)} disabled={downloading === selectedGame.id || !selectedGame.downloadUrl}
                  className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {downloading === selectedGame.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-4 h-4" /> Download Game</>}
                </button>
                {!hasProvider(selectedGame) && (
                  <button onClick={() => { setSelectedGame(null); setAgentGame(selectedGame); }}
                    className="flex-1 py-3 text-sm flex items-center justify-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-all font-medium">
                    <Bot className="w-4 h-4" /> Play with Agent
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedGame(null)} className="glass px-5 py-3 rounded-xl text-secondary hover:text-white border border-border-strong transition-all text-sm">Close</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Play with Agent Modal */}
      {agentGame && (
        <PlayWithAgentModal
          game={agentGame}
          onClose={() => setAgentGame(null)}
          settings={settings}
        />
      )}
    </div>
  )
}
