'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { User, Lock, Shield, Camera, Save, MailCheck, ShieldCheck, Bell, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Card, PageHeader, SectionHeading, Button, Badge, TabBar, IconTile, Field } from '@/components/dashboard/ui'

const ACCENT_GRADIENT = 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 50%, #8B5CF6 100%)'

function ButtonSpinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}

// Label above value, used for read-only details.
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted mb-1">{label}</p>
      <div className="text-[15px] text-primary font-medium break-words">{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'profile' | 'password' | 'security'>('profile')
  const [saving, setSaving] = useState(false)

  const profileForm = useForm({ defaultValues: { fullName: '', phone: '', country: '', telegramUsername: '' } })
  const passwordForm = useForm()
  const pwErrors = passwordForm.formState.errors

  const onSaveProfile = async (data: any) => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 1200))
    setSaving(false)
    toast.success('Profile updated successfully!')
  }

  const onChangePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) return toast.error('Passwords do not match')
    setSaving(true)
    await new Promise(r => setTimeout(r, 1200))
    setSaving(false)
    passwordForm.reset()
    toast.success('Password changed successfully!')
  }

  const pwError = (e: any) =>
    e?.type === 'minLength' ? 'Must be at least 8 characters' : e ? 'This field is required' : undefined

  const isAdmin = (user as any)?.role === 'admin'

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Profile" subtitle="Manage your personal details and account security." />

      {/* Profile summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="flex items-center gap-4 sm:gap-5 !p-5 sm:!p-6">
          <div className="relative flex-shrink-0">
            <div
              className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-[30px] sm:text-[34px] font-bold text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: '0 10px 26px -10px rgba(59,130,246,0.7)' }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <button
              aria-label="Change avatar"
              className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full flex items-center justify-center bg-surface-elevated border border-border-strong text-primary transition-all hover:brightness-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              <Camera className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[19px] sm:text-xl font-bold text-primary leading-tight truncate">{user?.username}</p>
            <p className="text-[14px] text-secondary mt-0.5 truncate">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <Badge tone={user?.isVerified ? 'green' : 'orange'} dot>{user?.isVerified ? 'Verified' : 'Not verified'}</Badge>
              <Badge tone={user?.isActive ? 'cyan' : 'red'} dot>{user?.isActive ? 'Active' : 'Suspended'}</Badge>
              {isAdmin && <Badge tone="purple">Admin</Badge>}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Tabs */}
      <div className="mt-5 mb-5 overflow-x-auto max-w-full">
        <TabBar<"profile" | "password" | "security">
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'profile', label: 'Profile', icon: <User size={16} strokeWidth={2} /> },
            { id: 'password', label: 'Password', icon: <Lock size={16} strokeWidth={2} /> },
            { id: 'security', label: 'Security', icon: <Shield size={16} strokeWidth={2} /> },
          ]}
        />
      </div>

      {tab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <Card>
            <SectionHeading title="Personal information" />
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name">
                  <input {...profileForm.register('fullName')} type="text" placeholder="Your full name" className="ds-input" />
                </Field>
                <Field label="Phone number">
                  <input {...profileForm.register('phone')} type="tel" placeholder="+1 234 567 890" className="ds-input" />
                </Field>
                <Field label="Country">
                  <input {...profileForm.register('country')} type="text" placeholder="Your country" className="ds-input" />
                </Field>
                <Field label="Telegram username">
                  <input {...profileForm.register('telegramUsername')} type="text" placeholder="@username" className="ds-input" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={<span className="inline-flex items-center gap-1.5">Email <Lock size={12} strokeWidth={2} className="text-muted" /><span className="text-muted font-normal">read-only</span></span>}>
                  <input type="email" value={user?.email || ''} readOnly className="ds-input opacity-60 cursor-not-allowed" />
                </Field>
                <Field label={<span className="inline-flex items-center gap-1.5">Username <Lock size={12} strokeWidth={2} className="text-muted" /><span className="text-muted font-normal">read-only</span></span>}>
                  <input type="text" value={user?.username || ''} readOnly className="ds-input opacity-60 cursor-not-allowed" />
                </Field>
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={saving} full className="sm:w-auto sm:min-w-[180px]">
                  {saving ? <ButtonSpinner /> : <Save className="w-4 h-4" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeading title="Account information" />
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
              <InfoRow label="Account type">{isAdmin ? 'Administrator' : 'Member'}</InfoRow>
              <InfoRow label="Email status">
                <Badge tone={user?.isVerified ? 'green' : 'orange'} dot>{user?.isVerified ? 'Verified' : 'Pending'}</Badge>
              </InfoRow>
              <InfoRow label="Account status">
                <Badge tone={user?.isActive ? 'green' : 'red'} dot>{user?.isActive ? 'Active' : 'Suspended'}</Badge>
              </InfoRow>
            </div>
          </Card>
        </motion.div>
      )}

      {tab === 'password' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <SectionHeading title="Change password" />
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4 max-w-md">
              <Field label="Current password" error={pwError(pwErrors.currentPassword)}>
                <input {...passwordForm.register('currentPassword', { required: true })} type="password" placeholder="••••••••" className="ds-input" />
              </Field>
              <Field label="New password" hint="Use at least 8 characters." error={pwError(pwErrors.newPassword)}>
                <input {...passwordForm.register('newPassword', { required: true, minLength: 8 })} type="password" placeholder="••••••••" className="ds-input" />
              </Field>
              <Field label="Confirm new password" error={pwError(pwErrors.confirmPassword)}>
                <input {...passwordForm.register('confirmPassword', { required: true })} type="password" placeholder="••••••••" className="ds-input" />
              </Field>
              <div className="pt-1">
                <Button type="submit" disabled={saving} full className="sm:w-auto sm:min-w-[200px]">
                  {saving ? <ButtonSpinner /> : <Lock className="w-4 h-4" />}
                  Change Password
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <SectionHeading title="Security overview" />
            <div className="space-y-2.5">
              {[
                { label: 'Email Verification', status: user?.isVerified ? 'Verified' : 'Pending', ok: user?.isVerified, icon: MailCheck },
                { label: 'Two-Factor Auth', status: 'Not enabled', ok: false, icon: ShieldCheck },
                { label: 'Login Alerts', status: 'Enabled', ok: true, icon: Bell },
                { label: 'Account Status', status: user?.isActive ? 'Active' : 'Suspended', ok: user?.isActive, icon: UserCheck },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-elevated border border-border-subtle px-3.5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <IconTile icon={item.icon as React.ComponentProps<typeof IconTile>["icon"]} tone={item.ok ? 'green' : 'orange'} size="sm" />
                    <span className="text-[15px] font-medium text-primary truncate">{item.label}</span>
                  </div>
                  <Badge tone={item.ok ? 'green' : 'orange'} dot>{item.status}</Badge>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted leading-relaxed pt-4">For enhanced security, consider enabling two-factor authentication. Contact support for assistance.</p>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
