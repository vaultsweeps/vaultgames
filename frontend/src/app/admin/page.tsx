'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, CreditCard, ArrowUpCircle, TrendingUp, Clock, DollarSign, AlertCircle, CheckCircle, HelpCircle, RefreshCw } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { adminApi } from '@/lib/api'

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) return (
    <div className="glass-card px-4 py-3 text-xs">
      <p className="text-secondary mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: ${p.value?.toLocaleString()}</p>
      ))}
    </div>
  )
  return null
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getDashboardStats()
      setStats(res.data.data)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) return <div className="text-center py-20 text-muted">Loading dashboard data...</div>
  if (!stats) return <div className="text-center py-20 text-red-500">Failed to load dashboard</div>

  const STATS = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), change: 'Live', icon: Users, color: '#00D4FF', sub: `${stats.activeUsers} active users` },
    { label: 'Total Deposits', value: `$${stats.totalDeposits.toLocaleString()}`, change: 'Live', icon: CreditCard, color: '#00FF88', sub: `${stats.pendingDeposits} pending` },
    { label: 'Total Cashouts', value: `$${stats.totalWithdrawals.toLocaleString()}`, change: 'Live', icon: ArrowUpCircle, color: '#7B2FFF', sub: `${stats.pendingWithdrawals} pending` },
    { label: 'Net Revenue', value: `$${stats.netRevenue.toLocaleString()}`, change: 'Live', icon: TrendingUp, color: '#FF2D9B', sub: 'All time' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-end">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">DASHBOARD OVERVIEW</h2>
          <p className="text-secondary text-sm">Platform performance at a glance.</p>
        </div>
        <button onClick={fetchStats} className="glass border border-border-strong rounded-xl px-3 py-2 text-secondary hover:text-white transition-all flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-xs font-medium text-green-400">{stat.change}</span>
            </div>
            <p className="font-display font-bold text-xl text-white mb-0.5">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="text-xs text-slate-600 mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-2 glass-card p-5">
          <h3 className="font-display font-bold text-sm text-white mb-4">MONTHLY REVENUE</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.revenueData}>
              <defs>
                <linearGradient id="depositGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cashoutGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B2FFF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7B2FFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#00D4FF" fill="url(#depositGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="cashouts" name="Cashouts" stroke="#7B2FFF" fill="url(#cashoutGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5">
          <h3 className="font-display font-bold text-sm text-white mb-4">DAILY ACTIVITY</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Bar dataKey="users" name="Users" fill="#00FFC8" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Pending Actions & Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Pending items */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm text-white">NEEDS ATTENTION</h3>
            <span className="badge-pending text-xs px-2 py-0.5 rounded-full font-mono">{stats.pendingItems?.length || 0} items</span>
          </div>
          <div className="space-y-3">
            {stats.pendingItems?.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">All caught up!</p>
            ) : stats.pendingItems?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between glass rounded-lg px-4 py-3 hover:border-border-strong border border-transparent transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === 'deposit' ? 'bg-green-400' : item.type === 'cashout' ? 'bg-orange-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <p className="text-sm text-white font-medium">{item.user}</p>
                    <p className="text-xs text-muted">
                      {item.type === 'deposit' ? `Deposit ${item.amount} via ${item.method}`
                       : item.type === 'cashout' ? `Cashout ${item.amount} via ${item.method}`
                       : item.subject}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600">{item.time}</p>
                  <p className={`text-xs font-mono capitalize ${
                    item.type === 'deposit' ? 'text-green-400' : item.type === 'cashout' ? 'text-orange-400' : 'text-red-400'
                  }`}>{item.type}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card p-5">
          <h3 className="font-display font-bold text-sm text-white mb-4">QUICK STATS</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Deposits', value: stats.pendingDeposits, icon: Clock, color: '#FFD700' },
              { label: 'Pending Cashouts', value: stats.pendingWithdrawals, icon: AlertCircle, color: '#FF8C00' },
              { label: 'Today\'s Deposits', value: `$${stats.todayDeposits}`, icon: DollarSign, color: '#00FFC8' },
              { label: 'Today\'s Cashouts', value: `$${stats.todayWithdrawals}`, icon: TrendingUp, color: '#00D4FF' },
              { label: 'Active Users', value: stats.activeUsers, icon: Users, color: '#7B2FFF' },
            ].map((s, i) => (
              <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}15` }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-none">{s.value}</p>
                  <p className="text-muted text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Removed dummy HelpCircle
