'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

type Coupon = any
const EMPTY = { code: '', amount: '3', usageLimit: '', expiresAt: '', isActive: true }

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getCoupons()
      setCoupons(res.data.coupons || res.data.data)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCoupons() }, [])

  const handleSave = async () => {
    if (!editing?.code) return toast.error('Coupon code is required')
    setSaving(true)
    try {
      const payload = {
        code: editing.code,
        amount: editing.amount ? parseFloat(editing.amount) : 3,
        usageLimit: editing.usageLimit ? parseInt(editing.usageLimit) : null,
        expiresAt: editing.expiresAt ? new Date(editing.expiresAt) : null,
        isActive: editing.isActive !== false,
      }
      
      if (isNew) {
        await adminApi.createCoupon(payload)
        toast.success('Coupon created!')
      } else {
        await adminApi.updateCoupon(editing.id, payload)
        toast.success('Coupon updated!')
      }
      await fetchCoupons()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save coupon')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await adminApi.updateCoupon(id, { isActive: !currentState })
      await fetchCoupons()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return
    try {
      await adminApi.deleteCoupon(id)
      toast.success('Deleted')
      await fetchCoupons()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">COUPON MANAGEMENT</h2>
          <p className="text-secondary text-sm">Create and manage freeplay coupons.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCoupons} className="glass border border-border-strong rounded-xl px-3 py-2.5 text-secondary hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing({ ...EMPTY, code: Math.random().toString(36).substring(2, 8).toUpperCase() }); setIsNew(true) }} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5">
            <Plus className="w-4 h-4" /> Add Coupon
          </button>
        </div>
      </motion.div>

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass border border-border-strong p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-bold text-xl mb-4 text-white">{isNew ? 'Create New Coupon' : 'Edit Coupon'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Coupon Code (Uppercase)</label>
                <input type="text" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="input-field uppercase" placeholder="e.g. WELCOME2026" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Amount (Freeplay)</label>
                <input type="number" step="0.01" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} className="input-field" placeholder="3.00" />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Usage Limit (Leave empty for unlimited uses, or 1 for single-use)</label>
                <input type="number" value={editing.usageLimit || ''} onChange={e => setEditing({ ...editing, usageLimit: e.target.value })} className="input-field" placeholder="e.g. 100" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Expires At (Optional)</label>
                <input type="datetime-local" value={editing.expiresAt ? new Date(editing.expiresAt).toISOString().slice(0, 16) : ''} onChange={e => setEditing({ ...editing, expiresAt: e.target.value })} className="input-field" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editing.isActive !== false} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
                <label htmlFor="isActive" className="text-sm text-secondary">Active</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 btn-secondary py-2.5">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Coupon'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* List */}
      <div className="glass border border-border-strong rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-secondary">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-secondary">No coupons found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface/50 border-b border-border-strong">
                <tr>
                  <th className="px-6 py-4 font-medium text-secondary">Code</th>
                  <th className="px-6 py-4 font-medium text-secondary">Amount</th>
                  <th className="px-6 py-4 font-medium text-secondary">Uses / Limit</th>
                  <th className="px-6 py-4 font-medium text-secondary">Expires</th>
                  <th className="px-6 py-4 font-medium text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-strong/50">
                {coupons.map((c: any) => (
                  <tr key={c.id} className={`hover:bg-surface/30 transition-colors ${!c.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-bold text-white tracking-widest">{c.code}</td>
                    <td className="px-6 py-4 text-emerald-400 font-bold">${c.amount}</td>
                    <td className="px-6 py-4 text-secondary">
                      {c.usedCount} / {c.usageLimit || '∞'}
                    </td>
                    <td className="px-6 py-4 text-secondary">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => toggleActive(c.id, c.isActive)} className={`p-2 rounded-lg text-xs font-bold transition-all ${c.isActive ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => { setEditing({ ...c, expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '' }); setIsNew(false) }} className="p-2 text-secondary hover:text-white bg-surface rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-400 hover:text-red-300 bg-surface rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
