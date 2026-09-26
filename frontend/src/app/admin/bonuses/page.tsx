'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Eye, EyeOff, RefreshCw, Gift } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, Badge, StatusBadge, EmptyState, Field, IconTile, TONES, Tone } from '@/components/dashboard/ui'
import { INPUT, IconBtn, SwitchRow, AdminModal, ModalActions, SkeletonRows, NUM } from '../_kit'

const BONUS_TYPES = ['welcome', 'deposit', 'referral', 'vip', 'seasonal']

type Bonus = any
const EMPTY = { title: '', type: 'deposit', description: '', percentage: '', amount: '', maxBonus: '', minDeposit: '', requirements: '', terms: '', isActive: true, expiresAt: '' }
const TYPE_TONES: Record<string, Tone> = { welcome: 'cyan', deposit: 'purple', referral: 'green', vip: 'pink', seasonal: 'gold' }

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
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Bonuses"
        subtitle="Create and manage bonuses and promotions."
        actions={
          <>
            <IconBtn size="lg" label="Refresh bonuses" onClick={fetchBonuses}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
              <Plus className="w-5 h-5" /> Add bonus
            </Button>
          </>
        }
      />

      {loading ? (
        <SkeletonRows rows={4} />
      ) : bonuses.length === 0 ? (
        <Card><EmptyState icon={Gift} title="No bonuses found" text="Create a bonus to offer it to your players." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {bonuses.map((bonus) => {
            const tone = TYPE_TONES[bonus.type] || 'cyan'
            const t = TONES[tone]
            return (
              <Card key={bonus.id} className={`!p-4 sm:!p-5 flex flex-col ${!bonus.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <IconTile icon={Gift} tone={tone} />
                  <div className="min-w-0 flex-1">
                    <Badge tone={tone} className="mb-1.5 capitalize">{bonus.type}</Badge>
                    <h3 className="text-primary font-semibold text-[16px] leading-snug break-words">{bonus.title}</h3>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {bonus.percentage && <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color: t.fg }}>{bonus.percentage}%</p>}
                    {bonus.amount && <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color: t.fg }}>${bonus.amount}</p>}
                    {!bonus.percentage && !bonus.amount && <p className="text-[18px] font-bold leading-none text-muted">Custom</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-secondary mt-4 mb-4 min-h-[20px]">
                  {bonus.maxBonus && <span>Max <span className="text-primary font-medium tabular-nums">${bonus.maxBonus}</span></span>}
                  {bonus.minDeposit && <span>Min deposit <span className="text-primary font-medium tabular-nums">${bonus.minDeposit}</span></span>}
                  {bonus.expiresAt && <span className={NUM.orange}>Expires {new Date(bonus.expiresAt).toLocaleDateString()}</span>}
                </div>

                <div className="mt-auto pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
                  <StatusBadge status={bonus.isActive ? 'active' : 'inactive'} />
                  <div className="flex gap-2">
                    <IconBtn tone={bonus.isActive ? 'green' : 'neutral'} label={bonus.isActive ? 'Deactivate bonus' : 'Activate bonus'} onClick={() => toggleActive(bonus.id, bonus.isActive)}>
                      {bonus.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </IconBtn>
                    <IconBtn label="Edit bonus" onClick={() => { setEditing({ ...bonus, expiresAt: bonus.expiresAt ? new Date(bonus.expiresAt).toISOString().split('T')[0] : '' }); setIsNew(false) }}>
                      <Edit2 className="w-4 h-4" />
                    </IconBtn>
                    <IconBtn tone="red" label="Delete bonus" onClick={() => handleDelete(bonus.id)}>
                      <Trash2 className="w-4 h-4" />
                    </IconBtn>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing !== null && (
        <AdminModal
          title={isNew ? 'Create bonus' : 'Edit bonus'}
          onClose={() => setEditing(null)}
          closeOnBackdrop
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save bonus" />}
        >
          <div className="space-y-4">
            <Field label="Title *">
              <input type="text" placeholder="Welcome Bonus" value={editing.title || ''} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} className={INPUT} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type">
                <select value={editing.type || 'deposit'} onChange={e => setEditing((p: any) => ({ ...p, type: e.target.value }))} className={INPUT}>
                  {BONUS_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Percentage (%)">
                <input type="number" placeholder="100" value={editing.percentage || ''} onChange={e => setEditing((p: any) => ({ ...p, percentage: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Fixed amount ($)">
                <input type="number" placeholder="50" value={editing.amount || ''} onChange={e => setEditing((p: any) => ({ ...p, amount: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Max bonus ($)">
                <input type="number" placeholder="1000" value={editing.maxBonus || ''} onChange={e => setEditing((p: any) => ({ ...p, maxBonus: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Min deposit ($)">
                <input type="number" placeholder="10" value={editing.minDeposit || ''} onChange={e => setEditing((p: any) => ({ ...p, minDeposit: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Expires at">
                <input type="date" value={editing.expiresAt || ''} onChange={e => setEditing((p: any) => ({ ...p, expiresAt: e.target.value }))} className={INPUT} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={3} value={editing.description || ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} placeholder="Bonus description..." />
            </Field>
            <Field label="Requirements">
              <input type="text" value={editing.requirements || ''} onChange={e => setEditing((p: any) => ({ ...p, requirements: e.target.value }))} className={INPUT} placeholder="Minimum deposit requirements..." />
            </Field>
            <Field label="Terms & conditions">
              <input type="text" value={editing.terms || ''} onChange={e => setEditing((p: any) => ({ ...p, terms: e.target.value }))} className={INPUT} placeholder="30x wagering requirement..." />
            </Field>
            <SwitchRow label="Active" hint="Visible to users" on={!!editing.isActive} onToggle={() => setEditing((p: any) => ({ ...p, isActive: !p.isActive }))} />
          </div>
        </AdminModal>
      )}
    </div>
  )
}
