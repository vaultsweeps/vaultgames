'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gamepad2, Download, Search, Star, Eye, RefreshCw, Bot, Copy, RefreshCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { gamesApi, publicApi } from '@/lib/api'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Badge, Button, buttonClass, Card, cn, EmptyState, IconTile, PageHeader, Skeleton, TONES } from '@/components/dashboard/ui'

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
  const [downloadCode, setDownloadCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  const fetchGames = async () => {
    setLoading(true)
    try {
      const [gamesRes, settingsRes] = await Promise.all([
        gamesApi.getAll(),
        publicApi.getSettings().catch(() => ({ data: { data: {} } })),
      ])

      const fetchedGames = gamesRes.data.data || []

      // Inject thumbnails for specific games
      const processedGames = fetchedGames.map((game: Game) => {
        const lowerName = game.name.toLowerCase()
        if (lowerName.includes('panda master') || lowerName.includes('pandamaster')) {
          return { ...game, thumbnailUrl: '/image.png' }
        }
        if (lowerName.includes('riversweeps') || lowerName.includes('river sweeps')) {
          return { ...game, thumbnailUrl: '/images/river.png' }
        }
        return game
      })

      setGames(processedGames)
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

  const handleGenerateDownloadCode = async (game: Game) => {
    setGeneratingCode(true)
    setDownloadCode(null)
    try {
      const res = await gamesApi.generateDownloadCode(game.id)
      const code = res.data.data?.downloadCode
      if (code) {
        setDownloadCode(code)
      } else {
        toast.error('No download code returned')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate download code')
    } finally {
      setGeneratingCode(false)
    }
  }

  const hasProvider = (game: Game) => !!game.providerId

  // Presentation only: some versions already carry a leading "v".
  const formatVersion = (v: string) => (/^v/i.test(v) ? v : `v${v}`)

  const cardBtn = (variant: 'primary' | 'secondary') =>
    cn(buttonClass({ variant, size: 'sm' }), '!h-11 flex-1 min-w-0 !px-2 !text-[14px] !gap-1.5')

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Games Library"
        subtitle="Browse and download all available games."
        className="!mb-0"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchGames}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {/* Search & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            inputMode="search"
            aria-label="Search games"
            placeholder="Search games..."
            value={search}
            onChange={handleSearchChange}
            className="ds-input !pl-11 !text-[16px]"
          />
        </div>
        <div
          role="group"
          aria-label="Filter by category"
          className="flex gap-2 min-w-0 max-w-full overflow-x-auto snap-x snap-proximity sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.slice(0, 6).map(cat => {
            const on = category === cat
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  'snap-start flex-shrink-0 h-10 px-4 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                  on ? 'text-white shadow-[0_6px_18px_-8px_rgba(59,130,246,0.7)]' : 'bg-surface-elevated border border-border-subtle text-secondary hover:text-primary hover:border-border-strong'
                )}
                style={on ? { background: 'var(--ds-accent)' } : undefined}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: TONES.cyan.fg }} />
          Online Play (Provider)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: TONES.purple.fg }} />
          Agent-Assisted Play
        </span>
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5" aria-busy="true">
          {[1,2,3,4,5,6,7,8].map(i => (
            <Card key={i} padded={false} className="overflow-hidden">
              <Skeleton className="!rounded-none aspect-[16/10] w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4 !rounded-lg" />
                <Skeleton className="h-3.5 w-full !rounded-lg" />
                <Skeleton className="h-3.5 w-2/3 !rounded-lg" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-11 flex-1 !rounded-2xl" />
                  <Skeleton className="h-11 flex-1 !rounded-2xl" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gamepad2}
            title="No games found"
            text={games.length === 0 ? 'No games available yet.' : 'No games match your search.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {visibleGames.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i % 12) * 0.03 }} className="min-w-0">
              <Card padded={false} className="group h-full flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
                {/* Thumbnail */}
                <div className={`aspect-[16/10] w-full bg-gradient-to-br ${COLORS[i % COLORS.length]} relative overflow-hidden flex-shrink-0`}>
                  {game.thumbnailUrl ? (
                    <Image src={game.thumbnailUrl} alt={game.name} fill loading="lazy" sizes="(max-width: 559px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconTile icon={Gamepad2} tone="blue" size="lg" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(6,9,18,0.55), transparent)' }} />
                  {game.isFeatured && (
                    <span className="absolute top-2.5 left-2.5 rounded-full" style={{ background: 'rgba(6,9,18,0.68)' }}>
                      <Badge tone="gold" className="!text-[11px] !px-2.5 !py-1.5">Featured</Badge>
                    </span>
                  )}
                  {/* Provider badge */}
                  <span className="absolute top-2.5 right-2.5 max-w-[55%] rounded-full flex" style={{ background: 'rgba(6,9,18,0.68)' }}>
                    {hasProvider(game) ? (
                      <Badge tone="cyan" className="!text-[11px] !px-2.5 !py-1.5 min-w-0 max-w-full"><span className="truncate">{game.category}</span></Badge>
                    ) : (
                      <Badge tone="purple" className="!text-[11px] !px-2.5 !py-1.5"><Bot className="w-3 h-3" /> Agent</Badge>
                    )}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-primary text-[16px] sm:text-[17px] font-semibold leading-snug tracking-tight line-clamp-2 break-words min-w-0">{game.name}</h3>
                    {game.rating > 0 && (
                      <div className="flex items-center gap-1 text-[13px] sm:text-[14px] font-semibold flex-shrink-0 mt-0.5 tabular-nums" style={{ color: 'var(--ds-gold)' }}>
                        <Star className="w-3.5 h-3.5 fill-current" />{Number(game.rating).toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p className="text-secondary text-[14px] leading-relaxed mt-1.5 line-clamp-2 flex-1">{game.description || 'No description available.'}</p>
                  <div className="flex items-center justify-between gap-3 text-[13px] text-muted mt-3 mb-4">
                    <span className="flex items-center gap-1.5 tabular-nums"><Download className="w-3.5 h-3.5" />{game.downloadCount > 999 ? `${(game.downloadCount/1000).toFixed(0)}K` : game.downloadCount}</span>
                    {game.version && <span className="tabular-nums truncate">{formatVersion(game.version)}</span>}
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/games/${game.id}`} className={cardBtn('secondary')}>
                      <Eye className="w-4 h-4 flex-shrink-0" /> Details
                    </Link>
                    <button
                      onClick={() => handleDownload(game)}
                      disabled={downloading === game.id || !game.downloadUrl}
                      className={cardBtn('primary')}>
                      {downloading === game.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <><Download className="w-4 h-4 flex-shrink-0" /> Get</>}
                    </button>
                    {!hasProvider(game) && (
                      <button
                        onClick={() => setAgentGame(game)}
                        className={cardBtn('secondary')}
                        style={{ background: TONES.purple.bg, color: TONES.purple.fg, borderColor: TONES.purple.ring }}
                      >
                        <Bot className="w-4 h-4 flex-shrink-0" /> Play
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && visibleCount < filtered.length && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="secondary" onClick={() => setVisibleCount(v => v + 12)} className="min-w-[200px]">
            Load More Games
          </Button>
          <p className="text-[13px] text-muted tabular-nums">Showing {visibleGames.length} of {filtered.length}</p>
        </div>
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedGame(null); setDownloadCode(null); }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className={`h-40 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl mb-5 relative overflow-hidden`}>
              {selectedGame.thumbnailUrl
                ? <Image src={selectedGame.thumbnailUrl} alt={selectedGame.name} fill className="object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center"><Gamepad2 className="w-16 h-16 text-white/30" /></div>
              }
            </div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-xl text-primary">{selectedGame.name}</h3>
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
            {/* Generate Download Code section (Orionstar only) */}
            {selectedGame.downloadUrl && (
              <div className="mb-4">
                {downloadCode ? (
                  <div className="glass rounded-xl p-4 border border-neon-blue/20 text-center">
                    <p className="text-xs text-secondary mb-1">Download code</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl font-bold text-primary tracking-widest font-mono">{downloadCode}</span>
                      <button onClick={() => { navigator.clipboard.writeText(downloadCode); toast.success('Code copied!'); }}
                        className="text-secondary hover:text-primary transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => handleGenerateDownloadCode(selectedGame)}
                    disabled={generatingCode}
                    className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                    {generatingCode ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Generate download code
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1 flex gap-2">
                <button onClick={() => handleDownload(selectedGame)} disabled={downloading === selectedGame.id || !selectedGame.downloadUrl}
                  className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {downloading === selectedGame.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-4 h-4" /> Download</>}
                </button>
                {!hasProvider(selectedGame) && (
                  <button onClick={() => { setSelectedGame(null); setAgentGame(selectedGame); }}
                    className="flex-1 py-3 text-sm flex items-center justify-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-all font-medium">
                    <Bot className="w-4 h-4" /> Play with Agent
                  </button>
                )}
              </div>
              <button onClick={() => { setSelectedGame(null); setDownloadCode(null); }} className="glass px-5 py-3 rounded-xl text-secondary hover:text-primary border border-border-strong transition-all text-sm">Close</button>
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
