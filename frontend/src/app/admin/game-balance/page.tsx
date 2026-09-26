'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Download, RefreshCw, Search, Zap, Wallet2, Info, Gamepad2 } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { PageHeader, SectionHeading, Card, Button, TabBar, EmptyState, IconTile } from '@/components/dashboard/ui'
import { INPUT, NUM, TH, TD, IconBtn, SwitchRow, TableCard, SkeletonRows } from '../_kit'

type WindowStats = { pointsAdded: number; bonus: number; totalAdded: number; pointsWithdrawn: number; net: number; cashout: number }

type ReportRow = {
  userId: string
  username: string
  email: string
  providerId: string
  providerName: string
  accountName: string
  providerUserId: string
  windows: { '8h': WindowStats; '24h': WindowStats; all: WindowStats }
}

type Provider = { id: string; name: string }
type ProviderBalance = { providerId: string; providerName: string; balance: number | null; usedToday: number; error: string | null }
type RangeKey = '8h' | '24h' | 'all'

const RANGES: { key: RangeKey; label: string; short: string }[] = [
  { key: '8h', label: 'Last 8 Hours', short: '8h' },
  { key: '24h', label: 'Last 24 Hours', short: '24h' },
  { key: 'all', label: 'All Time', short: 'All' },
]

const money = (n: number) => `$${(n || 0).toFixed(2)}`

