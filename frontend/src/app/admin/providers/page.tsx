'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Activity, ShieldCheck, ShieldAlert, RefreshCw, Eye, Gamepad2, Check, Server } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, Badge, StatusBadge, EmptyState, Field, IconTile, SectionHeading } from '@/components/dashboard/ui'
import { INPUT, IconBtn, SwitchRow, AdminModal, ModalActions, SkeletonRows } from '../_kit'

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
    // The API never returns the real secretKey (only a masked preview) — start
    // the field blank so we don't accidentally resubmit the preview string as
    // if it were a real secret. Leaving it blank on save keeps the existing key.
    setEditing({ ...provider, secretKey: '' })
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
    if (!editing?.name || !editing?.apiBaseUrl || !editing?.agentId || (isNew && !editing?.secretKey)) {
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
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Providers"
        subtitle="Assign game providers and configure API credentials."
        actions={
          <>
            <IconBtn size="lg" label="Refresh providers" onClick={fetchProviders}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={openNew}>
              <Plus className="w-5 h-5" /> Add provider
            </Button>
          </>
        }
      />

      {loading ? (
        <SkeletonRows rows={3} />
      ) : providers.length === 0 ? (
        <Card><EmptyState icon={Server} title="No providers configured yet" text="Add a provider to connect game accounts." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {providers.map((provider) => (
            <Card key={provider.id} className={`!p-4 sm:!p-5 flex flex-col ${!provider.status ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-3">
                <IconTile icon={provider.status ? ShieldCheck : ShieldAlert} tone={provider.status ? 'green' : 'red'} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-primary font-bold text-[18px] leading-snug break-words">{provider.name}</h3>
                  <p className="text-[13px] text-muted mt-0.5 break-all">{provider.apiBaseUrl}</p>
                </div>
                {provider.status
                  ? <StatusBadge status="active" className="flex-shrink-0" />
                  : <Badge tone="red" dot className="flex-shrink-0">Disabled</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-[14px]">
                <div className="rounded-2xl bg-surface-elevated px-3.5 py-3 min-w-0">
                  <span className="text-muted block text-xs mb-0.5">Agent ID</span>
                  <span className="text-primary font-semibold break-all">{provider.agentId}</span>
                </div>
                <div className="rounded-2xl bg-surface-elevated px-3.5 py-3 min-w-0">
                  <span className="text-muted block text-xs mb-0.5">Status</span>
                  <span className="text-primary font-semibold">{provider.status ? 'Active' : 'Disabled'}</span>
                </div>
              </div>

              {/* Linked Games */}
              <div className="mt-4 mb-4">
                <p className="text-[13px] font-medium text-secondary mb-2 flex items-center gap-1.5"><Gamepad2 className="w-4 h-4" /> Linked games</p>
                {provider.games && provider.games.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {provider.games.map((g: Game) => (
                      <Badge key={g.id} tone="cyan" className="!font-medium">{g.name}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted text-[13px]">No games assigned — acts as default provider</span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-subtle">
                <Button variant="secondary" size="sm" onClick={() => testConnection(provider.id)}>
                  <Activity className="w-4 h-4" /> Test connection
                </Button>
                <div className="flex gap-2">
                  <IconBtn tone={provider.status ? 'red' : 'green'} label={provider.status ? 'Disable provider' : 'Enable provider'} onClick={() => toggleStatus(provider.id, provider.status)}>
                    <Eye className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn label="Edit provider" onClick={() => openEdit(provider)}>
                    <Edit2 className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn tone="red" label="Delete provider" onClick={() => handleDelete(provider.id)}>
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Add Modal */}
      {editing !== null && (
        <AdminModal
          title={isNew ? 'Add provider' : 'Edit provider'}
          maxWidth="max-w-2xl"
          onClose={() => setEditing(null)}
          closeOnBackdrop
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save provider" />}
        >
          {/* Core credentials */}
          <div className="space-y-4">
            <Field label="Provider name *">
              <input type="text" placeholder="e.g. DDN, Milkyway" value={editing.name} onChange={e => setEditing((p: any) => ({ ...p, name: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="API base URL *">
              <input type="text" placeholder="https://api.provider.com" value={editing.apiBaseUrl} onChange={e => setEditing((p: any) => ({ ...p, apiBaseUrl: e.target.value }))} className={INPUT} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Agent ID *">
                <input type="text" placeholder="11" value={editing.agentId} onChange={e => setEditing((p: any) => ({ ...p, agentId: e.target.value }))} className={INPUT} />
              </Field>
              <Field label={<>Secret key {isNew ? '*' : '(blank = keep current)'}</>}>
                <input type="password" placeholder={!isNew && editing.secretKeyPreview ? editing.secretKeyPreview : '••••••••'} value={editing.secretKey || ''} onChange={e => setEditing((p: any) => ({ ...p, secretKey: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Timeout (ms)">
                <input type="number" value={editing.requestTimeout} onChange={e => setEditing((p: any) => ({ ...p, requestTimeout: parseInt(e.target.value) || 5000 }))} className={INPUT} />
              </Field>
              <Field label="Retry count">
                <input type="number" value={editing.retryCount} onChange={e => setEditing((p: any) => ({ ...p, retryCount: parseInt(e.target.value) || 0 }))} className={INPUT} />
              </Field>
            </div>
            <SwitchRow label="Enable provider" on={!!editing.status} onToggle={() => setEditing((p: any) => ({ ...p, status: !p.status }))} />
          </div>

          {/* Game Assignment */}
          <div className="mt-6 pt-5 border-t border-border-subtle">
            <SectionHeading title={<span className="flex items-center gap-2 text-[16px]"><Gamepad2 className="w-5 h-5 text-muted" /> Linked games</span>} className="!mb-1" />
            <p className="text-[13px] text-secondary mb-4">Select which games are served by this provider. Unselected games will use the default active provider.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {allGames.map(game => {
                const isSelected = selectedGameIds.includes(game.id)
                return (
                  <button type="button" key={game.id} onClick={() => toggleGame(game.id)} aria-pressed={isSelected}
                    className={`flex items-center gap-3 p-2.5 min-h-[56px] rounded-2xl border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${isSelected ? 'border-sky-400/60 bg-sky-500/10' : 'border-border-subtle bg-surface-elevated hover:border-border-strong'}`}>
                    {game.thumbnailUrl ? (
                      <img src={game.thumbnailUrl} alt="" loading="lazy" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-4 h-4 text-muted" />
                      </div>
                    )}
                    <span className="text-[14px] font-medium text-primary truncate flex-1 min-w-0">{game.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                  </button>
                )
              })}
              {allGames.length === 0 && (
                <p className="text-muted text-[13px] sm:col-span-2">No games found. Add games first.</p>
              )}
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
