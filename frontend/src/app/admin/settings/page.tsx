'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Save, Globe, CreditCard, Bell, Shield, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, SectionHeading, Card, Button, TabBar, Field } from '@/components/dashboard/ui'
import { INPUT, SwitchRow, Callout } from '../_kit'

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
  show_home_bonuses: false,
  show_home_faq: false,
  show_home_why_us: false,
  show_home_testimonials: false,
}

type Settings = typeof DEFAULTS

// Kept at module level (not inside the page component) so inputs keep focus while typing.
function SettingInput({ label, k, settings, onSet, type = 'text', placeholder = '' }: { label: string; k: string; settings: Settings; onSet: (k: string, v: any) => void; type?: string; placeholder?: string }) {
  return (
    <Field label={label}>
      <input type={type} placeholder={placeholder} value={(settings as any)[k] || ''}
        onChange={e => onSet(k, e.target.value)} className={INPUT} />
    </Field>
  )
}

function SettingToggle({ label, k, desc, settings, onSet }: { label: string; k: string; desc?: string; settings: Settings; onSet: (k: string, v: any) => void }) {
  return <SwitchRow label={label} hint={desc} on={!!(settings as any)[k]} onToggle={() => onSet(k, !(settings as any)[k])} />
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[15px] font-semibold text-primary mb-3">{children}</h4>
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

  const input = (label: string, k: string, type = 'text', placeholder = '') => (
    <SettingInput label={label} k={k} settings={settings} onSet={set} type={type} placeholder={placeholder} />
  )
  const toggle = (label: string, k: string, desc?: string) => (
    <SettingToggle label={label} k={k} desc={desc} settings={settings} onSet={set} />
  )

  return (
    <div className="space-y-5 max-w-3xl pb-10">
      <PageHeader title="Platform settings" subtitle="Configure your platform settings and preferences." />

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <TabBar className="min-w-max"
          tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: <t.icon className="w-4 h-4 hidden min-[420px]:block" /> }))}
          active={tab} onChange={setTab} />
      </div>

      {/* General Settings */}
      {tab === 'general' && (
        <Card className="space-y-5">
          <SectionHeading title="General settings" className="!mb-0" />
          {input('Site name', 'site_name', 'text', 'Vault Sweeps')}
          {input('Site tagline', 'site_tagline', 'text', 'The Ultimate Gaming Platform')}
          {input('Site description', 'site_description', 'text', 'Description...')}
          <div className="border-t border-border-subtle pt-5">
            <Subheading>Social links</Subheading>
            <div className="space-y-4">
              {input('Telegram URL', 'telegram_url', 'text', 'https://t.me/...')}
              {input('Facebook Messenger URL', 'facebook_url', 'text', 'https://m.me/...')}
            </div>
          </div>
          <div className="border-t border-border-subtle pt-5">
            {toggle('Maintenance mode', 'maintenance_mode', 'Show maintenance page to all users except admins')}
          </div>
          <div className="border-t border-border-subtle pt-5">
            <Subheading>Homepage sections</Subheading>
            <div className="space-y-3">
              {toggle('Show Hot Bonuses', 'show_home_bonuses', 'Display the Hot Bonuses section on the homepage')}
              {toggle('Show FAQ', 'show_home_faq', 'Display the Frequently Asked Questions section on the homepage')}
              {toggle('Show Why Vault Sweeps', 'show_home_why_us', "Display the 'Why Vault Sweeps' features section on the homepage")}
              {toggle('Show Player Reviews', 'show_home_testimonials', 'Display the community testimonials section on the homepage')}
            </div>
          </div>
        </Card>
      )}

      {/* Payment Settings */}
      {tab === 'payments' && (
        <Card className="space-y-5">
          <SectionHeading title="Payment settings" className="!mb-0" />
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
            {input('Min deposit ($)', 'min_deposit', 'number')}
            {input('Max deposit ($)', 'max_deposit', 'number')}
            {input('Min withdrawal ($)', 'min_withdrawal', 'number')}
            {input('Max withdrawal ($)', 'max_withdrawal', 'number')}
          </div>
          {input('Withdrawal fee (%)', 'withdrawal_fee_percent', 'number', '0')}
          <div className="border-t border-border-subtle pt-5">
            {toggle('Auto-approve deposits', 'auto_approve_deposits', 'Automatically approve deposits verified by webhook')}
          </div>
          <Callout tone="gold" icon={<AlertTriangle className="w-5 h-5" />} title="Payment gateway">
            Configure your payment gateway API keys in the <code className="text-primary font-semibold">.env</code> file. Never store API keys in the database.
          </Callout>
        </Card>
      )}

      {/* Notification Settings */}
      {tab === 'notifications' && (
        <Card className="space-y-3">
          <SectionHeading title="Notification settings" className="!mb-2" />
          {toggle('Email on deposit', 'email_on_deposit', 'Send email to users when deposit status changes')}
          {toggle('Email on withdrawal', 'email_on_withdrawal', 'Send email to users when cashout status changes')}
          {toggle('Email on registration', 'email_on_register', 'Send welcome email to new users')}
          <div className="border-t border-border-subtle pt-5 !mt-5">
            <Subheading>Admin alerts</Subheading>
            <div className="space-y-3">
              {toggle('Alert on new deposit', 'notify_admin_on_deposit', 'Get notified of every new deposit request')}
              {toggle('Alert on new withdrawal', 'notify_admin_on_withdrawal', 'Get notified of every new withdrawal request')}
            </div>
          </div>
        </Card>
      )}

      {/* Security Settings */}
      {tab === 'security' && (
        <Card className="space-y-5">
          <SectionHeading title="Security settings" className="!mb-0" />
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
            {input('Max login attempts', 'max_login_attempts', 'number', '5')}
            {input('Session timeout (hours)', 'session_timeout_hours', 'number', '24')}
          </div>
          {input('Admin IP whitelist (comma-separated)', 'ip_whitelist_admin', 'text', '192.168.1.1, 10.0.0.1')}
          <div className="border-t border-border-subtle pt-5">
            {toggle('Require 2FA for admins', 'two_factor_required', 'Force all admin accounts to use two-factor authentication')}
          </div>
          <Callout tone="cyan" icon={<CheckCircle2 className="w-5 h-5" />} title="Security best practices">
            <ul className="space-y-1 mt-1">
              <li>• Use strong, unique JWT secrets (min 32 chars)</li>
              <li>• Enable HTTPS in production via Nginx SSL</li>
              <li>• Regularly rotate API keys and secrets</li>
              <li>• Monitor activity logs for suspicious behavior</li>
              <li>• Keep all dependencies updated</li>
            </ul>
          </Callout>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none sm:px-8">
          {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            : <><Save className="w-5 h-5" />Save settings</>}
        </Button>
        <Button variant="secondary" onClick={() => setSettings(DEFAULTS)}>
          <RefreshCw className="w-4 h-4" /> Reset defaults
        </Button>
      </div>
    </div>
  )
}
