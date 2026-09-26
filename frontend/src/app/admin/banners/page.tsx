'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Eye, EyeOff, Image, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, Card, Button, Badge, StatusBadge, EmptyState, Field } from '@/components/dashboard/ui'
import { INPUT, IconBtn, SwitchRow, AdminModal, ModalActions, SkeletonRows } from '../_kit'

type Banner = {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  videoUrl: string | null
  ctaText: string | null
  ctaLink: string | null
  order: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
}

const EMPTY: Omit<Banner, 'id'> = { title: '', subtitle: '', ctaText: '', ctaLink: '', order: 1, isActive: true, imageUrl: '', videoUrl: '', startsAt: null, endsAt: null }

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(Banner | Omit<Banner, 'id'>) | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchBanners = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getBanners()
      setBanners(res.data.data || [])
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBanners() }, [])

  const handleSave = async () => {
    if (!editing || !editing.title) return toast.error('Title is required')
    setSaving(true)

    try {
      const payload = {
        ...editing,
        startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : null,
        endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : null,
      }

      if (isNew) {
        await adminApi.createBanner(payload)
        toast.success('Banner created!')
      } else {
        await adminApi.updateBanner((editing as Banner).id, payload)
        toast.success('Banner updated!')
      }
      await fetchBanners()
      setEditing(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save banner')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    try {
      await adminApi.deleteBanner(id)
      toast.success('Banner deleted')
      await fetchBanners()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await adminApi.updateBanner(id, { isActive: !currentState })
      await fetchBanners()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const moveOrder = async (id: string, dir: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === id)
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === banners.length - 1)) return
    const newBanners = [...banners]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[newBanners[idx], newBanners[swap]] = [newBanners[swap], newBanners[idx]]

    // Optimistic UI update
    const prevBanners = [...banners]
    newBanners.forEach((b, i) => { b.order = i + 1 })
    setBanners(newBanners)

    try {
      // Send updates for the swapped items
      await Promise.all([
        adminApi.updateBanner(newBanners[idx].id, { order: newBanners[idx].order }),
        adminApi.updateBanner(newBanners[swap].id, { order: newBanners[swap].order })
      ])
    } catch {
      toast.error('Failed to update order')
      setBanners(prevBanners) // Revert on failure
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Banners"
        subtitle="Manage hero slider banners and promotions."
        actions={
          <>
            <IconBtn size="lg" label="Refresh banners" onClick={fetchBanners}><RefreshCw className="w-5 h-5" /></IconBtn>
            <Button onClick={() => { setEditing({ ...EMPTY, order: banners.length + 1 }); setIsNew(true) }}>
              <Plus className="w-5 h-5" /> Add banner
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:gap-4">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : banners.length === 0 ? (
          <Card><EmptyState icon={Image} title="No banners found" text="Add a banner to show it in the homepage slider." /></Card>
        ) : banners.map((banner) => (
          <Card key={banner.id} className={`!p-4 sm:!p-5 ${!banner.isActive ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] items-center gap-x-4 gap-y-3">
              {/* Order controls */}
              <div className="row-start-2 col-start-1 sm:row-start-1 flex sm:flex-col items-center gap-1.5">
                <IconBtn label="Move up" onClick={() => moveOrder(banner.id, 'up')} className="!w-9 !h-9"><ChevronUp className="w-4 h-4" /></IconBtn>
                <span className="min-w-[24px] text-center text-[14px] font-bold text-primary tabular-nums">{banner.order}</span>
                <IconBtn label="Move down" onClick={() => moveOrder(banner.id, 'down')} className="!w-9 !h-9"><ChevronDown className="w-4 h-4" /></IconBtn>
              </div>

              {/* Preview */}
              <div className="row-start-1 col-start-1 sm:col-start-2 w-[104px] h-[64px] sm:w-[136px] sm:h-[80px] rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-elevated border border-border-subtle overflow-hidden">
                {banner.imageUrl ? (
                  <img src={banner.imageUrl} alt={banner.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-6 h-6 text-muted" />
                )}
              </div>

              {/* Info */}
              <div className="row-start-1 col-start-2 sm:col-start-3 min-w-0">
                <h3 className="text-primary font-semibold text-[15px] sm:text-base leading-snug truncate">{banner.title}</h3>
                {banner.subtitle && <p className="text-secondary text-[13px] sm:text-[14px] truncate mt-0.5">{banner.subtitle}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2 min-w-0">
                  <StatusBadge status={banner.isActive ? 'active' : 'hidden'} />
                  {banner.ctaText && (
                    <Badge tone="cyan" className="max-w-full !whitespace-normal break-all !leading-snug">{banner.ctaText} → {banner.ctaLink}</Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="row-start-2 col-start-2 sm:row-start-1 sm:col-start-4 justify-self-end flex gap-2 flex-shrink-0">
                <IconBtn tone={banner.isActive ? 'green' : 'neutral'} label={banner.isActive ? 'Hide banner' : 'Show banner'} onClick={() => toggleActive(banner.id, banner.isActive)}>
                  {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </IconBtn>
                <IconBtn label="Edit banner" onClick={() => { setEditing({ ...banner, startsAt: banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 16) : '', endsAt: banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 16) : '' }); setIsNew(false) }}>
                  <Edit2 className="w-4 h-4" />
                </IconBtn>
                <IconBtn tone="red" label="Delete banner" onClick={() => handleDelete(banner.id)}>
                  <Trash2 className="w-4 h-4" />
                </IconBtn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {editing !== null && (
        <AdminModal
          title={isNew ? 'Create banner' : 'Edit banner'}
          onClose={() => setEditing(null)}
          closeOnBackdrop
          footer={<ModalActions onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} saveLabel="Save banner" />}
        >
          <div className="space-y-4">
            {[
              { key: 'title', label: 'Title', placeholder: 'ENTER THE VAULT SWEEPS' },
              { key: 'subtitle', label: 'Subtitle', placeholder: 'The Ultimate Gaming Universe' },
              { key: 'imageUrl', label: 'Image URL', placeholder: 'https://...' },
              { key: 'videoUrl', label: 'Video URL (optional)', placeholder: 'https://...' },
              { key: 'ctaText', label: 'CTA button text', placeholder: 'PLAY NOW' },
              { key: 'ctaLink', label: 'CTA link', placeholder: '/games' },
            ].map(f => (
              <Field key={f.key} label={f.label}>
                <input type="text" placeholder={f.placeholder}
                  value={(editing as any)[f.key] || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, [f.key]: e.target.value }))}
                  className={INPUT} />
              </Field>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start date">
                <input type="datetime-local" className={INPUT} value={(editing as any).startsAt || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, startsAt: e.target.value || null }))} />
              </Field>
              <Field label="End date">
                <input type="datetime-local" className={INPUT} value={(editing as any).endsAt || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, endsAt: e.target.value || null }))} />
              </Field>
            </div>
            <SwitchRow label="Active" hint="Visible to users" on={!!(editing as any).isActive}
              onToggle={() => setEditing(prev => ({ ...prev!, isActive: !(prev as any).isActive }))} />
          </div>
        </AdminModal>
      )}
    </div>
  )
}
