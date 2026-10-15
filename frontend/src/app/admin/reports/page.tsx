'use client'
import { useEffect, useState, useCallback } from 'react'
import { Download, TrendingUp, Users, CreditCard, ArrowUpCircle, RefreshCw, AlertCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'
import { PageHeader, SectionHeading, Card, StatCard, TabBar, IconTile, Skeleton, cardClass } from '@/components/dashboard/ui'

type Money = { amount: number; count: number }
type Windows = { h24: Money; d7: Money; d30: Money; all: Money }
type Summary = {
  period: string
  generatedAt: string
  totals: { deposits: Money; cashouts: Money; net: number; newUsers: number }
  windows: Record<'h24' | 'd7' | 'd30' | 'all', { deposits: Money; cashouts: Money; net: number }>
  methods: { name: string; code: string; deposits: Windows; cashouts: Windows }[]
  share: { name: string; amount: number; percent: number }[]
  series: { label: string; deposits: number; cashouts: number; users: number }[]
  pending: { deposits: Money; cashouts: Money }
  adminCredits: Windows
  adminVoids: Windows
}

const PERIODS = [
  { id: '7m', label: '7 mo' },
  { id: '3m', label: '3 mo' },
  { id: '1m', label: '1 mo' },
  { id: '1w', label: '1 wk' },
]
const WINDOW_COLS: { key: keyof Windows; label: string }[] = [
  { key: 'h24', label: 'Last 24 hours' },
  { key: 'd7', label: 'Last 7 days' },
  { key: 'd30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
]
const PIE_COLORS = ['#00D4FF', '#7B2FFF', '#00FFC8', '#F7931A', '#FF5C8A', '#627EEA', '#26A17B', '#FACC15']

const AXIS_TICK = { fill: '#8091AB', fontSize: 12 }
const GRID_STROKE = 'rgba(128,145,171,0.18)'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const compact = (n: number) => (Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}K` : money(n))

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (active && payload?.length) return (
    <div className="ds-card px-4 py-3 text-[13px]">
      <p className="text-primary mb-1.5 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {p.name === 'New users' ? p.value : money(p.value)}
        </p>
      ))}
    </div>
  )
  return null
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

function MethodTable({ title, rows, kind }: { title: string; rows: Summary['methods']; kind: 'deposits' | 'cashouts' }) {
  const list = rows.filter(r => WINDOW_COLS.some(c => r[kind][c.key].count > 0))
  const totals = WINDOW_COLS.map(c => list.reduce((s, r) => ({ amount: s.amount + r[kind][c.key].amount, count: s.count + r[kind][c.key].count }), { amount: 0, count: 0 }))
  return (
    <Card padded={false} className="overflow-hidden min-w-0">
      <div className="p-4 sm:p-6 pb-3 sm:pb-3"><SectionHeading title={title} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px] min-w-[620px]">
          <thead className="bg-surface-elevated text-muted text-xs">
            <tr>
              <th className="px-4 sm:px-6 py-3 font-semibold">Payment method</th>
              {WINDOW_COLS.map(c => <th key={c.key} className="px-4 py-3 font-semibold text-right whitespace-nowrap">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">No {kind === 'deposits' ? 'deposits' : 'cashouts'} yet.</td></tr>
            ) : list.map(r => (
              <tr key={r.code + r.name} className="border-t border-border-subtle">
                <td className="px-4 sm:px-6 py-3 text-primary font-medium whitespace-nowrap">{r.name}</td>
                {WINDOW_COLS.map(c => (
                  <td key={c.key} className="px-4 py-3 text-right tabular-nums">
                    <span className={r[kind][c.key].count ? 'text-primary font-semibold' : 'text-muted'}>{money(r[kind][c.key].amount)}</span>
                    <span className="block text-[11px] text-muted">{r[kind][c.key].count} {r[kind][c.key].count === 1 ? 'txn' : 'txns'}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border-strong bg-surface-elevated">
                <td className="px-4 sm:px-6 py-3 text-primary font-bold">Total</td>
                {totals.map((t, i) => (
                  <td key={i} className="px-4 py-3 text-right tabular-nums">
                    <span className="text-primary font-bold">{money(t.amount)}</span>
                    <span className="block text-[11px] text-muted">{t.count} txns</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  )
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('7m')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await adminApi.getReportsSummary(p)
      setData(res.data.data)
    } catch {
      setFailed(true)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const exportBreakdown = () => {
    if (!data) return
    const rows: (string | number)[][] = [['Type', 'Payment method', ...WINDOW_COLS.flatMap(c => [`${c.label} amount`, `${c.label} count`])]]
    for (const kind of ['deposits', 'cashouts'] as const) {
      for (const m of data.methods) rows.push([kind === 'deposits' ? 'Deposits received' : 'Cashouts paid', m.name, ...WINDOW_COLS.flatMap(c => [m[kind][c.key].amount, m[kind][c.key].count])])
    }
    downloadCsv(`breakdown-by-payment-method-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success('Breakdown exported')
  }
  const exportSeries = () => {
    if (!data) return
    downloadCsv(`deposits-vs-cashouts-${period}-${new Date().toISOString().slice(0, 10)}.csv`, [['Period', 'Deposits', 'Cashouts', 'Net', 'New users'], ...data.series.map(s => [s.label, s.deposits, s.cashouts, Math.round((s.deposits - s.cashouts) * 100) / 100, s.users])])
    toast.success('Time series exported')
  }

  const t = data?.totals
  const chartData = data?.series.map(s => ({ ...s, label: s.label })) || []

  return (
    <div className="space-y-5 sm:space-y-6 pb-10">
      <PageHeader
        title="Reports & analytics"
        subtitle="Money received per payment method, cashouts, and platform performance."
        actions={
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => load(period)} disabled={loading} aria-label="Refresh reports"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated border border-border-strong text-secondary hover:text-primary transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <TabBar tabs={PERIODS} active={period} onChange={setPeriod} />
          </div>
        }
      />

      {failed && !data && (
        <Card><div className="flex items-center gap-3 text-[14px] text-secondary"><AlertCircle className="w-5 h-5 text-red-400" /> Could not load the report. Press refresh to try again.</div></Card>
      )}

      {/* Summary cards (selected period) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
        {loading && !data ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[150px] !rounded-[20px]" />) : [
          { label: 'Total deposits', value: compact(t?.deposits.amount ?? 0), icon: CreditCard, tone: 'cyan' as const },
          { label: 'Total cashouts', value: compact(t?.cashouts.amount ?? 0), icon: ArrowUpCircle, tone: 'purple' as const },
          { label: 'Net (deposits − cashouts)', value: compact(t?.net ?? 0), icon: TrendingUp, tone: 'green' as const },
          { label: 'New users', value: (t?.newUsers ?? 0).toLocaleString(), icon: Users, tone: 'pink' as const },
        ].map((s, i) => <StatCard key={i} icon={s.icon} tone={s.tone} value={s.value} label={s.label} />)}
      </div>

      {data && (
        <>
          {/* 24h / 7d / 30d / all time */}
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {WINDOW_COLS.map(c => {
              const w = data.windows[c.key]
              return (
                <Card key={c.key} className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-3">{c.label}</p>
                  <div className="space-y-2 text-[14px]">
                    <div className="flex justify-between gap-2"><span className="text-secondary">Received</span><span className="text-emerald-400 font-bold tabular-nums">{money(w.deposits.amount)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-secondary">Cashed out</span><span className="text-violet-400 font-bold tabular-nums">{money(w.cashouts.amount)}</span></div>
                    <div className="flex justify-between gap-2 pt-2 border-t border-border-subtle"><span className="text-secondary">Net</span><span className={`font-bold tabular-nums ${w.net >= 0 ? 'text-primary' : 'text-red-400'}`}>{money(w.net)}</span></div>
                    <p className="text-[11px] text-muted">{w.deposits.count} deposits · {w.cashouts.count} cashouts</p>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Breakdown tables */}
          <MethodTable title="Money received by payment method" rows={data.methods} kind="deposits" />
          <MethodTable title="Cashouts by payment method" rows={data.methods} kind="cashouts" />

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
            <Card className="xl:col-span-2 min-w-0">
              <SectionHeading title="Deposits vs cashouts" />
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
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
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#8091AB' }} />
                  <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#00D4FF" fill="url(#dGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cashouts" name="Cashouts" stroke="#7B2FFF" fill="url(#wGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="min-w-0">
              <SectionHeading title="Payment methods (selected period)" />
              {data.share.length === 0 ? (
                <p className="text-[14px] text-muted py-10 text-center">No deposits in this period.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.share} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="amount" nameKey="name">
                        {data.share.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => money(Number(value))} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5 mt-3">
                    {data.share.map((m, i) => (
                      <div key={m.name} className="flex items-center justify-between gap-2 text-[14px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-secondary truncate">{m.name}</span>
                        </div>
                        <span className="text-primary font-semibold tabular-nums whitespace-nowrap">{money(m.amount)} · {m.percent}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card className="min-w-0">
            <SectionHeading title="User growth" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CUSTOM_TOOLTIP />} />
                <Bar dataKey="users" name="New users" fill="#00FFC8" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Not counted above */}
          <Card>
            <SectionHeading title="Not included in the figures above" />
            <div className="grid grid-cols-1 min-[560px]:grid-cols-2 xl:grid-cols-4 gap-3 text-[14px]">
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-4">
                <p className="text-muted text-xs mb-1">Pending deposits</p>
                <p className="text-primary font-bold tabular-nums">{money(data.pending.deposits.amount)}</p>
                <p className="text-[11px] text-muted">{data.pending.deposits.count} waiting for approval</p>
              </div>
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-4">
                <p className="text-muted text-xs mb-1">Pending cashouts</p>
                <p className="text-primary font-bold tabular-nums">{money(data.pending.cashouts.amount)}</p>
                <p className="text-[11px] text-muted">{data.pending.cashouts.count} waiting for approval</p>
              </div>
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-4">
                <p className="text-muted text-xs mb-1">Admin manual credits</p>
                <p className="text-primary font-bold tabular-nums">{money(data.adminCredits.all.amount)} <span className="text-[11px] text-muted font-normal">all time</span></p>
                <p className="text-[11px] text-muted">24h {money(data.adminCredits.h24.amount)} · 7d {money(data.adminCredits.d7.amount)} · 30d {money(data.adminCredits.d30.amount)}</p>
              </div>
              <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-4">
                <p className="text-muted text-xs mb-1">Admin balance voids</p>
                <p className="text-primary font-bold tabular-nums">{money(data.adminVoids.all.amount)} <span className="text-[11px] text-muted font-normal">all time</span></p>
                <p className="text-[11px] text-muted">24h {money(data.adminVoids.h24.amount)} · 7d {money(data.adminVoids.d7.amount)} · 30d {money(data.adminVoids.d30.amount)}</p>
              </div>
            </div>
            <p className="text-[12px] text-muted mt-3">
              Deposits count once approved (by approval time); cashouts count once approved or paid. Times are UTC. Last updated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </Card>

          {/* Export */}
          <Card>
            <SectionHeading title="Export (CSV)" />
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
              {[
                { label: 'Breakdown by payment method', sub: 'Received and cashed out: 24h, 7d, 30d, all time', onClick: exportBreakdown },
                { label: 'Deposits vs cashouts', sub: 'Selected period, by day or month', onClick: exportSeries },
              ].map((r, i) => (
                <button key={i} type="button" onClick={r.onClick}
                  className={`${cardClass({ interactive: true })} !p-4 text-left flex items-center gap-3.5 min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`}>
                  <IconTile icon={Download} tone="cyan" />
                  <span className="min-w-0">
                    <span className="block text-primary text-[14px] font-semibold leading-snug">{r.label}</span>
                    <span className="block text-[13px] text-secondary leading-snug">{r.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
