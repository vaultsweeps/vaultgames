'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { User, Lock, Shield, Camera, Save } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'profile' | 'password' | 'security'>('profile')
  const [saving, setSaving] = useState(false)

  const profileForm = useForm({ defaultValues: { fullName: '', phone: '', country: '', telegramUsername: '' } })
  const passwordForm = useForm()

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

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">PROFILE SETTINGS</h2>
        <p className="text-slate-400 text-sm mt-1">Manage your account information and security.</p>
      </motion.div>

      {/* Avatar section */}
      <div className="glass-card p-6 flex items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-2xl font-bold text-white">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-neon-blue rounded-full flex items-center justify-center hover:bg-neon-blue/80 transition-colors">
            <Camera className="w-3 h-3 text-white" />
          </button>
        </div>
        <div>
          <p className="text-white font-medium">{user?.username}</p>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${user?.isVerified ? 'bg-green-400' : 'bg-orange-400'}`} />
            <span className="text-xs text-slate-500">{user?.isVerified ? 'Email verified' : 'Email not verified'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'password', label: 'Password', icon: Lock },
          { id: 'security', label: 'Security', icon: Shield },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-slate-400 hover:text-white border border-white/10'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card p-6">
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Full Name</label>
                  <input {...profileForm.register('fullName')} type="text" placeholder="Your full name" className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Phone Number</label>
                  <input {...profileForm.register('phone')} type="tel" placeholder="+1 234 567 890" className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Country</label>
                  <input {...profileForm.register('country')} type="text" placeholder="Your country" className="input-neon" />
                </div>
                <div>
                  <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Telegram Username</label>
                  <input {...profileForm.register('telegramUsername')} type="text" placeholder="@username" className="input-neon" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Email (read-only)</label>
                <input type="email" value={user?.email || ''} readOnly className="input-neon opacity-50 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Username (read-only)</label>
                <input type="text" value={user?.username || ''} readOnly className="input-neon opacity-50 cursor-not-allowed" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary py-3 px-8 text-sm flex items-center gap-2 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {tab === 'password' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card p-6">
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Current Password</label>
                <input {...passwordForm.register('currentPassword', { required: true })} type="password" placeholder="••••••••" className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">New Password</label>
                <input {...passwordForm.register('newPassword', { required: true, minLength: 8 })} type="password" placeholder="••••••••" className="input-neon" />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Confirm New Password</label>
                <input {...passwordForm.register('confirmPassword', { required: true })} type="password" placeholder="••••••••" className="input-neon" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary py-3 px-8 text-sm flex items-center gap-2 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-display font-bold text-white">Security Overview</h3>
            {[
              { label: 'Email Verification', status: user?.isVerified ? 'Verified' : 'Pending', ok: user?.isVerified },
              { label: 'Two-Factor Auth', status: 'Not enabled', ok: false },
              { label: 'Login Alerts', status: 'Enabled', ok: true },
              { label: 'Account Status', status: user?.isActive ? 'Active' : 'Suspended', ok: user?.isActive },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between glass rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-green-400' : 'bg-orange-400'}`} />
                  <span className="text-sm text-slate-300">{item.label}</span>
                </div>
                <span className={`text-xs font-medium ${item.ok ? 'text-green-400' : 'text-orange-400'}`}>{item.status}</span>
              </div>
            ))}
            <p className="text-xs text-slate-600 pt-2">For enhanced security, consider enabling two-factor authentication. Contact support for assistance.</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
