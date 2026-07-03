'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Eye, EyeOff, Image, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

type Banner = {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  videoUrl: string | null
  ctaText: string | null
  ctaLink: string | null
  order: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
}

const EMPTY: Omit<Banner, 'id'> = { title: '', subtitle: '', ctaText: '', ctaLink: '', order: 1, isActive: true, imageUrl: '', videoUrl: '', startsAt: null, endsAt: null }

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(Banner | Omit<Banner, 'id'>) | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchBanners = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getBanners()
      setBanners(res.data.data || [])
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBanners() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title) return toast.error('Title is required')
    setSaving(true)
    
    try {
      const payload = {
        ...editing,
        startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : null,
        endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : null,
      }
      
      if (isNew) {
        await adminApi.createBanner(payload)
        toast.success('Banner created!')
      } else {
        await adminApi.updateBanner((editing as Banner).id, payload)
        toast.success('Banner updated!')
      }
      await fetchBanners()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save banner')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    try {
      await adminApi.deleteBanner(id)
      toast.success('Banner deleted')
      await fetchBanners()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await adminApi.updateBanner(id, { isActive: !currentState })
      await fetchBanners()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const moveOrder = async (id: string, dir: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === id)
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === banners.length - 1)) return
    const newBanners = [...banners]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[newBanners[idx], newBanners[swap]] = [newBanners[swap], newBanners[idx]]
    
    // Optimistic UI update
    const prevBanners = [...banners]
    newBanners.forEach((b, i) => { b.order = i + 1 })
    setBanners(newBanners)

    try {
      // Send updates for the swapped items
      await Promise.all([
        adminApi.updateBanner(newBanners[idx].id, { order: newBanners[idx].order }),
        adminApi.updateBanner(newBanners[swap].id, { order: newBanners[swap].order })
      ])
    } catch {
      toast.error('Failed to update order')
      setBanners(prevBanners) // Revert on failure
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">BANNER MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Manage hero slider banners and promotions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchBanners} className="glass border border-white/10 rounded-xl px-3 py-2.5 text-slate-400 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing({ ...EMPTY, order: banners.length + 1 }); setIsNew(true) }} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> Add Banner
          </button>
        </div>
      </motion.div>

      <div className="grid gap-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="py-20 text-center text-slate-500">No banners found</div>
        ) : banners.map((banner, i) => (
          <motion.div key={banner.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`glass-card p-5 flex items-center gap-4 ${!banner.isActive ? 'opacity-60' : ''}`}>
            {/* Order controls */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button onClick={() => moveOrder(banner.id, 'up')} className="w-6 h-6 glass rounded flex items-center justify-center text-slate-500 hover:text-white border border-white/10 transition-all">
                <ChevronUp className="w-3 h-3" />
              </button>
              <span className="text-xs text-center text-neon-blue font-mono">{banner.order}</span>
              <button onClick={() => moveOrder(banner.id, 'down')} className="w-6 h-6 glass rounded flex items-center justify-center text-slate-500 hover:text-white border border-white/10 transition-all">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Preview */}
            <div className="w-20 h-14 bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10 overflow-hidden">
              {banner.imageUrl ? (
                <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
              ) : (
                <Image className="w-6 h-6 text-slate-500" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-display font-bold text-sm truncate">{banner.title}</h3>
              {banner.subtitle && <p className="text-slate-500 text-xs truncate">{banner.subtitle}</p>}
              <div className="flex gap-2 mt-1">
                {banner.ctaText && <span className="text-xs text-neon-blue/70 font-mono bg-neon-blue/5 px-2 py-0.5 rounded">{banner.ctaText} → {banner.ctaLink}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${banner.isActive ? 'badge-approved' : 'badge-pending'}`}>
                  {banner.isActive ? 'ACTIVE' : 'HIDDEN'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleActive(banner.id, banner.isActive)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${banner.isActive ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20' : 'text-slate-500 glass border-white/10 hover:text-white'}`}>
                {banner.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditing({ ...banner, startsAt: banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 16) : '', endsAt: banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 16) : '' }); setIsNew(false) }}
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(banner.id)}
                className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-bold text-xl text-white mb-5">{isNew ? 'CREATE BANNER' : 'EDIT BANNER'}</h3>
            <div className="space-y-4">
              {[
                { key: 'title', label: 'Title', placeholder: 'ENTER THE VAULT SWEEPS' },
                { key: 'subtitle', label: 'Subtitle', placeholder: 'The Ultimate Gaming Universe' },
                { key: 'imageUrl', label: 'Image URL', placeholder: 'https://...' },
                { key: 'videoUrl', label: 'Video URL (optional)', placeholder: 'https://...' },
                { key: 'ctaText', label: 'CTA Button Text', placeholder: 'PLAY NOW' },
                { key: 'ctaLink', label: 'CTA Link', placeholder: '/games' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">{f.label}</label>
                  <input type="text" placeholder={f.placeholder}
                    value={(editing as any)[f.key] || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, [f.key]: e.target.value }))}
                    className="input-neon" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Start Date</label>
                  <input type="datetime-local" className="input-neon text-sm" value={(editing as any).startsAt || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, startsAt: e.target.value || null }))} />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">End Date</label>
                  <input type="datetime-local" className="input-neon text-sm" value={(editing as any).endsAt || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, endsAt: e.target.value || null }))} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditing(prev => ({ ...prev!, isActive: !(prev as any).isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${(editing as any).isActive ? 'bg-neon-blue' : 'bg-dark-500'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${(editing as any).isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-400">Active (visible to users)</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span> : 'Save Banner'}
              </button>
              <button onClick={() => setEditing(null)} className="glass flex-1 py-2.5 rounded-xl text-slate-400 border border-white/10 text-sm hover:text-white transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
