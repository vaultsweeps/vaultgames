'use client'
import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Save, CreditCard, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader, Button, Badge, EmptyState, Field } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, Switch, SwitchRow, AdminModal, TableCard, SkeletonRows, Callout } from '../_kit'
import ManualAccountTile from '@/components/wallet/ManualAccountTile'
import { BRANDS, BRAND_OPTIONS, LEGACY_ACCOUNTS, firstNameFromTag, type ManualBrand } from '@/lib/manualDepositAccounts'

const TYPES = ['wallet', 'bank', 'card', 'crypto']
type Purpose = 'deposit' | 'cashout'

interface PaymentMethod {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
  cashoutEnabled: boolean
  depositEnabled?: boolean
  minAmount: number
  maxAmount: number
  feePercent: number
  instructions: string | null
  brand?: string | null
  tag?: string | null
  displayName?: string | null
  linkUrl?: string | null
  qrUrl?: string | null
  sortOrder?: number
}

const TAG_PLACEHOLDER: Record<ManualBrand, string> = {
  chime: '$First-Last-1234', cashapp: '$CashTag', paypal: '@username', venmo: '@username', zelle: 'email or phone', other: 'tag / handle / address',
}

const legacyOf = (m: PaymentMethod) => LEGACY_ACCOUNTS.find(a => a.id === m.code.toLowerCase())
/** Live on a side = master switch on AND that side's switch on */
const liveFor = (m: PaymentMethod, p: Purpose) => m.isActive && (p === 'deposit' ? m.depositEnabled !== false : m.cashoutEnabled)

const emptyDeposit = {
  brand: 'chime' as ManualBrand | '', name: '', tag: '', displayName: '', linkUrl: '', qrUrl: '',
  minAmount: 10, maxAmount: 10000, instructions: '', sortOrder: 0, enabled: true,
  linkedTag: '', // the tag the payment link was built for — when the tag changes, the link follows
}
const emptyCashout = {
  name: '', code: '', type: 'wallet', minAmount: 50, maxAmount: 10000, feePercent: 0, instructions: '', enabled: true,
}

