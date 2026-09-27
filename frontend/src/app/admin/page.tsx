'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, CreditCard, ArrowUpCircle, TrendingUp, Clock, DollarSign, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, EmptyState, IconTile, PageHeader, SectionHeading, Skeleton, TONES, cn, type Tone } from '@/components/dashboard/ui'

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) return (
    <div className="ds-card px-3.5 py-3 text-[13px]" style={{ borderRadius: 14 }}>
      <p className="text-secondary mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="tabular-nums font-semibold" style={{ color: p.color }}>{p.name}: ${p.value?.toLocaleString()}</p>
      ))}
    </div>
  )
  return null
}

const PENDING_TONE: Record<string, Tone> = { deposit: 'green', cashout: 'orange' }

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

  if (loading) return (
    <div aria-busy="true" aria-label="Loading dashboard data">
      <PageHeader title="Dashboard overview" subtitle="Platform performance at a glance." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[132px] !rounded-[20px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Skeleton className="xl:col-span-2 h-[340px] !rounded-[20px]" />
        <Skeleton className="h-[340px] !rounded-[20px]" />
      </div>
      <p className="sr-only">Loading dashboard data...</p>
    </div>
  )
  if (!stats) return (
    <Card>
      <EmptyState icon={AlertCircle} title="Failed to load dashboard" text="We couldn't reach the server. Check your connection and try again."
        action={<Button variant="secondary" onClick={fetchStats}><RefreshCw className="w-4 h-4" /> Try again</Button>} />
    </Card>
  )

  const STATS = [
    { label: 'Total users', value: stats.totalUsers.toLocaleString(), change: 'Live', icon: Users, tone: 'cyan' as Tone, sub: `${stats.activeUsers} active users` },
    { label: 'Total deposits', value: `$${stats.totalDeposits.toLocaleString()}`, change: 'Live', icon: CreditCard, tone: 'green' as Tone, sub: `${stats.pendingDeposits} pending` },
    { label: 'Total cashouts', value: `$${stats.totalWithdrawals.toLocaleString()}`, change: 'Live', icon: ArrowUpCircle, tone: 'purple' as Tone, sub: `${stats.pendingWithdrawals} pending` },
    { label: 'Net revenue', value: `$${stats.netRevenue.toLocaleString()}`, change: 'Live', icon: TrendingUp, tone: 'pink' as Tone, sub: 'All time' },
  ]

  const QUICK = [
    { label: 'Pending deposits', value: stats.pendingDeposits, icon: Clock, tone: 'gold' as Tone },
    { label: 'Pending cashouts', value: stats.pendingWithdrawals, icon: AlertCircle, tone: 'orange' as Tone },
    { label: 'Today\'s deposits', value: `$${stats.todayDeposits}`, icon: DollarSign, tone: 'green' as Tone },
    { label: 'Today\'s cashouts', value: `$${stats.todayWithdrawals}`, icon: TrendingUp, tone: 'cyan' as Tone },
    { label: 'Active users', value: stats.activeUsers, icon: Users, tone: 'purple' as Tone },
  ]

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Dashboard overview"
          subtitle="Platform performance at a glance."
          actions={<Button variant="secondary" size="sm" onClick={fetchStats}><RefreshCw className="w-4 h-4" /> Refresh</Button>}
        />
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {STATS.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="ds-card p-4 sm:p-5 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-4">
              <IconTile icon={stat.icon} tone={stat.tone} size="md" />
              <Badge tone="green" dot>{stat.change}</Badge>
            </div>
            <p className="text-[22px] sm:text-[28px] font-bold text-primary leading-none tabular-nums truncate">{stat.value}</p>
            <p className="mt-2 text-[13px] sm:text-sm font-medium text-secondary">{stat.label}</p>
            <p className="mt-0.5 text-xs text-muted">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 mb-5 sm:mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-2 ds-card p-4 sm:p-6 min-w-0">
          <SectionHeading title="Monthly revenue" />
          {stats.revenueData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.revenueData}>
                <defs>
                  <linearGradient id="depositGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cashoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CUSTOM_TOOLTIP />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#38BDF8" fill="url(#depositGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="cashouts" name="Cashouts" stroke="#A78BFA" fill="url(#cashoutGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <EmptyState icon={TrendingUp} title="No revenue data yet" text="Chart appears once deposit/cashout activity is recorded." />
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="ds-card p-4 sm:p-6 min-w-0">
          <SectionHeading title="Daily activity" />
          {stats.dailyData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<CUSTOM_TOOLTIP />} cursor={{ fill: 'var(--ds-hover)' }} />
                <Bar dataKey="users" name="Users" fill="#34D399" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <EmptyState icon={Users} title="No activity data yet" text="Chart appears once daily user activity is recorded." />
            </div>
          )}
        </motion.div>
      </div>

      {/* Pending Actions & Quick stats */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="ds-card p-4 sm:p-6 min-w-0">
          <SectionHeading title="Needs attention" action={<Badge tone="orange">{stats.pendingItems?.length || 0} items</Badge>} />
          <div className="space-y-2.5">
            {stats.pendingItems?.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <IconTile icon={CheckCircle2} tone="green" size="md" className="!rounded-full" />
                <p className="text-secondary text-[14px]">All caught up!</p>
              </div>
            ) : stats.pendingItems?.map((item: any, i: number) => {
              const tone: Tone = PENDING_TONE[item.type] || 'red'
              return (
                <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-elevated border border-border-subtle px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TONES[tone].fg }} />
                    <div className="min-w-0">
                      <p className="text-[14px] text-primary font-semibold truncate">{item.user}</p>
                      <p className="text-[13px] text-muted truncate">
                        {item.type === 'deposit' ? `Deposit ${item.amount} via ${item.method}`
                         : item.type === 'cashout' ? `Cashout ${item.amount} via ${item.method}`
                         : item.subject}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted">{item.time}</p>
                    <p className="text-xs font-semibold capitalize" style={{ color: TONES[tone].fg }}>{item.type}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="ds-card p-4 sm:p-6 min-w-0">
          <SectionHeading title="Quick stats" />
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3 [&>:last-child:nth-child(odd)]:min-[420px]:col-span-2">
            {QUICK.map((s, i) => (
              <div key={i} className="rounded-2xl bg-surface-elevated border border-border-subtle p-4 flex items-center gap-3 min-w-0">
                <IconTile icon={s.icon} tone={s.tone} size="sm" />
                <div className="min-w-0">
                  <p className={cn('text-primary font-bold text-xl leading-none tabular-nums truncate')}>{s.value}</p>
                  <p className="text-muted text-[13px] mt-1.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
