'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Star, Download, Gamepad2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'
import Loader from '@/components/ui/Loader'

const EMPTY_GAME = { name: '', category: 'Action', version: '1.0.0', description: '', requirements: '', instructions: '', downloadUrl: '', isActive: true, isFeatured: false, rating: 4.5 }
const CATEGORIES = ['Action', 'Strategy', 'Racing', 'Stealth', 'Fighting', 'Puzzle', 'RPG', 'Sports', 'Simulation']

interface Game {
  id: string
  name: string
  category: string
  version: string
  downloadCount: number
  rating: number
  isActive: boolean
  isFeatured: boolean
  downloadUrl: string | null
  description?: string
  requirements?: string
  instructions?: string
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchGames = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getGames()
      setGames(res.data.data)
    } catch (err: any) {
      toast.error('Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGames() }, [])

  const handleSave = async () => {
    if (!editing?.name) return toast.error('Game name is required')
    setSaving(true)
    try {
      const payload = {
        name: editing.name,
        category: editing.category || 'Action',
        version: editing.version || '1.0.0',
        description: editing.description || '',
        downloadUrl: editing.downloadUrl || '',
        thumbnailUrl: editing.thumbnailUrl || '',
        requirements: editing.requirements || '',
        instructions: editing.instructions || '',
        rating: editing.rating || 4.5,
        isActive: editing.isActive !== false,
        isFeatured: editing.isFeatured === true,
      }
      if (isNew) {
        await adminApi.createGame(payload)
        toast.success('Game created!')
      } else {
        await adminApi.updateGame(editing.id, payload)
        toast.success('Game updated!')
      }
      await fetchGames()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save game')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this game?')) return
    try {
      await adminApi.deleteGame(id)
      toast.success('Game deleted')
      setGames(prev => prev.filter(g => g.id !== id))
    } catch (err: any) {
      toast.error('Failed to delete game')
    }
  }

  const toggleActive = async (game: Game) => {
    try {
      const formData = new FormData()
      formData.append('isActive', String(!game.isActive))
      await adminApi.updateGame(game.id, formData)
      setGames(prev => prev.map(g => g.id === game.id ? { ...g, isActive: !g.isActive } : g))
    } catch {
      toast.error('Failed to update game status')
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">GAMES MANAGEMENT</h2>
          <p className="text-secondary text-sm">Manage your games library and downloads.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchGames} className="glass border border-border-strong rounded-xl px-3 py-2.5 text-secondary hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing({ ...EMPTY_GAME }); setIsNew(true) }} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> Add Game
          </button>
        </div>
      </motion.div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Game</th><th>Category</th><th>Version</th><th>Downloads</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader fullScreen={false} /></td></tr>
              ) : games.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted">No games yet. Add your first game!</td></tr>
              ) : games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-4 h-4 text-neon-blue/60" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{game.name}</p>
                        {game.isFeatured && <span className="text-xs text-neon-blue/70 font-mono">★ FEATURED</span>}
                      </div>
                    </div>
                  </td>
                  <td className="text-secondary text-sm">{game.category}</td>
                  <td className="font-mono text-xs text-neon-blue/70">v{game.version}</td>
                  <td>
                    <span className="flex items-center gap-1 text-sm text-secondary">
                      <Download className="w-3 h-3 text-muted" />
                      {(game.downloadCount / 1000).toFixed(1)}K
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-1 text-sm text-yellow-400">
                      <Star className="w-3 h-3 fill-current" />
                      {game.rating}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${game.isActive ? 'badge-approved' : 'badge-rejected'}`}>
                      {game.isActive ? 'ACTIVE' : 'HIDDEN'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(game)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${game.isActive ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-muted glass border-border-strong hover:text-white'}`}>
                        {game.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditing({ ...game }); setIsNew(false) }}
                        className="w-7 h-7 glass rounded-lg flex items-center justify-center text-secondary hover:text-neon-blue border border-border-strong transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(game.id)}
                        className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-bold text-xl text-white mb-5">{isNew ? 'ADD GAME' : 'EDIT GAME'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Game Name *</label>
                  <input type="text" placeholder="CyberStrike Elite" value={editing.name || ''} onChange={e => setEditing((p: any) => ({ ...p, name: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Category</label>
                  <select value={editing.category || 'Action'} onChange={e => setEditing((p: any) => ({ ...p, category: e.target.value }))} className="input-neon bg-surface">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Version</label>
                  <input type="text" placeholder="1.0.0" value={editing.version || ''} onChange={e => setEditing((p: any) => ({ ...p, version: e.target.value }))} className="input-neon" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Description</label>
                <textarea rows={3} placeholder="Game description..." value={editing.description || ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} className="input-neon resize-none" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Download URL</label>
                <input type="url" placeholder="https://..." value={editing.downloadUrl || ''} onChange={e => setEditing((p: any) => ({ ...p, downloadUrl: e.target.value }))} className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Thumbnail URL</label>
                <input type="url" placeholder="https://..." value={editing.thumbnailUrl || ''} onChange={e => setEditing((p: any) => ({ ...p, thumbnailUrl: e.target.value }))} className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">System Requirements</label>
                <input type="text" placeholder="Windows 10, 8GB RAM..." value={editing.requirements || ''} onChange={e => setEditing((p: any) => ({ ...p, requirements: e.target.value }))} className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Installation Instructions</label>
                <input type="text" placeholder="Download, extract, run setup.exe" value={editing.instructions || ''} onChange={e => setEditing((p: any) => ({ ...p, instructions: e.target.value }))} className="input-neon" />
              </div>
              <div className="flex gap-6">
                {[['isActive', 'Active'], ['isFeatured', 'Featured']].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <button onClick={() => setEditing((p: any) => ({ ...p, [key]: !p[key] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${editing[key] ? 'bg-neon-blue' : 'bg-dark-500'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editing[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-secondary">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span> : 'Save Game'}
              </button>
              <button onClick={() => setEditing(null)} className="glass flex-1 py-2.5 rounded-xl text-secondary border border-border-strong text-sm hover:text-white transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