export default function PaymentMethodsAdminPage() {
  const [tab, setTab] = useState<Purpose>('deposit')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showOff, setShowOff] = useState(false)

  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [depositForm, setDepositForm] = useState<typeof emptyDeposit | null>(null)
  const [cashoutForm, setCashoutForm] = useState<typeof emptyCashout | null>(null)
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
  useEffect(() => { setShowOff(false) }, [tab])

  // ── Open forms ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    if (tab === 'deposit') setDepositForm({ ...emptyDeposit })
    else setCashoutForm({ ...emptyCashout })
  }

  const openEdit = (m: PaymentMethod) => {
    setEditing(m)
    if (tab === 'deposit') {
      // Built-in methods: pre-fill with the tag/link players currently see so saving keeps them unchanged
      const legacy = legacyOf(m)
      setDepositForm({
        brand: ((m.brand as ManualBrand) || legacy?.brand || '') as ManualBrand | '',
        name: m.name,
        tag: m.tag || legacy?.recipient || '',
        linkedTag: m.tag || legacy?.recipient || '',
        displayName: m.displayName || '',
        linkUrl: m.linkUrl || legacy?.linkUrl || '',
        qrUrl: m.qrUrl || legacy?.qrUrl || '',
        minAmount: m.minAmount,
        maxAmount: m.maxAmount,
        instructions: m.instructions || '',
        sortOrder: m.sortOrder ?? 0,
        enabled: liveFor(m, 'deposit'),
      })
    } else {
      setCashoutForm({
        name: m.name, code: m.code, type: m.type, minAmount: m.minAmount, maxAmount: m.maxAmount,
        feePercent: m.feePercent, instructions: m.instructions || '', enabled: liveFor(m, 'cashout'),
      })
    }
  }

  // When the tag changes, rewrite the old tag inside the payment link so the link never points at the old account
  const syncLinkToTag = () => setDepositForm(f => {
    if (!f) return f
    const core = (t: string) => t.trim().replace(/^[$@]/, '')
    const from = core(f.linkedTag), to = core(f.tag)
    if (!from || !to || from === to || !f.linkUrl.includes(from)) return { ...f, linkedTag: f.tag }
    return { ...f, linkUrl: f.linkUrl.split(from).join(to), linkedTag: f.tag }
  })

  const closeForms = () => { setDepositForm(null); setCashoutForm(null); setEditing(null) }

  // ── Save ──────────────────────────────────────────────────────────────
  const saveDeposit = async () => {
    let f = depositForm!
    {
      const core = (t: string) => t.trim().replace(/^[$@]/, '')
      const from = core(f.linkedTag), to = core(f.tag)
      if (from && to && from !== to && f.linkUrl.includes(from)) f = { ...f, linkUrl: f.linkUrl.split(from).join(to) }
    }
    if (!f.name.trim()) return toast.error('Name is required')
    if (f.brand && !f.tag.trim()) return toast.error('Tag is required')
    if (f.minAmount > f.maxAmount) return toast.error('Min amount cannot be greater than max amount')
    const payload: Record<string, unknown> = {
      name: f.name, minAmount: f.minAmount, maxAmount: f.maxAmount, instructions: f.instructions, sortOrder: f.sortOrder,
      brand: f.brand || null,
      tag: f.brand ? f.tag : null,
      displayName: f.brand ? f.displayName : null,
      linkUrl: f.brand ? f.linkUrl : null,
      qrUrl: f.brand ? f.qrUrl : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updatePaymentMethod(editing.id, payload)
        if (f.enabled !== liveFor(editing, 'deposit')) await adminApi.setPaymentMethodAvailability(editing.id, 'deposit', f.enabled)
        toast.success('Deposit method updated')
      } else {
        await adminApi.createPaymentMethod({ ...payload, purpose: 'deposit', type: 'wallet', depositEnabled: f.enabled, isActive: true })
        if (!f.enabled) toast('Saved switched off — turn it on when ready')
        else toast.success('Deposit method added — players can use it now')
      }
      closeForms()
      loadMethods()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveCashout = async () => {
    const f = cashoutForm!
    if (!f.name.trim()) return toast.error('Name is required')
    if (f.minAmount > f.maxAmount) return toast.error('Min amount cannot be greater than max amount')
    setSaving(true)
    try {
      const payload = { name: f.name, minAmount: f.minAmount, maxAmount: f.maxAmount, feePercent: f.feePercent, instructions: f.instructions }
      if (editing) {
        await adminApi.updatePaymentMethod(editing.id, payload)
        if (f.enabled !== liveFor(editing, 'cashout')) await adminApi.setPaymentMethodAvailability(editing.id, 'cashout', f.enabled)
        toast.success('Cashout method updated')
      } else {
        await adminApi.createPaymentMethod({ ...payload, code: f.code, type: f.type, purpose: 'cashout', cashoutEnabled: f.enabled, isActive: true })
        toast.success('Cashout method added')
      }
      closeForms()
      loadMethods()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Row actions ───────────────────────────────────────────────────────
  const handleSwitch = async (m: PaymentMethod) => {
    try {
      await adminApi.setPaymentMethodAvailability(m.id, tab, !liveFor(m, tab))
      toast.success(liveFor(m, tab) ? `Hidden from ${tab}s` : `Live for ${tab}s`)
      loadMethods()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update')
    }
  }

  const handleDelete = async (m: PaymentMethod) => {
    const other: Purpose = tab === 'deposit' ? 'cashout' : 'deposit'
    if (liveFor(m, other)) {
      // Still used on the other side — only take it off this side
      if (!confirm(`"${m.name}" is also used for ${other}s. Remove it from ${tab}s only? (It stays available for ${other}s.)`)) return
      try {
        await adminApi.setPaymentMethodAvailability(m.id, tab, false)
        toast.success(`Removed from ${tab}s`)
        loadMethods()
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to update')
      }
      return
    }
    if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return
    try {
      await adminApi.deletePaymentMethod(m.id)
      toast.success('Deleted')
      loadMethods()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed', { duration: 6000 })
    }
  }

  // ── Lists ─────────────────────────────────────────────────────────────
  const live = methods.filter(m => liveFor(m, tab))
  const off = methods.filter(m => !liveFor(m, tab))

  const appOf = (m: PaymentMethod) => (m.brand as ManualBrand) || legacyOf(m)?.brand
  const tagOf = (m: PaymentMethod) => m.tag || legacyOf(m)?.recipient

  const renderRow = (m: PaymentMethod) => {
    const isLive = liveFor(m, tab)
    const app = appOf(m)
    return (
      <tr key={m.id} className={isLive ? '' : 'opacity-60'}>
        <td className={`${TD} text-[14px] font-semibold text-primary`}>{m.name}</td>
        {tab === 'deposit' ? (
          <>
            <td className={`${TD} text-[14px]`}>{app ? BRANDS[app].label : <span className="text-muted">Built-in flow</span>}</td>
            <td className={`${TD} text-[13px] font-mono ${NUM.cyan}`}>{tagOf(m) || <span className="text-muted">—</span>}</td>
            <td className={`${TD} text-[14px]`}>{tagOf(m) ? (m.displayName || firstNameFromTag(tagOf(m)!)) : '—'}</td>
          </>
        ) : (
          <>
            <td className={`${TD} text-[13px] font-mono ${NUM.cyan}`}>{m.code}</td>
            <td className={`${TD} text-[14px] capitalize`}>{m.type}</td>
            <td className={`${TD} text-[14px] tabular-nums`}>{m.feePercent}%</td>
          </>
        )}
        <td className={`${TD} text-[14px] tabular-nums`}>${m.minAmount} – ${m.maxAmount.toLocaleString()}</td>
        <td className={TD}>
          <div className="flex items-center gap-1">
            <Switch on={isLive} onToggle={() => handleSwitch(m)} label={isLive ? `Hide from ${tab}s` : `Show for ${tab}s`} />
            <span className="text-[13px] text-secondary w-12">{isLive ? 'Live' : 'Off'}</span>
          </div>
        </td>
        <td className={TD}>
          <div className="flex gap-2">
            <IconBtn label="Edit method" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></IconBtn>
            <IconBtn tone="red" label="Delete method" onClick={() => handleDelete(m)}><Trash2 className="w-4 h-4" /></IconBtn>
          </div>
        </td>
      </tr>
    )
  }

  const headers = tab === 'deposit'
    ? ['Name', 'App', 'Tag', 'Name on tile', 'Limits', 'Deposits', 'Actions']
    : ['Name', 'Code', 'Type', 'Fee', 'Limits', 'Cashouts', 'Actions']

  const table = (rows: PaymentMethod[], empty: React.ReactNode) => (
    <TableCard>
      <table className="data-table min-w-[860px]">
        <thead><tr>{headers.map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(renderRow)}
          {rows.length === 0 && <tr><td colSpan={headers.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </TableCard>
  )

  const df = depositForm
  const previewName = df ? (df.displayName.trim() || (df.tag.trim() ? firstNameFromTag(df.tag.trim()) : 'Name')) : ''

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Payment methods"
        subtitle="Deposit and cashout methods are managed separately."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-5 h-5" /> Add {tab} method
          </Button>
        }
      />

      {/* Tabs */}
      <div className="inline-flex p-1 rounded-2xl bg-surface-elevated border border-border-subtle">
        {(['deposit', 'cashout'] as Purpose[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setTab(p)}
            className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-[14px] font-semibold transition-colors ${tab === p ? 'bg-sky-500/15 text-sky-300' : 'text-secondary hover:text-primary'}`}
          >
            {p === 'deposit' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
            {p === 'deposit' ? 'Deposit methods' : 'Cashout methods'}
          </button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <Callout tone="cyan" title="How deposit methods work">
          Pick the app, enter the tag players send money to, and save — the method shows on the Wallet deposit screen straight away with the
          first name from the tag (e.g. <span className="font-mono">$Luis-Feliciano-9012</span> → <b>Luis</b>). Two or more accounts of the same app
          are grouped behind one tile. Turning a method off here never affects cashouts.
        </Callout>
      ) : (
        <Callout tone="cyan" title="How cashout methods work">
          These are the methods players can choose on the Cashout page. Turning a method off here never affects deposits.
        </Callout>
      )}

      {/* Deposit form */}
      {df && (
        <AdminModal
          title={`${editing ? 'Edit' : 'Add'} deposit method`}
          onClose={closeForms}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex gap-3">
              <Button variant="primary" onClick={saveDeposit} disabled={saving} className="flex-1">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={closeForms} className="flex-1 sm:flex-none">Cancel</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Payment app" hint={editing && !df.brand ? 'Crypto / card / automatic methods keep their built-in flow.' : undefined}>
              <select
                className={INPUT}
                value={df.brand}
                onChange={e => setDepositForm(f => f && ({ ...f, brand: e.target.value as ManualBrand | '' }))}
              >
                {BRAND_OPTIONS.map(b => <option key={b} value={b}>{BRANDS[b].label}</option>)}
                {editing && !appOf(editing) && <option value="">Built-in flow (no tag)</option>}
              </select>
            </Field>
            <Field label="Name" hint="Shown in the deposit screen header and in admin / Telegram.">
              <input className={INPUT} value={df.name} onChange={e => setDepositForm(f => f && ({ ...f, name: e.target.value }))} placeholder={df.brand ? `e.g. ${BRANDS[df.brand as ManualBrand].label} 3` : 'Name'} />
            </Field>

            {df.brand && (
              <>
                <Field label="Tag" hint="Where players send the money." className="sm:col-span-2">
                  <input className={`${INPUT} font-mono`} value={df.tag} onChange={e => setDepositForm(f => f && ({ ...f, tag: e.target.value }))} onBlur={syncLinkToTag} placeholder={TAG_PLACEHOLDER[df.brand as ManualBrand]} />
                </Field>
                <Field label="Name on tile" hint="Optional — defaults to the first name in the tag.">
                  <input className={INPUT} value={df.displayName} onChange={e => setDepositForm(f => f && ({ ...f, displayName: e.target.value }))} placeholder={df.tag.trim() ? firstNameFromTag(df.tag.trim()) : 'e.g. Luis'} />
                </Field>
                <Field label="Payment link" hint="Optional, https:// only. Opens when the player taps “Open … to Pay”.">
                  <input className={INPUT} value={df.linkUrl} onChange={e => setDepositForm(f => f && ({ ...f, linkUrl: e.target.value }))} placeholder="https://..." />
                </Field>
                <Field label="QR image URL" hint="Optional, https:// only." className="sm:col-span-2">
                  <input className={INPUT} value={df.qrUrl} onChange={e => setDepositForm(f => f && ({ ...f, qrUrl: e.target.value }))} placeholder="https://..." />
                </Field>
              </>
            )}

            <Field label="Min deposit ($)">
              <input type="number" className={INPUT} value={df.minAmount} onChange={e => setDepositForm(f => f && ({ ...f, minAmount: +e.target.value }))} />
            </Field>
            <Field label="Max deposit ($)">
              <input type="number" className={INPUT} value={df.maxAmount} onChange={e => setDepositForm(f => f && ({ ...f, maxAmount: +e.target.value }))} />
            </Field>
            <Field label="Instructions" hint="Optional extra note shown to the player on the deposit screen." className="sm:col-span-2">
              <textarea rows={3} className={`${INPUT} resize-none`} value={df.instructions} onChange={e => setDepositForm(f => f && ({ ...f, instructions: e.target.value }))} />
            </Field>
            <Field label="Order" hint="Lower numbers show first.">
              <input type="number" className={INPUT} value={df.sortOrder} onChange={e => setDepositForm(f => f && ({ ...f, sortOrder: +e.target.value }))} />
            </Field>
            <SwitchRow label="Live for deposits" on={df.enabled} onToggle={() => setDepositForm(f => f && ({ ...f, enabled: !f.enabled }))} />

            {df.brand && (
              <div className="sm:col-span-2">
                <p className="text-[12px] text-muted mb-2">Preview</p>
                <div className="max-w-[260px]">
                  <ManualAccountTile
                    brand={df.brand as ManualBrand}
                    title={previewName}
                    subtitle={df.brand === 'other' ? (df.name || 'Other') : undefined}
                    logo={df.brand === 'other' ? (df.name.trim()[0] || '?').toUpperCase() : undefined}
                    onClick={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        </AdminModal>
      )}

      {/* Cashout form */}
      {cashoutForm && (
        <AdminModal
          title={`${editing ? 'Edit' : 'Add'} cashout method`}
          onClose={closeForms}
          footer={
            <div className="flex gap-3">
              <Button variant="primary" onClick={saveCashout} disabled={saving} className="flex-1">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={closeForms} className="flex-1 sm:flex-none">Cancel</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" className="sm:col-span-2">
              <input className={INPUT} value={cashoutForm.name} onChange={e => setCashoutForm(f => f && ({ ...f, name: e.target.value }))} placeholder="e.g. Zelle" />
            </Field>
            <Field label="Code" hint={editing ? 'Fixed after creation.' : 'Optional — generated from the name.'}>
              <input
                className={INPUT}
                value={cashoutForm.code}
                onChange={e => setCashoutForm(f => f && ({ ...f, code: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                placeholder="e.g. zelle"
                disabled={!!editing}
              />
            </Field>
            <Field label="Type">
              <select className={INPUT} value={cashoutForm.type} onChange={e => setCashoutForm(f => f && ({ ...f, type: e.target.value }))} disabled={!!editing}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Min cashout ($)" hint="Never below the site-wide $50 minimum.">
              <input type="number" className={INPUT} value={cashoutForm.minAmount} onChange={e => setCashoutForm(f => f && ({ ...f, minAmount: +e.target.value }))} />
            </Field>
            <Field label="Max cashout ($)">
              <input type="number" className={INPUT} value={cashoutForm.maxAmount} onChange={e => setCashoutForm(f => f && ({ ...f, maxAmount: +e.target.value }))} />
            </Field>
            <Field label="Fee (%)">
              <input type="number" className={INPUT} value={cashoutForm.feePercent} onChange={e => setCashoutForm(f => f && ({ ...f, feePercent: +e.target.value }))} />
            </Field>
            <Field label="Instructions" hint="Shown to the player." className="sm:col-span-2">
              <textarea rows={3} className={`${INPUT} resize-none`} value={cashoutForm.instructions} onChange={e => setCashoutForm(f => f && ({ ...f, instructions: e.target.value }))} />
            </Field>
            <SwitchRow label="Live for cashouts" on={cashoutForm.enabled} onToggle={() => setCashoutForm(f => f && ({ ...f, enabled: !f.enabled }))} />
          </div>
        </AdminModal>
      )}

      {/* Tables */}
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          {table(live, <EmptyState icon={CreditCard} title={`No live ${tab} methods`} text={`Add a method so players can ${tab === 'deposit' ? 'deposit' : 'cash out'}.`} />)}

          {off.length > 0 && (
            <div className="space-y-3">
              <button type="button" onClick={() => setShowOff(v => !v)} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-secondary hover:text-primary">
                {showOff ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Not used for {tab}s ({off.length})
              </button>
              {showOff && (
                <>
                  <p className="text-[13px] text-muted">Switch one on to make it available for {tab}s. <Badge tone="slate">Off</Badge> here doesn&apos;t change the other tab.</p>
                  {table(off, null)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
