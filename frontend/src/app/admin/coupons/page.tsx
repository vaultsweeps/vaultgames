'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, RefreshCw, Ticket } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, EmptyState, Field } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, SwitchRow, AdminModal, ModalActions, TableCard, SkeletonRows } from '../_kit'

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
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Coupons"
        subtitle="Create and manage freeplay coupons."
        actions={
          <>
            <IconBtn size="lg" label="Refresh coupons" onClick={fetchCoupons}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={() => { setEditing({ ...EMPTY, code: Math.random().toString(36).substring(2, 8).toUpperCase() }); setIsNew(true) }}>
              <Plus className="w-5 h-5" /> Add coupon
            </Button>
          </>
        }
      />

      {/* Editor Modal */}
      {editing && (
        <AdminModal
          title={isNew ? 'Create new coupon' : 'Edit coupon'}
          onClose={() => setEditing(null)}
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save coupon" />}
        >
          <div className="space-y-4">
            <Field label="Coupon code (uppercase)">
              <input type="text" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className={`${INPUT} uppercase tracking-wider`} placeholder="e.g. WELCOME2026" />
            </Field>

            <Field label="Amount (freeplay)">
              <input type="number" step="0.01" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} className={INPUT} placeholder="3.00" />
            </Field>

            <Field label="Usage limit" hint="Leave empty for unlimited uses, or 1 for single-use.">
              <input type="number" value={editing.usageLimit || ''} onChange={e => setEditing({ ...editing, usageLimit: e.target.value })} className={INPUT} placeholder="e.g. 100" />
            </Field>

            <Field label="Expires at (optional)">
              <input type="datetime-local" value={editing.expiresAt ? new Date(editing.expiresAt).toISOString().slice(0, 16) : ''} onChange={e => setEditing({ ...editing, expiresAt: e.target.value })} className={INPUT} />
            </Field>

            <SwitchRow label="Active" on={editing.isActive !== false} onToggle={() => setEditing({ ...editing, isActive: !(editing.isActive !== false) })} />
          </div>
        </AdminModal>
      )}

      {/* List */}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : coupons.length === 0 ? (
        <Card><EmptyState icon={Ticket} title="No coupons found" text="Create a coupon to give players freeplay credit." /></Card>
      ) : (
        <TableCard>
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th className={TH}>Code</th>
                <th className={TH}>Amount</th>
                <th className={TH}>Uses / limit</th>
                <th className={TH}>Expires</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c: any) => (
                <tr key={c.id} className={!c.isActive ? 'opacity-60' : ''}>
                  <td className={`${TD} text-[15px] font-bold text-primary tracking-wider`}>{c.code}</td>
                  <td className={`${TD} text-[14px] font-bold tabular-nums ${NUM.green}`}>${c.amount}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>
                    {c.usedCount} / {c.usageLimit || '∞'}
                  </td>
                  <td className={`${TD} text-[14px] whitespace-nowrap`}>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className={`${TD} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => toggleActive(c.id, c.isActive)}
                        className={`h-10 px-4 rounded-xl text-[13px] font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${c.isActive ? `bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 ${NUM.green}` : `bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 ${NUM.red}`}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <IconBtn label="Edit coupon" onClick={() => { setEditing({ ...c, expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '' }); setIsNew(false) }}>
                        <Edit2 className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn tone="red" label="Delete coupon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
