'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Download, RefreshCw, Search, Zap, Wallet2 } from 'lucide-react'
import { adminApi } from '@/lib/api'

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

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '8h', label: 'Last 8 Hours' },
  { key: '24h', label: 'Last 24 Hours' },
  { key: 'all', label: 'All Time' },
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

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">GAME BALANCE REPORT</h2>
          <p className="text-secondary text-sm">Points added, withdrawn, and cashed out per user &amp; game — {rangeLabel.toLowerCase()}.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
          <button onClick={fetchReport} className="glass border border-border-strong rounded-xl px-3 py-2 text-secondary hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Provider (agent) remaining balances — separate from the per-user table below */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wallet2 className="w-4 h-4 text-neon-blue" /> Remaining Balance Per Game (Agent Accounts)
          </h3>
          <button onClick={fetchProviderBalances} disabled={balancesLoading} className="text-secondary hover:text-white transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${balancesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {balancesLoading ? (
          <p className="text-muted text-sm">Checking every provider's agent balance...</p>
        ) : providerBalances.length === 0 ? (
          <p className="text-muted text-sm">No active providers configured.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {providerBalances.map(p => (
              <div key={p.providerId} className="bg-white/5 rounded-xl p-3 border border-border-subtle">
                <p className="text-xs text-muted mb-1 truncate">{p.providerName}</p>
                {p.balance !== null ? (
                  <p className="text-lg font-bold text-emerald-400">{money(p.balance)}</p>
                ) : (
                  <p className="text-xs text-red-400" title={p.error || undefined}>Unreachable</p>
                )}
                <p className="text-[11px] text-amber-400 mt-1">Used today: {money(p.usedToday)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 bg-white/5 rounded-xl p-1 border border-border-subtle">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r.key ? 'bg-neon-blue text-black' : 'text-secondary hover:text-white'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select value={providerId} onChange={e => setProviderId(e.target.value)} className="input-neon !w-auto text-sm py-2">
          <option value="">All Games</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search username, email, or account..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-neon pl-9 text-sm py-2 w-full"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} className="accent-neon-blue w-4 h-4" />
          Only show accounts active in this period
        </label>
      </div>

      {/* Summary tiles (selected period) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted mb-1">Base Points Added ({rangeLabel})</p>
          <p className="text-xl font-bold text-emerald-400">{money(totals.pointsAdded)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted mb-1">Bonus Added — Estimated ({rangeLabel})</p>
          <p className="text-xl font-bold text-purple-400">{money(totals.bonus)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted mb-1">Total Withdrawn From Games ({rangeLabel})</p>
          <p className="text-xl font-bold text-amber-400">{money(totals.pointsWithdrawn)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted mb-1">Total Platform Cashouts ({rangeLabel})</p>
          <p className="text-xl font-bold text-neon-blue">{money(totals.cashout)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <p className="text-xs text-muted px-4 pt-3">
          "Bonus" and "Total Added" are estimated — recharges also credit a welcome/deposit bonus to the player's live game balance that isn't stored per-transaction, so it's re-derived here using the same 100%-first-recharge / 30%-after rule the app applies. Use "Live Balance" for the exact figure.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 min-w-[1300px]">
            <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">In-Game Account</th>
                <th className="px-4 py-3 font-medium">Base Added</th>
                <th className="px-4 py-3 font-medium">Bonus (Est.)</th>
                <th className="px-4 py-3 font-medium">Total Added</th>
                <th className="px-4 py-3 font-medium">Withdrawn</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Cashout</th>
                <th className="px-4 py-3 font-medium">Total (All-Time)</th>
                <th className="px-4 py-3 font-medium">Live Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-muted">Loading report...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted">
                    {onlyActive
                      ? `No accounts had any recharge/withdraw activity in the ${rangeLabel.toLowerCase()}. Try a wider period or uncheck "Only show accounts active in this period".`
                      : 'No game accounts found for this filter.'}
                  </td>
                </tr>
              ) : rows.map(r => {
                const key = `${r.userId}:${r.providerId}`
                const live = liveBalances[key]
                const s = r.windows[range]
                return (
                  <tr key={key} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{r.username}</p>
                      <p className="text-xs text-muted">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">{r.providerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neon-blue">{r.accountName}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{money(s.pointsAdded)}</td>
                    <td className="px-4 py-3 text-purple-400">{money(s.bonus)}</td>
                    <td className="px-4 py-3 text-white font-semibold">{money(s.totalAdded)}</td>
                    <td className="px-4 py-3 text-amber-400">{money(s.pointsWithdrawn)}</td>
                    <td className={`px-4 py-3 font-semibold ${s.net >= 0 ? 'text-white' : 'text-red-400'}`}>{money(s.net)}</td>
                    <td className="px-4 py-3 text-neon-blue">{money(s.cashout)}</td>
                    <td className="px-4 py-3 text-secondary">{money(r.windows.all.totalAdded)}</td>
                    <td className="px-4 py-3">
                      {live === undefined && (
                        <button onClick={() => fetchLiveBalance(r)} className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg text-white transition-colors">
                          <Zap className="w-3 h-3" /> Check
                        </button>
                      )}
                      {live === 'loading' && <span className="text-xs text-muted">Checking...</span>}
                      {live === 'error' && (
                        <button onClick={() => fetchLiveBalance(r)} className="text-xs text-red-400 hover:underline">Retry</button>
                      )}
                      {typeof live === 'number' && <span className="text-white font-bold">{money(live)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
