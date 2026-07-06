'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Activity, ShieldCheck, ShieldAlert, RefreshCw, Eye, Gamepad2, Check } from 'lucide-react'
import { adminApi } from '@/lib/api'

type Provider = any
type Game = { id: string; name: string; thumbnailUrl: string | null }

const EMPTY_PROVIDER = { name: '', apiBaseUrl: '', agentId: '', secretKey: '', status: true, requestTimeout: 5000, retryCount: 3 }

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [allGames, setAllGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const [pvRes, gmRes] = await Promise.all([
        adminApi.getProviders(),
        adminApi.getGames({ limit: 200 })
      ])
      setProviders(pvRes.data.data)
      setAllGames(gmRes.data.data || [])
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProviders() }, [])

  const openEdit = (provider: any) => {
    setEditing({ ...provider })
    setIsNew(false)
    setSelectedGameIds((provider.games || []).map((g: Game) => g.id))
  }

  const openNew = () => {
    setEditing({ ...EMPTY_PROVIDER })
    setIsNew(true)
    setSelectedGameIds([])
  }

  const toggleGame = (gameId: string) => {
    setSelectedGameIds(prev =>
      prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
    )
  }

  const handleSave = async () => {
    if (!editing?.name || !editing?.apiBaseUrl || !editing?.agentId || !editing?.secretKey) {
      return toast.error('Name, Base URL, Agent ID, and Secret Key are required')
    }
    setSaving(true)
    try {
      let providerId: string
      if (isNew) {
        const res = await adminApi.createProvider(editing)
        providerId = res.data.data.id
        toast.success('Provider created!')
      } else {
        await adminApi.updateProvider(editing.id, editing)
        providerId = editing.id
        toast.success('Provider updated!')
      }
      // Save game assignments
      await adminApi.assignProviderGames(providerId, selectedGameIds)
      await fetchProviders()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save provider')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await adminApi.updateProvider(id, { status: !currentStatus })
      await fetchProviders()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider? This will unlink all associated games.')) return
    try {
      await adminApi.deleteProvider(id)
      toast.success('Deleted')
      await fetchProviders()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const testConnection = async (id: string) => {
    const loadingToast = toast.loading('Testing connection...')
    try {
      const res = await adminApi.testProviderConnection(id)
      toast.success(`✓ Connected! Agent Balance: $${res.data.data.balance}`, { id: loadingToast })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Connection failed', { id: loadingToast })
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">PROVIDER MANAGEMENT</h2>
          <p className="text-secondary text-sm">Assign game providers and configure API credentials.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProviders} className="glass border border-border-strong rounded-xl px-3 py-2.5 text-secondary hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> Add Provider
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-1 lg:col-span-2 py-20 text-center text-muted">Loading providers...</div>
        ) : providers.length === 0 ? (
          <div className="col-span-1 lg:col-span-2 py-20 text-center text-muted">No providers configured yet</div>
        ) : providers.map((provider, i) => (
          <motion.div key={provider.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`glass-card p-5 relative overflow-hidden ${!provider.status ? 'opacity-60' : ''}`}>
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${provider.status ? 'bg-neon-blue' : 'bg-red-500'}`} />
            
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
                  {provider.name}
                  {provider.status ? <ShieldCheck className="w-4 h-4 text-green-400" /> : <ShieldAlert className="w-4 h-4 text-red-400" />}
                </h3>
                <p className="text-xs text-muted font-mono mt-0.5">{provider.apiBaseUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-sm text-secondary mb-4">
              <div><span className="text-muted block text-xs">Agent ID</span><span className="font-mono">{provider.agentId}</span></div>
              <div><span className="text-muted block text-xs">Status</span><span className={provider.status ? 'text-green-400' : 'text-red-400'}>{provider.status ? 'Active' : 'Disabled'}</span></div>
            </div>

            {/* Linked Games */}
            <div className="mb-4">
              <p className="text-xs text-muted mb-2 flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> Linked Games</p>
              {provider.games && provider.games.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {provider.games.map((g: Game) => (
                    <span key={g.id} className="bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-[10px] font-mono px-2 py-0.5 rounded-full">{g.name}</span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-600 text-xs italic">No games assigned — acts as default provider</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
              <button onClick={() => testConnection(provider.id)} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white flex items-center gap-1 transition-colors">
                <Activity className="w-3 h-3" /> Test Connection
              </button>
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(provider.id, provider.status)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${provider.status ? 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20'}`}>
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(provider)}
                  className="w-8 h-8 glass rounded-lg flex items-center justify-center text-secondary hover:text-neon-blue border border-border-strong transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(provider.id)}
                  className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="font-display font-bold text-xl text-white mb-5">{isNew ? 'ADD PROVIDER' : 'EDIT PROVIDER'}</h3>

            {/* Core credentials */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Provider Name *</label>
                <input type="text" placeholder="e.g. DDN, Milkyway" value={editing.name} onChange={e => setEditing((p: any) => ({ ...p, name: e.target.value }))} className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">API Base URL *</label>
                <input type="text" placeholder="https://api.provider.com" value={editing.apiBaseUrl} onChange={e => setEditing((p: any) => ({ ...p, apiBaseUrl: e.target.value }))} className="input-neon" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Agent ID *</label>
                  <input type="text" placeholder="11" value={editing.agentId} onChange={e => setEditing((p: any) => ({ ...p, agentId: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Secret Key * {!isNew && '(blank = keep current)'}</label>
                  <input type="password" placeholder="••••••••" value={editing.secretKey || ''} onChange={e => setEditing((p: any) => ({ ...p, secretKey: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Timeout (ms)</label>
                  <input type="number" value={editing.requestTimeout} onChange={e => setEditing((p: any) => ({ ...p, requestTimeout: parseInt(e.target.value) || 5000 }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Retry Count</label>
                  <input type="number" value={editing.retryCount} onChange={e => setEditing((p: any) => ({ ...p, retryCount: parseInt(e.target.value) || 0 }))} className="input-neon" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={() => setEditing((p: any) => ({ ...p, status: !p.status }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editing.status ? 'bg-neon-blue' : 'bg-dark-500'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editing.status ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-secondary">Enable Provider</span>
              </div>
            </div>

            {/* Game Assignment */}
            <div className="mt-6 pt-5 border-t border-border-subtle">
              <h4 className="text-sm font-bold text-secondary mb-1 flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-neon-blue" /> Linked Games</h4>
              <p className="text-xs text-muted mb-4">Select which games are served by this provider. Unselected games will use the default active provider.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {allGames.map(game => {
                  const isSelected = selectedGameIds.includes(game.id)
                  return (
                    <button key={game.id} onClick={() => toggleGame(game.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${isSelected ? 'border-neon-blue/50 bg-neon-blue/10' : 'border-border-subtle bg-white/3 hover:border-white/20'}`}>
                      {game.thumbnailUrl ? (
                        <img src={game.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Gamepad2 className="w-4 h-4 text-muted" />
                        </div>
                      )}
                      <span className="text-sm text-white truncate flex-1">{game.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-neon-blue flex-shrink-0" />}
                    </button>
                  )
                })}
                {allGames.length === 0 && (
                  <p className="text-muted text-xs col-span-2">No games found. Add games first.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Provider'}
              </button>
              <button onClick={() => setEditing(null)} className="glass flex-1 py-2.5 rounded-xl text-secondary border border-border-strong text-sm hover:text-white transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
