'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Download, Calendar, TrendingUp, Users, CreditCard, ArrowUpCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'

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

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) return (
    <div className="glass-card px-4 py-3 text-xs border border-border-strong">
      <p className="text-secondary mb-2 font-medium">{label}</p>
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">REPORTS & ANALYTICS</h2>
          <p className="text-secondary text-sm">Platform performance and financial reports.</p>
        </div>
        <div className="flex gap-2">
          {['7m', '3m', '1m', '1w'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-mono transition-all ${period === p ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' : 'glass text-secondary border border-border-strong'}`}>
              {p}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Deposits', value: `$${(totalDeposits / 1000).toFixed(1)}K`, icon: CreditCard, color: '#00D4FF' },
          { label: 'Total Cashouts', value: `$${(totalWithdrawals / 1000).toFixed(1)}K`, icon: ArrowUpCircle, color: '#7B2FFF' },
          { label: 'Net Revenue', value: `$${(netRevenue / 1000).toFixed(1)}K`, icon: TrendingUp, color: '#00FF88' },
          { label: 'New Users', value: totalUsers.toLocaleString(), icon: Users, color: '#FF2D9B' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="text-xs text-muted">{s.label}</span>
            </div>
            <p className="font-display font-black text-2xl text-white">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="xl:col-span-2 glass-card p-5">
          <h3 className="font-display font-bold text-sm text-white mb-4">DEPOSITS VS CASHOUTS</h3>
          <ResponsiveContainer width="100%" height={240}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#00D4FF" fill="url(#dGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" name="Cashouts" stroke="#7B2FFF" fill="url(#wGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card p-5">
          <h3 className="font-display font-bold text-sm text-white mb-4">PAYMENT METHODS</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PAYMENT_METHODS} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {PAYMENT_METHODS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value}%`} contentStyle={{ background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {PAYMENT_METHODS.map(m => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-secondary">{m.name}</span>
                </div>
                <span className="text-secondary font-mono">{m.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* User growth */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
        <h3 className="font-display font-bold text-sm text-white mb-4">USER GROWTH</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={MONTHLY}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Bar dataKey="users" name="users" fill="#00FFC8" radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Export section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5">
        <h3 className="font-display font-bold text-sm text-white mb-4">EXPORT REPORTS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Deposits Report', sub: 'All deposit transactions' },
            { label: 'Cashouts Report', sub: 'All withdrawal records' },
            { label: 'Users Report', sub: 'User registration data' },
            { label: 'Revenue Report', sub: 'Net revenue summary' },
          ].map((r, i) => (
            <button key={i} onClick={() => handleExport(r.label)} disabled={exporting}
              className="glass-card p-4 text-left hover:border-neon-blue/20 transition-all group disabled:opacity-50">
              <Download className="w-5 h-5 text-muted group-hover:text-neon-blue transition-colors mb-2" />
              <p className="text-white text-sm font-medium">{r.label}</p>
              <p className="text-xs text-muted">{r.sub}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
