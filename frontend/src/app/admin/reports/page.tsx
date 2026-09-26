'use client'
import { useState } from 'react'
import { Download, TrendingUp, Users, CreditCard, ArrowUpCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { PageHeader, SectionHeading, Card, StatCard, TabBar, IconTile, cardClass } from '@/components/dashboard/ui'

const MONTHLY = [
  { month: 'Jul', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Aug', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Sep', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Oct', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Nov', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Dec', deposits: 0, withdrawals: 0, users: 0 },
  { month: 'Jan', deposits: 0, withdrawals: 0, users: 0 },
]

const PAYMENT_METHODS = [
  { name: 'Bitcoin', value: 0, color: '#F7931A' },
  { name: 'USDT', value: 0, color: '#26A17B' },
  { name: 'Bank Transfer', value: 0, color: '#00D4FF' },
  { name: 'Ethereum', value: 0, color: '#627EEA' },
  { name: 'Other', value: 0, color: '#7B2FFF' },
]

const PERIODS = [
  { id: '7m', label: '7 mo' },
  { id: '3m', label: '3 mo' },
  { id: '1m', label: '1 mo' },
  { id: '1w', label: '1 wk' },
]

const AXIS_TICK = { fill: '#8091AB', fontSize: 12 }
const GRID_STROKE = 'rgba(128,145,171,0.18)'

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) return (
    <div className="ds-card px-4 py-3 text-[13px]">
      <p className="text-primary mb-1.5 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {typeof p.value === 'number' && p.name !== 'users' ? `$${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  )
  return null
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('7m')
  const [exporting, setExporting] = useState(false)

  const handleExport = async (type: string) => {
    setExporting(true)
    await new Promise(r => setTimeout(r, 1500))
    setExporting(false)
    toast.success(`${type} report exported!`)
  }

  const totalDeposits = MONTHLY.reduce((s, m) => s + m.deposits, 0)
  const totalWithdrawals = MONTHLY.reduce((s, m) => s + m.withdrawals, 0)
  const totalUsers = MONTHLY.reduce((s, m) => s + m.users, 0)
  const netRevenue = totalDeposits - totalWithdrawals

  return (
    <div className="space-y-5 sm:space-y-6 pb-10">
      <PageHeader
        title="Reports & analytics"
        subtitle="Platform performance and financial reports."
        actions={<TabBar tabs={PERIODS} active={period} onChange={setPeriod} />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Total deposits', value: `$${(totalDeposits / 1000).toFixed(1)}K`, icon: CreditCard, tone: 'cyan' as const },
          { label: 'Total cashouts', value: `$${(totalWithdrawals / 1000).toFixed(1)}K`, icon: ArrowUpCircle, tone: 'purple' as const },
          { label: 'Net revenue', value: `$${(netRevenue / 1000).toFixed(1)}K`, icon: TrendingUp, tone: 'green' as const },
          { label: 'New users', value: totalUsers.toLocaleString(), icon: Users, tone: 'pink' as const },
        ].map((s, i) => (
          <StatCard key={i} icon={s.icon} tone={s.tone} value={s.value} label={s.label} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Card className="xl:col-span-2 min-w-0">
          <SectionHeading title="Deposits vs cashouts" />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MONTHLY}>
              <defs>
                <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B2FFF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7B2FFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#8091AB' }} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#00D4FF" fill="url(#dGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" name="Cashouts" stroke="#7B2FFF" fill="url(#wGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="min-w-0">
          <SectionHeading title="Payment methods" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PAYMENT_METHODS} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {PAYMENT_METHODS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value}%`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2.5 mt-3">
            {PAYMENT_METHODS.map(m => (
              <div key={m.name} className="flex items-center justify-between text-[14px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <span className="text-secondary">{m.name}</span>
                </div>
                <span className="text-primary font-semibold tabular-nums">{m.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* User growth */}
      <Card className="min-w-0">
        <SectionHeading title="User growth" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MONTHLY}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Bar dataKey="users" name="users" fill="#00FFC8" radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Export section */}
      <Card>
        <SectionHeading title="Export reports" />
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Deposits report', sub: 'All deposit transactions' },
            { label: 'Cashouts report', sub: 'All withdrawal records' },
            { label: 'Users report', sub: 'User registration data' },
            { label: 'Revenue report', sub: 'Net revenue summary' },
          ].map((r, i) => (
            <button key={i} type="button" onClick={() => handleExport(r.label)} disabled={exporting}
              className={`${cardClass({ interactive: true })} !p-4 text-left flex items-center gap-3.5 min-h-[72px] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`}>
              <IconTile icon={Download} tone="cyan" />
              <span className="min-w-0">
                <span className="block text-primary text-[14px] font-semibold leading-snug">{r.label}</span>
                <span className="block text-[13px] text-secondary leading-snug">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
