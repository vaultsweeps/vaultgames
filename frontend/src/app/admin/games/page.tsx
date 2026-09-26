'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Star, Download, Gamepad2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Button, Badge, StatusBadge, StatCard, EmptyState, Field, IconTile } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, SwitchRow, AdminModal, ModalActions, TableCard, SkeletonRows } from '../_kit'

const EMPTY_GAME = { name: '', category: 'Action', version: '1.0.0', description: '', requirements: '', instructions: '', downloadUrl: '', isActive: true, isFeatured: false, rating: 4.5 }
const CATEGORIES = ['Action', 'Strategy', 'Racing', 'Stealth', 'Fighting', 'Puzzle', 'RPG', 'Sports', 'Simulation']

interface Game {
  id: string
  name: string
  category: string
  version: string
  downloadCount: number
  rating: number
  isActive: boolean
  isFeatured: boolean
  downloadUrl: string | null
  description?: string
  requirements?: string
  instructions?: string
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchGames = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getGames()
      setGames(res.data.data)
    } catch (err: any) {
      toast.error('Failed to load games')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGames() }, [])

  const handleSave = async () => {
    if (!editing?.name) return toast.error('Game name is required')
    setSaving(true)
    try {
      const payload = {
        name: editing.name,
        category: editing.category || 'Action',
        version: editing.version || '1.0.0',
        description: editing.description || '',
        downloadUrl: editing.downloadUrl || '',
        thumbnailUrl: editing.thumbnailUrl || '',
        requirements: editing.requirements || '',
        instructions: editing.instructions || '',
        rating: editing.rating || 4.5,
        isActive: editing.isActive !== false,
        isFeatured: editing.isFeatured === true,
      }
      if (isNew) {
        await adminApi.createGame(payload)
        toast.success('Game created!')
      } else {
        await adminApi.updateGame(editing.id, payload)
        toast.success('Game updated!')
      }
      await fetchGames()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save game')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this game?')) return
    try {
      await adminApi.deleteGame(id)
      toast.success('Game deleted')
      setGames(prev => prev.filter(g => g.id !== id))
    } catch (err: any) {
      toast.error('Failed to delete game')
    }
  }

  const toggleActive = async (game: Game) => {
    try {
      const formData = new FormData()
      formData.append('isActive', String(!game.isActive))
      await adminApi.updateGame(game.id, formData)
      setGames(prev => prev.map(g => g.id === game.id ? { ...g, isActive: !g.isActive } : g))
    } catch {
      toast.error('Failed to update game status')
    }
  }

  const activeCount = games.filter(g => g.isActive).length
  const featuredCount = games.filter(g => g.isFeatured).length

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Games"
        subtitle="Manage your games library and downloads."
        actions={
          <>
            <IconBtn size="lg" label="Refresh games" onClick={fetchGames}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={() => { setEditing({ ...EMPTY_GAME }); setIsNew(true) }}>
              <Plus className="w-5 h-5" /> Add game
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-2xl">
        <StatCard icon={Gamepad2} tone="cyan" value={games.length} label="Total games" />
        <StatCard icon={Eye} tone="green" value={activeCount} label="Active" />
        <StatCard icon={Star} tone="gold" value={featuredCount} label="Featured" />
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : games.length === 0 ? (
        <div className="ds-card"><EmptyState icon={Gamepad2} title="No games yet" text="Add your first game!" /></div>
      ) : (
        <TableCard>
          <table className="data-table min-w-[820px]">
            <thead><tr><th className={TH}>Game</th><th className={TH}>Category</th><th className={TH}>Version</th><th className={TH}>Downloads</th><th className={TH}>Rating</th><th className={TH}>Status</th><th className={TH}>Actions</th></tr></thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td className={TD}>
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <IconTile icon={Gamepad2} tone="cyan" size="sm" />
                      <div className="min-w-0">
                        <p className="text-primary text-[14px] font-semibold leading-snug">{game.name}</p>
                        {game.isFeatured && <Badge tone="gold" className="mt-1"><Star className="w-3 h-3 fill-current" />Featured</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className={`${TD} text-[14px]`}>{game.category}</td>
                  <td className={`${TD} text-[13px] tabular-nums`}>v{game.version}</td>
                  <td className={TD}>
                    <span className="flex items-center gap-1.5 text-[14px] tabular-nums">
                      <Download className="w-3.5 h-3.5 text-muted" />
                      {(game.downloadCount / 1000).toFixed(1)}K
                    </span>
                  </td>
                  <td className={TD}>
                    <span className={`flex items-center gap-1.5 text-[14px] font-semibold tabular-nums ${NUM.amber}`}>
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {game.rating}
                    </span>
                  </td>
                  <td className={TD}><StatusBadge status={game.isActive ? 'active' : 'hidden'} /></td>
                  <td className={TD}>
                    <div className="flex gap-2">
                      <IconBtn tone={game.isActive ? 'green' : 'neutral'} label={game.isActive ? 'Hide game' : 'Show game'} onClick={() => toggleActive(game)}>
                        {game.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </IconBtn>
                      <IconBtn label="Edit game" onClick={() => { setEditing({ ...game }); setIsNew(false) }}>
                        <Edit2 className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn tone="red" label="Delete game" onClick={() => handleDelete(game.id)}>
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

      {editing !== null && (
        <AdminModal
          title={isNew ? 'Add game' : 'Edit game'}
          onClose={() => setEditing(null)}
          closeOnBackdrop
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save game" />}
        >
          <div className="space-y-4">
            <Field label="Game name *">
              <input type="text" placeholder="CyberStrike Elite" value={editing.name || ''} onChange={e => setEditing((p: any) => ({ ...p, name: e.target.value }))} className={INPUT} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category">
                <select value={editing.category || 'Action'} onChange={e => setEditing((p: any) => ({ ...p, category: e.target.value }))} className={INPUT}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Version">
                <input type="text" placeholder="1.0.0" value={editing.version || ''} onChange={e => setEditing((p: any) => ({ ...p, version: e.target.value }))} className={INPUT} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={3} placeholder="Game description..." value={editing.description || ''} onChange={e => setEditing((p: any) => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} />
            </Field>
            <Field label="Download URL">
              <input type="url" placeholder="https://..." value={editing.downloadUrl || ''} onChange={e => setEditing((p: any) => ({ ...p, downloadUrl: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="Thumbnail URL">
              <input type="url" placeholder="https://..." value={editing.thumbnailUrl || ''} onChange={e => setEditing((p: any) => ({ ...p, thumbnailUrl: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="System requirements">
              <input type="text" placeholder="Windows 10, 8GB RAM..." value={editing.requirements || ''} onChange={e => setEditing((p: any) => ({ ...p, requirements: e.target.value }))} className={INPUT} />
            </Field>
            <Field label="Installation instructions">
              <input type="text" placeholder="Download, extract, run setup.exe" value={editing.instructions || ''} onChange={e => setEditing((p: any) => ({ ...p, instructions: e.target.value }))} className={INPUT} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['isActive', 'Active'], ['isFeatured', 'Featured']].map(([key, label]) => (
                <SwitchRow key={key} label={label} on={!!editing[key]} onToggle={() => setEditing((p: any) => ({ ...p, [key]: !p[key] }))} />
              ))}
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
