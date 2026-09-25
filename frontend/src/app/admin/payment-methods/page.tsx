'use client'
import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Save, X } from 'lucide-react'

const TYPES = ['wallet', 'bank', 'card', 'crypto']

interface PaymentMethod {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
  cashoutEnabled: boolean
  minAmount: number
  maxAmount: number
  feePercent: number
  instructions: string
}

const emptyForm = {
  name: '',
  code: '',
  type: 'wallet',
  minAmount: 10,
  maxAmount: 10000,
  feePercent: 0,
  instructions: '',
  isActive: true,
  cashoutEnabled: false,
}

export default function PaymentMethodsAdminPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const loadMethods = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getPaymentMethods()
      setMethods(res.data.data)
    } catch {
      toast.error('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMethods() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id)
    setForm({
      name: m.name, code: m.code, type: m.type,
      minAmount: m.minAmount, maxAmount: m.maxAmount,
      feePercent: m.feePercent, instructions: m.instructions || '',
      isActive: m.isActive, cashoutEnabled: m.cashoutEnabled,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.code || !form.type) return toast.error('Name, Code and Type are required')
    setSaving(true)
    try {
      if (editingId) {
        await adminApi.updatePaymentMethod(editingId, form)
        toast.success('Payment method updated!')
      } else {
        await adminApi.createPaymentMethod(form)
        toast.success('Payment method created!')
      }
      setShowForm(false)
      loadMethods()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await adminApi.togglePaymentMethod(id)
      toast.success('Status updated')
      loadMethods()
    } catch {
      toast.error('Failed to toggle')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await adminApi.deletePaymentMethod(id)
      toast.success('Deleted')
      loadMethods()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Methods</h1>
          <p className="text-white/50 text-sm mt-1">Manage deposit & cashout payment methods</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2AC3FF] text-black font-bold text-sm hover:bg-[#2AC3FF]/80 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Method
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0E1120] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">{editingId ? 'Edit' : 'Add'} Payment Method</h2>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-white/60 text-xs font-semibold mb-1 block">Name</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Chime 2"
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1 block">Code <span className="text-white/30">(unique, no spaces)</span></label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50 font-mono"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="e.g. chime2"
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1 block">Type</label>
                <select
                  className="w-full bg-[#1a1d2e] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  disabled={!!editingId}
                >
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1 block">Min Amount ($)</label>
                <input
                  type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50"
                  value={form.minAmount} onChange={e => setForm(f => ({ ...f, minAmount: +e.target.value }))}
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1 block">Max Amount ($)</label>
                <input
                  type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50"
                  value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: +e.target.value }))}
                />
              </div>
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1 block">Fee (%)</label>
                <input
                  type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50"
                  value={form.feePercent} onChange={e => setForm(f => ({ ...f, feePercent: +e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-white/60 text-xs font-semibold mb-1 block">Instructions <span className="text-white/30">(shown to user)</span></label>
                <textarea
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2AC3FF]/50 resize-none"
                  value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="Send to $Brenda-Taylor-245 on Chime..."
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-white/60 text-sm">Active</label>
                <button
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`w-11 h-6 rounded-full transition-all ${form.isActive ? 'bg-emerald-500' : 'bg-white/10'} relative`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.isActive ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-white/60 text-sm">Cashout Enabled</label>
                <button
                  onClick={() => setForm(f => ({ ...f, cashoutEnabled: !f.cashoutEnabled }))}
                  className={`w-11 h-6 rounded-full transition-all ${form.cashoutEnabled ? 'bg-emerald-500' : 'bg-white/10'} relative`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.cashoutEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2AC3FF] text-black font-bold text-sm hover:bg-[#2AC3FF]/80 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-xl bg-white/5 text-white/70 font-semibold text-sm hover:bg-white/10">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Min</th>
                <th className="text-left px-4 py-3">Max</th>
                <th className="text-left px-4 py-3">Fee</th>
                <th className="text-left px-4 py-3">Cashout</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m, i) => (
                <tr key={m.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="px-4 py-3 text-white font-semibold">{m.name}</td>
                  <td className="px-4 py-3 font-mono text-[#2AC3FF] text-xs">{m.code}</td>
                  <td className="px-4 py-3 text-white/60 capitalize">{m.type}</td>
                  <td className="px-4 py-3 text-white/60">${m.minAmount}</td>
                  <td className="px-4 py-3 text-white/60">${m.maxAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white/60">{m.feePercent}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.cashoutEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                      {m.cashoutEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(m.id)} title="Toggle active">
                      {m.isActive
                        ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                        : <ToggleLeft className="w-5 h-5 text-white/20" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(m.id, m.name)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-white/30">No payment methods found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
