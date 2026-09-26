'use client'
import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Save, CreditCard } from 'lucide-react'
import { PageHeader, Card, Button, Badge, EmptyState, Field } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, Switch, SwitchRow, AdminModal, TableCard, SkeletonRows } from '../_kit'

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
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Payment methods"
        subtitle="Manage deposit & cashout payment methods."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-5 h-5" /> Add method
          </Button>
        }
      />

      {/* Form Modal */}
      {showForm && (
        <AdminModal
          title={`${editingId ? 'Edit' : 'Add'} payment method`}
          onClose={() => setShowForm(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1 sm:flex-none">Cancel</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" className="sm:col-span-2">
              <input className={INPUT}
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Chime 2"
              />
            </Field>
            <Field label="Code" hint="Unique, no spaces.">
              <input
                className={INPUT}
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                placeholder="e.g. chime2"
                disabled={!!editingId}
              />
            </Field>
            <Field label="Type">
              <select
                className={INPUT}
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                disabled={!!editingId}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Min amount ($)">
              <input
                type="number" className={INPUT}
                value={form.minAmount} onChange={e => setForm(f => ({ ...f, minAmount: +e.target.value }))}
              />
            </Field>
            <Field label="Max amount ($)">
              <input
                type="number" className={INPUT}
                value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: +e.target.value }))}
              />
            </Field>
            <Field label="Fee (%)">
              <input
                type="number" className={INPUT}
                value={form.feePercent} onChange={e => setForm(f => ({ ...f, feePercent: +e.target.value }))}
              />
            </Field>
            <Field label="Instructions" hint="Shown to the user." className="sm:col-span-2">
              <textarea
                rows={3}
                className={`${INPUT} resize-none`}
                value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder="Send to $Brenda-Taylor-245 on Chime..."
              />
            </Field>
            <SwitchRow label="Active" on={form.isActive} onToggle={() => setForm(f => ({ ...f, isActive: !f.isActive }))} />
            <SwitchRow label="Cashout enabled" on={form.cashoutEnabled} onToggle={() => setForm(f => ({ ...f, cashoutEnabled: !f.cashoutEnabled }))} />
          </div>
        </AdminModal>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <TableCard>
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Code</th>
                <th className={TH}>Type</th>
                <th className={TH}>Min</th>
                <th className={TH}>Max</th>
                <th className={TH}>Fee</th>
                <th className={TH}>Cashout</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td className={`${TD} text-[14px] font-semibold text-primary`}>{m.name}</td>
                  <td className={`${TD} text-[13px] font-mono ${NUM.cyan}`}>{m.code}</td>
                  <td className={`${TD} text-[14px] capitalize`}>{m.type}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>${m.minAmount}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>${m.maxAmount.toLocaleString()}</td>
                  <td className={`${TD} text-[14px] tabular-nums`}>{m.feePercent}%</td>
                  <td className={TD}>
                    <Badge tone={m.cashoutEnabled ? 'green' : 'slate'}>{m.cashoutEnabled ? 'Yes' : 'No'}</Badge>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-1">
                      <Switch on={m.isActive} onToggle={() => handleToggle(m.id)} label={m.isActive ? 'Deactivate method' : 'Activate method'} />
                      <span className="text-[13px] text-secondary w-12">{m.isActive ? 'Active' : 'Off'}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex gap-2">
                      <IconBtn label="Edit method" onClick={() => openEdit(m)}>
                        <Pencil className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn tone="red" label="Delete method" onClick={() => handleDelete(m.id, m.name)}>
                        <Trash2 className="w-4 h-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr><td colSpan={9}><EmptyState icon={CreditCard} title="No payment methods found" text="Add a method so players can deposit and cash out." /></td></tr>
              )}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
