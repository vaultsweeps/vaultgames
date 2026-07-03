'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Save, Globe, CreditCard, Bell, Shield, Send, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'

const TABS = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
]

const DEFAULTS = {
  site_name: 'Vault Sweeps',
  site_tagline: 'The Ultimate Gaming Platform',
  site_description: 'Join millions of players on the most immersive gaming platform.',
  maintenance_mode: false,
  telegram_url: 'https://t.me/vaultsweeps',
  facebook_url: 'https://m.me/vaultsweeps',
  min_deposit: '10',
  max_deposit: '100000',
  min_withdrawal: '20',
  max_withdrawal: '100000',
  withdrawal_fee_percent: '0',
  auto_approve_deposits: false,
  email_on_deposit: true,
  email_on_withdrawal: true,
  email_on_register: true,
  notify_admin_on_deposit: true,
  notify_admin_on_withdrawal: true,
  two_factor_required: false,
  ip_whitelist_admin: '',
  max_login_attempts: '5',
  session_timeout_hours: '24',
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState('general')
  const [settings, setSettings] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)

  const set = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    adminApi.getSettings().then(res => {
      if (res.data.data && Object.keys(res.data.data).length > 0) {
        // Merge with defaults so boolean values are properly typed
        const serverData = res.data.data
        const merged: any = { ...DEFAULTS }
        for (const k in merged) {
          if (serverData[k] !== undefined) {
            if (typeof merged[k] === 'boolean') {
              merged[k] = serverData[k] === 'true' || serverData[k] === true
            } else {
              merged[k] = serverData[k]
            }
          }
        }
        setSettings(merged)
      }
    }).catch(err => {
      console.error(err)
      toast.error('Failed to load settings')
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings(settings)
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, k, type = 'text', placeholder = '' }: { label: string; k: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">{label}</label>
      <input type={type} placeholder={placeholder} value={(settings as any)[k] || ''}
        onChange={e => set(k, e.target.value)} className="input-neon" />
    </div>
  )

  const Toggle = ({ label, k, desc }: { label: string; k: string; desc?: string }) => (
    <div className="flex items-center justify-between glass rounded-xl px-4 py-3">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => set(k, !(settings as any)[k])}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${(settings as any)[k] ? 'bg-neon-blue' : 'bg-dark-500'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${(settings as any)[k] ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-2xl text-white">PLATFORM SETTINGS</h2>
        <p className="text-slate-400 text-sm">Configure your platform settings and preferences.</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' : 'glass text-slate-400 hover:text-white border border-white/10'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {tab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <h3 className="font-display font-bold text-white text-sm">GENERAL SETTINGS</h3>
          <Field label="Site Name" k="site_name" placeholder="Vault Sweeps" />
          <Field label="Site Tagline" k="site_tagline" placeholder="The Ultimate Gaming Platform" />
          <Field label="Site Description" k="site_description" placeholder="Description..." />
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-xs font-mono tracking-wider text-slate-400 uppercase mb-3">Social Links</h4>
            <div className="space-y-3">
              <Field label="Telegram URL" k="telegram_url" placeholder="https://t.me/..." />
              <Field label="Facebook Messenger URL" k="facebook_url" placeholder="https://m.me/..." />
            </div>
          </div>
          <div className="border-t border-white/5 pt-4">
            <Toggle label="Maintenance Mode" k="maintenance_mode" desc="Show maintenance page to all users except admins" />
          </div>
        </motion.div>
      )}

      {/* Payment Settings */}
      {tab === 'payments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <h3 className="font-display font-bold text-white text-sm">PAYMENT SETTINGS</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min Deposit ($)" k="min_deposit" type="number" />
            <Field label="Max Deposit ($)" k="max_deposit" type="number" />
            <Field label="Min Withdrawal ($)" k="min_withdrawal" type="number" />
            <Field label="Max Withdrawal ($)" k="max_withdrawal" type="number" />
          </div>
          <Field label="Withdrawal Fee (%)" k="withdrawal_fee_percent" type="number" placeholder="0" />
          <div className="border-t border-white/5 pt-4 space-y-3">
            <Toggle label="Auto-Approve Deposits" k="auto_approve_deposits" desc="Automatically approve deposits verified by webhook" />
          </div>
          <div className="glass rounded-xl p-4 border border-yellow-400/20">
            <p className="text-yellow-400 text-xs font-mono uppercase tracking-wider mb-1">⚠ Payment Gateway</p>
            <p className="text-slate-400 text-xs">Configure your payment gateway API keys in the <code className="text-neon-blue">.env</code> file. Never store API keys in the database.</p>
          </div>
        </motion.div>
      )}

      {/* Notification Settings */}
      {tab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-3">
          <h3 className="font-display font-bold text-white text-sm mb-4">NOTIFICATION SETTINGS</h3>
          <Toggle label="Email on Deposit" k="email_on_deposit" desc="Send email to users when deposit status changes" />
          <Toggle label="Email on Withdrawal" k="email_on_withdrawal" desc="Send email to users when cashout status changes" />
          <Toggle label="Email on Registration" k="email_on_register" desc="Send welcome email to new users" />
          <div className="border-t border-white/5 pt-3">
            <p className="text-xs font-mono tracking-wider text-slate-500 uppercase mb-3">Admin Alerts</p>
            <div className="space-y-3">
              <Toggle label="Alert on New Deposit" k="notify_admin_on_deposit" desc="Get notified of every new deposit request" />
              <Toggle label="Alert on New Withdrawal" k="notify_admin_on_withdrawal" desc="Get notified of every new withdrawal request" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Security Settings */}
      {tab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <h3 className="font-display font-bold text-white text-sm">SECURITY SETTINGS</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Login Attempts" k="max_login_attempts" type="number" placeholder="5" />
            <Field label="Session Timeout (hours)" k="session_timeout_hours" type="number" placeholder="24" />
          </div>
          <Field label="Admin IP Whitelist (comma-separated)" k="ip_whitelist_admin" placeholder="192.168.1.1, 10.0.0.1" />
          <div className="border-t border-white/5 pt-4">
            <Toggle label="Require 2FA for Admins" k="two_factor_required" desc="Force all admin accounts to use two-factor authentication" />
          </div>
          <div className="glass rounded-xl p-4 border border-neon-blue/20">
            <p className="text-neon-blue text-xs font-mono uppercase tracking-wider mb-2">Security Best Practices</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>• Use strong, unique JWT secrets (min 32 chars)</li>
              <li>• Enable HTTPS in production via Nginx SSL</li>
              <li>• Regularly rotate API keys and secrets</li>
              <li>• Monitor activity logs for suspicious behavior</li>
              <li>• Keep all dependencies updated</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Save Button */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 py-3 px-8 text-sm disabled:opacity-50">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            : <><Save className="w-4 h-4" />Save Settings</>}
        </button>
        <button onClick={() => setSettings(DEFAULTS)} className="glass px-6 py-3 rounded-xl text-slate-400 hover:text-white border border-white/10 transition-all text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Reset Defaults
        </button>
      </div>
    </div>
  )
}