export default function AdminGameBalancePage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [range, setRange] = useState<RangeKey>('8h')
  const [providerId, setProviderId] = useState('')
  const [search, setSearch] = useState('')
  // Most game accounts are created but never touched again — hide the ones
  // with no activity in the selected period so the report stays meaningful.
  const [onlyActive, setOnlyActive] = useState(true)
  // Live balances are fetched on demand per row (not in bulk) so opening this
  // page never has to wait on N external provider API calls.
  const [liveBalances, setLiveBalances] = useState<Record<string, number | 'loading' | 'error'>>({})

  const [providerBalances, setProviderBalances] = useState<ProviderBalance[]>([])
  const [balancesLoading, setBalancesLoading] = useState(true)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await adminApi.getProviders()
      setProviders(res.data.data || [])
    } catch { /* non-critical — filter dropdown just stays empty */ }
  }, [])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getGameBalanceReport({ range, providerId: providerId || undefined, search: search || undefined, onlyActive })
      setRows(res.data.data || [])
    } catch {
      toast.error('Failed to load game balance report')
    } finally {
      setLoading(false)
    }
  }, [range, providerId, search, onlyActive])

  // How much credit is left in each provider's own agent account (the pool
  // players get recharged from) — independent of the per-user table above,
  // so it loads on its own and a slow/unreachable provider can't block it.
  const fetchProviderBalances = useCallback(async () => {
    setBalancesLoading(true)
    try {
      const res = await adminApi.getProviderAgentBalances()
      setProviderBalances(res.data.data || [])
    } catch {
      toast.error('Failed to load provider balances')
    } finally {
      setBalancesLoading(false)
    }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])
  useEffect(() => { fetchProviderBalances() }, [fetchProviderBalances])
  useEffect(() => {
    const t = setTimeout(fetchReport, 300) // debounce search typing
    return () => clearTimeout(t)
  }, [fetchReport])

  const fetchLiveBalance = async (row: ReportRow) => {
    const key = `${row.userId}:${row.providerId}`
    setLiveBalances(prev => ({ ...prev, [key]: 'loading' }))
    try {
      const res = await adminApi.getLiveGameBalance({ userId: row.userId, providerId: row.providerId })
      setLiveBalances(prev => ({ ...prev, [key]: res.data.data.balance }))
    } catch {
      setLiveBalances(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Includes live balances server-side — can take a little longer than a
      // normal page load since it checks every account against its provider.
      toast.loading('Building report (this checks live game balances, may take a moment)...', { id: 'export' })
      const res = await adminApi.exportGameBalanceReport({ range, providerId: providerId || undefined, search: search || undefined, onlyActive })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `game-balance-report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Report exported successfully!', { id: 'export' })
    } catch {
      toast.error('Export failed', { id: 'export' })
    } finally {
      setExporting(false)
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      pointsAdded: acc.pointsAdded + r.windows[range].pointsAdded,
      bonus: acc.bonus + r.windows[range].bonus,
      totalAdded: acc.totalAdded + r.windows[range].totalAdded,
      pointsWithdrawn: acc.pointsWithdrawn + r.windows[range].pointsWithdrawn,
      cashout: acc.cashout + r.windows[range].cashout,
    }),
    { pointsAdded: 0, bonus: 0, totalAdded: 0, pointsWithdrawn: 0, cashout: 0 }
  )

  const rangeLabel = RANGES.find(r => r.key === range)?.label || ''

  const summary = [
    { label: 'Base points added', value: totals.pointsAdded, cls: NUM.green },
    { label: 'Bonus added (estimated)', value: totals.bonus, cls: NUM.purple },
    { label: 'Total withdrawn from games', value: totals.pointsWithdrawn, cls: NUM.amber },
    { label: 'Total platform cashouts', value: totals.cashout, cls: NUM.cyan },
  ]

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Game balances"
        subtitle={<>Points added, withdrawn, and cashed out per user &amp; game — {rangeLabel.toLowerCase()}.</>}
        actions={
          <>
            <Button variant="success" onClick={handleExport} disabled={exporting || rows.length === 0}>
              <Download className="w-5 h-5" />
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </Button>
            <IconBtn size="lg" label="Refresh report" onClick={fetchReport}><RefreshCw className="w-5 h-5" /></IconBtn>
          </>
        }
      />

      {/* Provider (agent) remaining balances — separate from the per-user table below */}
      <Card>
        <SectionHeading
          title={<span className="flex items-center gap-2.5"><IconTile icon={Wallet2} tone="cyan" size="sm" />Remaining balance per game <span className="hidden sm:inline text-muted font-medium text-[14px]">(agent accounts)</span></span>}
          action={
            <IconBtn label="Refresh agent balances" onClick={fetchProviderBalances} disabled={balancesLoading}>
              <RefreshCw className={`w-4 h-4 ${balancesLoading ? 'animate-spin' : ''}`} />
            </IconBtn>
          }
        />
        {balancesLoading ? (
          <p className="text-secondary text-[14px]">Checking every provider&apos;s agent balance...</p>
        ) : providerBalances.length === 0 ? (
          <p className="text-secondary text-[14px]">No active providers configured.</p>
        ) : (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {providerBalances.map(p => (
              <div key={p.providerId} className="rounded-2xl bg-surface-elevated border border-border-subtle px-4 py-3.5 min-w-0">
                <p className="text-[13px] text-secondary mb-1.5 truncate">{p.providerName}</p>
                {p.balance !== null ? (
                  <p className={`text-[22px] font-bold leading-none tabular-nums truncate ${NUM.green}`}>{money(p.balance)}</p>
                ) : (
                  <p className={`text-[15px] font-semibold leading-none ${NUM.red}`} title={p.error || undefined}>Unreachable</p>
                )}
                <p className={`text-xs mt-2 tabular-nums truncate ${NUM.amber}`}>Used today: {money(p.usedToday)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <TabBar
            className="self-start"
            tabs={RANGES.map(r => ({ id: r.key, label: <><span className="sm:hidden">{r.short}</span><span className="hidden sm:inline">{r.label}</span></> }))}
            active={range}
            onChange={setRange}
          />

          <select value={providerId} onChange={e => setProviderId(e.target.value)} className={`${INPUT} lg:!w-52`} aria-label="Filter by game">
            <option value="">All Games</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search username, email, or account..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${INPUT} !pl-11`}
            />
          </div>
        </div>
        <SwitchRow className="mt-3" label="Only show accounts active in this period" on={onlyActive} onToggle={() => setOnlyActive(v => !v)} />
      </Card>

      {/* Summary tiles (selected period) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {summary.map(s => (
          <div key={s.label} className="ds-card p-4 sm:p-5 min-w-0">
            <p className="text-[13px] text-secondary leading-snug mb-2">{s.label}</p>
            <p className={`text-[22px] sm:text-[26px] font-bold leading-none tabular-nums truncate ${s.cls}`}>{money(s.value)}</p>
            <p className="text-xs text-muted mt-2">{rangeLabel}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl p-4 flex gap-3 bg-surface-elevated border border-border-subtle">
        <Info className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-secondary leading-relaxed">
          &quot;Bonus&quot; and &quot;Total Added&quot; are estimated — recharges also credit a welcome/deposit bonus to the player&apos;s live game balance that isn&apos;t stored per-transaction, so it&apos;s re-derived here using the same 100%-first-recharge / 30%-after rule the app applies. Use &quot;Live Balance&quot; for the exact figure.
        </p>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gamepad2}
            title="No accounts to show"
            text={onlyActive
              ? `No accounts had any recharge/withdraw activity in the ${rangeLabel.toLowerCase()}. Try a wider period or turn off "Only show accounts active in this period".`
              : 'No game accounts found for this filter.'}
          />
        </Card>
      ) : (
        <TableCard>
          <table className="data-table min-w-[1300px]">
            <thead>
              <tr>
                <th className={TH}>User</th>
                <th className={TH}>Game</th>
                <th className={TH}>In-game account</th>
                <th className={TH}>Base added</th>
                <th className={TH}>Bonus (est.)</th>
                <th className={TH}>Total added</th>
                <th className={TH}>Withdrawn</th>
                <th className={TH}>Net</th>
                <th className={TH}>Cashout</th>
                <th className={TH}>Total (all-time)</th>
                <th className={TH}>Live balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const key = `${r.userId}:${r.providerId}`
                const live = liveBalances[key]
                const s = r.windows[range]
                return (
                  <tr key={key}>
                    <td className={TD}>
                      <p className="text-primary text-[14px] font-semibold">{r.username}</p>
                      <p className="text-[13px] text-muted">{r.email}</p>
                    </td>
                    <td className={`${TD} text-[14px]`}>{r.providerName}</td>
                    <td className={`${TD} font-mono text-[13px] ${NUM.cyan}`}>{r.accountName}</td>
                    <td className={`${TD} text-[14px] font-semibold tabular-nums ${NUM.green}`}>{money(s.pointsAdded)}</td>
                    <td className={`${TD} text-[14px] tabular-nums ${NUM.purple}`}>{money(s.bonus)}</td>
                    <td className={`${TD} text-[14px] font-semibold tabular-nums text-primary`}>{money(s.totalAdded)}</td>
                    <td className={`${TD} text-[14px] tabular-nums ${NUM.amber}`}>{money(s.pointsWithdrawn)}</td>
                    <td className={`${TD} text-[14px] font-semibold tabular-nums ${s.net >= 0 ? 'text-primary' : NUM.red}`}>{money(s.net)}</td>
                    <td className={`${TD} text-[14px] tabular-nums ${NUM.cyan}`}>{money(s.cashout)}</td>
                    <td className={`${TD} text-[14px] tabular-nums`}>{money(r.windows.all.totalAdded)}</td>
                    <td className={TD}>
                      {live === undefined && (
                        <Button variant="secondary" size="sm" onClick={() => fetchLiveBalance(r)} className="!h-9 !px-3.5 !text-[13px] !rounded-xl">
                          <Zap className="w-3.5 h-3.5" /> Check
                        </Button>
                      )}
                      {live === 'loading' && <span className="text-[13px] text-muted">Checking...</span>}
                      {live === 'error' && (
                        <button onClick={() => fetchLiveBalance(r)} className={`min-h-[40px] px-2 text-[13px] font-semibold hover:underline ${NUM.red}`}>Retry</button>
                      )}
                      {typeof live === 'number' && <span className="text-primary text-[14px] font-bold tabular-nums">{money(live)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
