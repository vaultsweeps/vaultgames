'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

const BONUS_TYPES = ['welcome', 'deposit', 'referral', 'vip', 'seasonal']

type Bonus = any
const EMPTY = { title: '', type: 'deposit', description: '', percentage: '', amount: '', maxBonus: '', minDeposit: '', requirements: '', terms: '', isActive: true, expiresAt: '' }
const TYPE_COLORS: Record<string, string> = { welcome: '#00D4FF', deposit: '#7B2FFF', referral: '#00FFC8', vip: '#FF2D9B', seasonal: '#FFD700' }

export default function AdminBonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchBonuses = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getBonuses()
      setBonuses(res.data.data)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBonuses() }, [])

  const handleSave = async () => {
    if (!editing?.title) return toast.error('Title is required')
    setSaving(true)
    try {
      const payload = {
        title: editing.title,
        type: editing.type || 'deposit',
        description: editing.description || null,
        percentage: editing.percentage ? parseFloat(editing.percentage) : null,
        amount: editing.amount ? parseFloat(editing.amount) : null,
        maxBonus: editing.maxBonus ? parseFloat(editing.maxBonus) : null,
        minDeposit: editing.minDeposit ? parseFloat(editing.minDeposit) : null,
        requirements: editing.requirements || null,
        terms: editing.terms || null,
        isActive: editing.isActive !== false,
        expiresAt: editing.expiresAt ? new Date(editing.expiresAt) : null,
      }
      
      if (isNew) {
        await adminApi.createBonus(payload)
        toast.success('Bonus created!')
      } else {
        await adminApi.updateBonus(editing.id, payload)
        toast.success('Bonus updated!')
      }
      await fetchBonuses()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save bonus')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await adminApi.updateBonus(id, { isActive: !currentState })
      await fetchBonuses()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bonus?')) return
    try {
      await adminApi.deleteBonus(id)
      toast.success('Deleted')
      await fetchBonuses()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">BONUSES MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Create and manage bonuses and promotions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchBonuses} className="glass border border-white/10 rounded-xl px-3 py-2.5 text-slate-400 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> Add Bonus
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-1 md:col-span-2 py-20 text-center text-slate-500">Loading bonuses...</div>
        ) : bonuses.length === 0 ? (
          <div className="col-span-1 md:col-span-2 py-20 text-center text-slate-500">No bonuses found</div>
        ) : bonuses.map((bonus, i) => (
          <motion.div key={bonus.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`glass-card p-5 relative overflow-hidden ${!bonus.isActive ? 'opacity-60' : ''}`}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${TYPE_COLORS[bonus.type] || '#00D4FF'}, transparent)` }} />
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full mb-2 inline-block"
                  style={{ color: TYPE_COLORS[bonus.type], background: `${TYPE_COLORS[bonus.type]}15`, border: `1px solid ${TYPE_COLORS[bonus.type]}30` }}>
                  {bonus.type.toUpperCase()}
                </span>
                <h3 className="font-display font-bold text-white">{bonus.title}</h3>
              </div>
              <div className="text-right">
                {bonus.percentage && <p className="font-display font-black text-2xl" style={{ color: TYPE_COLORS[bonus.type] }}>{bonus.percentage}%</p>}
                {bonus.amount && <p className="font-display font-black text-2xl" style={{ color: TYPE_COLORS[bonus.type] }}>${bonus.amount}</p>}
                {!bonus.percentage && !bonus.amount && <p className="font-display font-black text-xl text-slate-500">CUSTOM</p>}
              </div>
            </div>
            <div className="flex gap-2 text-xs text-slate-500 mb-4 flex-wrap">
              {bonus.maxBonus && <span>Max: ${bonus.maxBonus}</span>}
              {bonus.minDeposit && <span>· Min dep: ${bonus.minDeposit}</span>}
              {bonus.expiresAt && <span className="text-orange-400">· Exp: {new Date(bonus.expiresAt).toLocaleDateString()}</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${bonus.isActive ? 'badge-approved' : 'badge-rejected'}`}>
                {bonus.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(bonus.id, bonus.isActive)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${bonus.isActive ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 glass border-white/10'}`}>
                  {bonus.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setEditing({ ...bonus, expiresAt: bonus.expiresAt ? new Date(bonus.expiresAt).toISOString().split('T')[0] : '' }); setIsNew(false) }}
                  className="w-7 h-7 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(bonus.id)}
                  className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-bold text-xl text-white mb-5">{isNew ? 'CREATE BONUS' : 'EDIT BONUS'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Title *</label>
                <input type="text" placeholder="Welcome Bonus" value={editing.title || ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} className="input-neon" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Type</label>
                  <select value={editing.type || 'deposit'} onChange={e => setEditing((p: any) => ({ ...p, type: e.target.value }))} className="input-neon bg-dark-800">
                    {BONUS_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Percentage (%)</label>
                  <input type="number" placeholder="100" value={editing.percentage || ''} onChange={e => setEditing((p: any) => ({ ...p, percentage: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Fixed Amount ($)</label>
                  <input type="number" placeholder="50" value={editing.amount || ''} onChange={e => setEditing((p: any) => ({ ...p, amount: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Max Bonus ($)</label>
                  <input type="number" placeholder="1000" value={editing.maxBonus || ''} onChange={e => setEditing((p: any) => ({ ...p, maxBonus: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Min Deposit ($)</label>
                  <input type="number" placeholder="10" value={editing.minDeposit || ''} onChange={e => setEditing((p: any) => ({ ...p, minDeposit: e.target.value }))} className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Expires At</label>
                  <input type="date" value={editing.expiresAt || ''} onChange={e => setEditing((p: any) => ({ ...p, expiresAt: e.target.value }))} className="input-neon" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Description</label>
                <textarea rows={3} value={editing.description || ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} className="input-neon resize-none" placeholder="Bonus description..." />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Requirements</label>
                <input type="text" value={editing.requirements || ''} onChange={e => setEditing((p: any) => ({ ...p, requirements: e.target.value }))} className="input-neon" placeholder="Minimum deposit requirements..." />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Terms & Conditions</label>
                <input type="text" value={editing.terms || ''} onChange={e => setEditing((p: any) => ({ ...p, terms: e.target.value }))} className="input-neon" placeholder="30x wagering requirement..." />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditing((p: any) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editing.isActive ? 'bg-neon-blue' : 'bg-dark-500'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editing.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-400">Active (visible to users)</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {saving ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span> : 'Save Bonus'}
              </button>
              <button onClick={() => setEditing(null)} className="glass flex-1 py-2.5 rounded-xl text-slate-400 border border-white/10 text-sm hover:text-white transition-all">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
