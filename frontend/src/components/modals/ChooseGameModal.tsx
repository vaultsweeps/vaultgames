import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Banknote } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { providerApi } from '@/lib/api'

interface ChooseGameModalProps {
  isOpen: boolean
  onClose: () => void
}

interface GameAccount {
  id: string
  name: string
  thumbnailUrl: string | null
  accountName: string | null
  balance: number
  hasAccount: boolean
}

export default function ChooseGameModal({ isOpen, onClose }: ChooseGameModalProps) {
  const router = useRouter()
  const [games, setGames] = useState<GameAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      fetchGames()
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const fetchGames = async () => {
    setLoading(true)
    try {
      const res = await providerApi.getAllAccounts()
      if (res.data?.data) {
        setGames(res.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch game accounts', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const myGames = games.filter(g => g.hasAccount)
  const otherGames = games.filter(g => !g.hasAccount)

  const handleGameClick = (id: string) => {
    onClose()
    router.push(`/games/${id}`)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 pb-4 flex justify-between items-center sticky top-0 bg-background z-10 border-b border-border-subtle">
            <h2 className="text-white font-bold text-2xl">Choose Game</h2>
            <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors -mr-2">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="w-8 h-8 border-2 border-[#2AC3FF]/30 border-t-[#2AC3FF] rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {/* My Games */}
                {myGames.length > 0 && (
                  <div className="space-y-2">
                    {myGames.map(game => (
                      <div 
                        key={game.id} 
                        onClick={() => handleGameClick(game.id)}
                        className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-subtle hover:bg-surface-elevated transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/50 shrink-0">
                            {game.thumbnailUrl ? (
                              <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted font-bold text-xs">{game.name.slice(0, 3).toUpperCase()}</div>
                            )}
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg leading-tight">{game.name}</h3>
                            <p className="text-muted text-sm font-mono mt-0.5">{game.accountName}</p>
                          </div>
                        </div>
                        <div>
                          {game.balance > 0 ? (
                            <div className="bg-[#2AC3FF] text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold shadow-[0_0_15px_rgba(42,195,255,0.3)]">
                              <Banknote className="w-4 h-4" />
                              ${game.balance.toFixed(2)}
                            </div>
                          ) : (
                            <div className="bg-transparent border border-white/20 text-white px-4 py-1.5 rounded-full font-bold">
                              $0
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Other Games */}
                {otherGames.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-center mb-4">
                      <div className="h-px bg-white/5 flex-1"></div>
                      <span className="px-4 text-slate-600 text-xs font-bold tracking-widest uppercase">Other Games</span>
                      <div className="h-px bg-white/5 flex-1"></div>
                    </div>
                    <div className="space-y-2">
                      {otherGames.map(game => (
                        <div 
                          key={game.id} 
                          onClick={() => handleGameClick(game.id)}
                          className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-subtle hover:bg-surface-elevated transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/50 shrink-0">
                              {game.thumbnailUrl ? (
                                <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted font-bold text-xs">{game.name.slice(0, 3).toUpperCase()}</div>
                              )}
                            </div>
                            <div>
                              <h3 className="text-white font-bold text-lg leading-tight">{game.name}</h3>
                            </div>
                          </div>
                          <div>
                            <button className="bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white px-6 py-2 rounded-xl font-bold transition-colors">
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
