'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, RefreshCw, Wallet } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, EmptyState, Field } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, SwitchRow, AdminModal, ModalActions, TableCard, SkeletonRows } from '../_kit'

type BonusCashoutRule = any

const SOURCE_TYPES = ['FREEPLAY', 'REFERRAL_BONUS', 'COUPON', 'CRYPTO_BONUS', 'FREE_SPIN'] as const
const EMPTY = { sourceTypes: [] as string[], minAmount: '0', maxAmount: '50', walletCreditAmount: '10', priority: '0', isActive: true }

function describeSourceTypes(sourceTypes: string[]): string {
  if (!sourceTypes || sourceTypes.length === 0 || sourceTypes.includes('ALL')) return 'All bonus types'
  return sourceTypes.join(', ')
}

export default function AdminBonusCashoutRulesPage() {
  const [rules, setRules] = useState<BonusCashoutRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getBonusCashoutRules()
      setRules(res.data.data || [])
    } catch (err: any) {
      // Surfaced rather than swallowed: a silent failure here (e.g. the BonusCashoutRule table not existing
      // yet because the migration hasn't been applied) would otherwise look identical to "no rules created
      // yet" in the UI, with no way to tell the two apart.
      toast.error(err?.response?.data?.message || 'Failed to load bonus cashout rules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRules() }, [])

  const toggleSourceType = (st: string) => {
    const current: string[] = editing.sourceTypes || []
    setEditing({ ...editing, sourceTypes: current.includes(st) ? current.filter((x) => x !== st) : [...current, st] })
  }

  const handleSave = async () => {
    const minAmount = parseFloat(editing.minAmount)
    const maxAmount = parseFloat(editing.maxAmount)
    const walletCreditAmount = parseFloat(editing.walletCreditAmount)
    if (!Number.isFinite(minAmount) || minAmount < 0) return toast.error('Min amount must be >= 0')
    if (!Number.isFinite(maxAmount) || maxAmount < minAmount) return toast.error('Max amount must be >= min amount')
    if (!Number.isFinite(walletCreditAmount) || walletCreditAmount < 0) return toast.error('Wallet credit must be >= 0')

    setSaving(true)
    try {
      const payload = {
        sourceTypes: editing.sourceTypes || [],
        minAmount,
        maxAmount,
        walletCreditAmount,
        priority: parseInt(editing.priority, 10) || 0,
        isActive: editing.isActive !== false,
      }

      const res = isNew
        ? await adminApi.createBonusCashoutRule(payload)
        : await adminApi.updateBonusCashoutRule(editing.id, payload)

      if (res.data?.overlapWarning) {
        toast('Saved — but this rule’s range overlaps another active rule for a shared source type. The higher-priority (then newest) rule wins at conversion time.', { icon: '⚠️', duration: 6000 })
      } else {
        toast.success(isNew ? 'Rule created!' : 'Rule updated!')
      }
      await fetchRules()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await adminApi.updateBonusCashoutRule(id, { isActive: !currentState })
      await fetchRules()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bonus cashout rule? This is blocked if it has already been applied to a conversion.')) return
    try {
      await adminApi.deleteBonusCashoutRule(id)
      toast.success('Deleted')
      await fetchRules()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete — deactivate it instead if it has history.')
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Bonus Cashout Rules"
        subtitle="Configure how much of a Bonus Balance-funded game session's winnings convert to Wallet Balance."
        actions={
          <>
            <IconBtn size="lg" label="Refresh rules" onClick={fetchRules}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
              <Plus className="w-5 h-5" /> Add rule
            </Button>
          </>
        }
      />

      {editing && (
        <AdminModal
          title={isNew ? 'Create bonus cashout rule' : 'Edit bonus cashout rule'}
          onClose={() => setEditing(null)}
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save rule" />}
        >
          <div className="space-y-4">
            <Field label="Applies to" hint="Leave all unchecked to apply this rule to every bonus source type.">
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleSourceType(st)}
                    className={`h-9 px-3 rounded-xl text-[13px] font-semibold border transition-all ${
                      (editing.sourceTypes || []).includes(st)
                        ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                        : 'bg-surface-elevated border-border-subtle text-secondary hover:text-primary'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Min winnings ($)">
                <input type="number" step="0.01" value={editing.minAmount} onChange={(e) => setEditing({ ...editing, minAmount: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Max winnings ($)">
                <input type="number" step="0.01" value={editing.maxAmount} onChange={(e) => setEditing({ ...editing, maxAmount: e.target.value })} className={INPUT} />
              </Field>
            </div>

            <Field label="Wallet credit ($)" hint="Capped at the actual winnings — never more than what was won.">
              <input type="number" step="0.01" value={editing.walletCreditAmount} onChange={(e) => setEditing({ ...editing, walletCreditAmount: e.target.value })} className={INPUT} />
            </Field>

            <Field label="Priority" hint="Among overlapping matching rules, the highest priority (then newest) wins.">
              <input type="number" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} className={INPUT} />
            </Field>

            <SwitchRow label="Active" on={editing.isActive !== false} onToggle={() => setEditing({ ...editing, isActive: !(editing.isActive !== false) })} />
          </div>
        </AdminModal>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : rules.length === 0 ? (
        <Card><EmptyState icon={Wallet} title="No bonus cashout rules found" text="Create a rule to define how bonus-funded winnings convert to Wallet Balance." /></Card>
      ) : (
        <TableCard>
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th className={TH}>Applies to</th>
                <th className={TH}>Range</th>
                <th className={TH}>Wallet credit</th>
                <th className={TH}>Priority</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className={!r.isActive ? 'opacity-60' : ''}>
                  <td className={`${TD} text-[14px] text-primary`}>{describeSourceTypes(r.sourceTypes)}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>${r.minAmount.toFixed(2)} – ${r.maxAmount.toFixed(2)}</td>
                  <td className={`${TD} text-[14px] font-bold tabular-nums ${NUM.green}`}>${r.walletCreditAmount.toFixed(2)}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>{r.priority}</td>
                  <td className={`${TD} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => toggleActive(r.id, r.isActive)}
                        className={`h-10 px-4 rounded-xl text-[13px] font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${r.isActive ? `bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 ${NUM.green}` : `bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 ${NUM.red}`}`}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <IconBtn label="Edit rule" onClick={() => { setEditing({ ...r, minAmount: String(r.minAmount), maxAmount: String(r.maxAmount), walletCreditAmount: String(r.walletCreditAmount), priority: String(r.priority) }); setIsNew(false) }}>
                        <Edit2 className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn tone="red" label="Delete rule" onClick={() => handleDelete(r.id)}>
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
