import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { ProviderService } from '../services/provider/ProviderService'
import { createProviderService, ProviderFactory } from '../services/provider/ProviderFactory'
import * as XLSX from 'xlsx'
import { assertPublicHttpUrl } from '../utils/safe'
import { securityLog } from '../middleware/security'

// The raw secretKey (used to sign requests to the provider's real-money API)
// should never round-trip back to the browser — only a short preview so the
// admin can tell providers apart, never the value needed to forge requests.
function maskProvider<T extends { secretKey: string }>(provider: T) {
  const { secretKey, ...rest } = provider
  return { ...rest, secretKeyPreview: secretKey ? `••••${secretKey.slice(-4)}` : null }
}

export const getProviders = asyncHandler(async (req: Request, res: Response) => {
  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: 'desc' },
    include: { games: { select: { id: true, name: true, thumbnailUrl: true } } }
  })
  res.json({ success: true, data: providers.map(maskProvider) })
})

// Provider credentials are sent to whatever URL is configured here, so the URL is validated like an outbound-request target:
// http(s) only, no embedded credentials, and never a loopback/private/metadata host (SSRF + secret-exfiltration guard).
async function validateProviderInput(body: any) {
  if (body.apiBaseUrl !== undefined) {
    try { await assertPublicHttpUrl(String(body.apiBaseUrl)) } catch (e: any) { throw new AppError(`Invalid API base URL: ${e.message}`, 400) }
  }
  if (body.endpoints !== undefined && body.endpoints !== null) {
    if (typeof body.endpoints !== 'object' || Array.isArray(body.endpoints)) throw new AppError('Endpoints must be an object', 400)
    for (const [k, v] of Object.entries(body.endpoints as Record<string, unknown>)) {
      // An absolute URL here would override the base URL and bypass the check above
      if (typeof v === 'string' && /^(https?:)?\/\//i.test(v.trim())) throw new AppError(`Endpoint "${k}" must be a path, not a full URL`, 400)
    }
  }
  const t = body.requestTimeout !== undefined && body.requestTimeout !== '' ? Number(body.requestTimeout) : undefined
  if (t !== undefined && (!Number.isFinite(t) || t < 1000 || t > 60000)) throw new AppError('Timeout must be between 1000 and 60000 ms', 400)
  const r = body.retryCount !== undefined && body.retryCount !== '' ? Number(body.retryCount) : undefined
  if (r !== undefined && (!Number.isFinite(r) || r < 0 || r > 5)) throw new AppError('Retry count must be between 0 and 5', 400)
}

export const createProvider = asyncHandler(async (req: Request, res: Response) => {
  const { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout, retryCount, endpoints } = req.body
  await validateProviderInput(req.body)
  securityLog('admin_action', req as any, { action: 'provider_create', name: String(name).slice(0, 60) })
  const provider = await prisma.provider.create({
    data: { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout: Number(requestTimeout), retryCount: Number(retryCount), endpoints: endpoints || {} }
  })
  res.status(201).json({ success: true, data: maskProvider(provider) })
})

export const updateProvider = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout, retryCount, status, endpoints } = req.body
  await validateProviderInput(req.body)

  // Pointing an existing provider at a different host would make the server send the STORED secret to that host
  // (masked in the UI, but sent in the login request). Changing the URL therefore requires re-entering the secret.
  if (apiBaseUrl !== undefined) {
    const current = await prisma.provider.findUnique({ where: { id: id as string }, select: { apiBaseUrl: true } })
    if (!current) throw new AppError('Provider not found', 404)
    const norm = (u: string) => String(u).trim().replace(/\/+$/, '').toLowerCase()
    if (norm(current.apiBaseUrl) !== norm(apiBaseUrl) && !secretKey) {
      throw new AppError('When you change the API base URL, please re-enter the secret key as well.', 400)
    }
  }
  securityLog('admin_action', req as any, { action: 'provider_update', providerId: String(id), urlChanged: apiBaseUrl !== undefined, secretChanged: !!secretKey })
  const data: any = { name, apiBaseUrl, agentId, logo, status }
  if (secretKey) data.secretKey = secretKey
  if (requestTimeout) data.requestTimeout = Number(requestTimeout)
  if (retryCount) data.retryCount = Number(retryCount)
  if (endpoints) data.endpoints = endpoints
  
  const provider = await prisma.provider.update({
    where: { id: id as string },
    data
  })
  res.json({ success: true, data: maskProvider(provider) })
})

export const deleteProvider = asyncHandler(async (req: Request, res: Response) => {
  await prisma.provider.delete({ where: { id: req.params.id as string } })
  res.json({ success: true, message: 'Provider deleted' })
})

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const provider = await prisma.provider.findUnique({ where: { id: req.params.id as string } })
  if (!provider) throw new AppError('Provider not found', 404)
  
  const service = createProviderService(provider)
  try {
    const balance = await service.getAgentBalance()
    res.json({ success: true, message: 'Connection successful', data: { balance } })
  } catch (error: any) {
    res.status(400).json({ success: false, message: String(error.message || 'Connection failed').slice(0, 300) })
  }
})

export const getProviderLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, providerId } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where = providerId ? { providerId: String(providerId) } : {}
  const [logs, total] = await Promise.all([
    prisma.providerLog.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
    prisma.providerLog.count({ where })
  ])
  res.json({ success: true, data: logs, pagination: { total, page: Number(page), limit: Number(limit) } })
})

export const getProviderTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, providerId } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where = providerId ? { providerId: String(providerId) } : {}
  const [txs, total] = await Promise.all([
    prisma.providerTransaction.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true }} } }),
    prisma.providerTransaction.count({ where })
  ])
  res.json({ success: true, data: txs, pagination: { total, page: Number(page), limit: Number(limit) } })
})

// PUT /api/admin/providers/:id/games — assign specific games to this provider
export const assignGamesToProvider = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { gameIds } = req.body // array of game IDs to assign

  if (!Array.isArray(gameIds)) throw new AppError('gameIds must be an array', 400)

  // First, clear any games currently assigned to this provider
  await prisma.game.updateMany({ where: { providerId: id as string }, data: { providerId: null } })

  // Then assign the new selection
  if (gameIds.length > 0) {
    await prisma.game.updateMany({ where: { id: { in: gameIds } }, data: { providerId: id as string } })
  }

  const updated = await prisma.provider.findUnique({
    where: { id: id as string },
    include: { games: { select: { id: true, name: true } } }
  })
  res.json({ success: true, data: updated ? maskProvider(updated) : null })
})

// ═══════════════════════════════════════════════════════════════════════════
// GAME BALANCE REPORT — per user/game breakdown of points added, points
// withdrawn back out of the game, and platform cashouts, reported for THREE
// windows at once (last 8h / last 24h / all time) so the admin never has to
// re-run the report per window. Live in-game balance is fetched on demand
// for the on-screen table (one external API call per click) but is fetched
// for every row — with bounded concurrency and a per-call timeout so a
// slow/unreachable provider can't hang the whole export — when exporting to
// Excel, since that's a one-off action where waiting is expected.
// ═══════════════════════════════════════════════════════════════════════════

const REPORT_WINDOWS = [
  { key: '8h', since: () => new Date(Date.now() - 8 * 60 * 60 * 1000) },
  { key: '24h', since: () => new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { key: 'all', since: () => null as Date | null },
] as const

type WindowKey = typeof REPORT_WINDOWS[number]['key']

async function buildGameBalanceReport(providerId: string | undefined, search: string | undefined, activeFilterWindow: WindowKey | null = null) {
  const providerUserWhere: any = {}
  if (providerId) providerUserWhere.providerId = providerId
  if (search && search.trim()) {
    const q = search.trim()
    providerUserWhere.OR = [
      { user: { username: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { accountName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const providerUsers = await prisma.providerUser.findMany({
    where: providerUserWhere,
    include: {
      user: { select: { id: true, username: true, email: true } },
      provider: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (providerUsers.length === 0) return []

  const userIds = [...new Set(providerUsers.map(pu => pu.userId))]
  const providerIds = [...new Set(providerUsers.map(pu => pu.providerId))]

  // `ProviderTransaction.amount` for a recharge only ever stores the base
  // wallet amount the user actually paid — NOT the welcome/deposit bonus
  // that providerController.transferFunds also sends to the provider
  // (`finalProviderAmount = amount + bonusAmount`). That's correct for
  // WalletService's balance math (the bonus was never deducted from real
  // wallet cash), but it means this figure alone never matches what actually
  // landed in the player's live game balance. The bonus isn't stored
  // per-transaction anywhere, so it's re-derived here using the exact same
  // rule transferFunds applies (100% on a user's first-ever verified
  // recharge across ANY game, 30% on every recharge after) — hence "Bonus"
  // is an estimate, not stored ground truth, and is labeled as such.
  const [allUserRecharges, scopedWithdraws, cashoutWithdrawals, users] = await Promise.all([
    prisma.providerTransaction.findMany({
      where: { userId: { in: userIds }, type: 'recharge', status: 'success' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, providerId: true, amount: true, createdAt: true },
    }),
    prisma.providerTransaction.findMany({
      where: { userId: { in: userIds }, providerId: { in: providerIds }, type: 'withdraw', status: 'success' },
      select: { userId: true, providerId: true, amount: true, createdAt: true },
    }),
    // Real-money cashouts aren't tied to a specific game/provider — tracked
    // per-user only (shown per row, not summed across a user's multiple games).
    prisma.withdrawal.findMany({
      where: { userId: { in: userIds }, status: { in: ['approved', 'paid'] } },
      select: { userId: true, amount: true, createdAt: true },
    }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, isVerified: true, isPhoneVerified: true } }),
  ])

  const fullyVerified = new Map(users.map(u => [u.id, u.isVerified && u.isPhoneVerified]))

  // Every provider service floors the recharge amount it actually sends
  // (Math.floor(amount)) EXCEPT the FastApi family (Vblink/Ultrapanda), which
  // sends amount.toFixed(2) — see each service's rechargePlayer(). The
  // combined base+bonus total is what gets floored/fixed, as one number, so
  // that same rounding has to be applied here per-transaction before the
  // bonus is split back out, or the numbers won't foot to what's actually in
  // the game.
  const providerNameById = new Map(providerUsers.map(pu => [pu.providerId, pu.provider.name]))
  function providerFloorsAmounts(providerId: string): boolean {
    const name = (providerNameById.get(providerId) || '').toLowerCase()
    const isFastApiFamily = name.includes('vblink') || name.includes('ultrapanda')
    return !isFastApiFamily
  }

  // Global (cross-provider) chronological order per user, matching how
  // transferFunds checks "is this the user's first-ever recharge" — computed
  // over ALL of the user's recharges before narrowing to in-scope providers,
  // so filtering the report to one game doesn't miscount which recharge was
  // actually their first.
  const seenFirstRecharge = new Set<string>()
  const recharges = allUserRecharges
    .map(tx => {
      const isFirst = !seenFirstRecharge.has(tx.userId)
      seenFirstRecharge.add(tx.userId)
      const bonusRate = isFirst && fullyVerified.get(tx.userId) ? 1 : 0.3
      const rawTotal = tx.amount + tx.amount * bonusRate
      const totalCredited = providerFloorsAmounts(tx.providerId) ? Math.floor(rawTotal) : Math.round(rawTotal * 100) / 100
      // Derive bonus from the already-rounded total so Base + Bonus always
      // equals Total exactly — no leftover fractional cent from rounding.
      const bonus = totalCredited - tx.amount
      return { ...tx, bonus, totalCredited }
    })
    .filter(tx => providerIds.includes(tx.providerId))

  const keyOf = (userId: string, providerId: string) => `${userId}:${providerId}`

  const perWindow = REPORT_WINDOWS.map(w => {
    const since = w.since()
    const inWindow = (d: Date) => !since || d >= since

    const txMap = new Map<string, { recharge: number; bonus: number; withdraw: number }>()
    for (const tx of recharges) {
      if (!inWindow(tx.createdAt)) continue
      const key = keyOf(tx.userId, tx.providerId)
      const entry = txMap.get(key) || { recharge: 0, bonus: 0, withdraw: 0 }
      entry.recharge += tx.amount
      entry.bonus += tx.bonus
      txMap.set(key, entry)
    }
    for (const tx of scopedWithdraws) {
      if (!inWindow(tx.createdAt)) continue
      const key = keyOf(tx.userId, tx.providerId)
      const entry = txMap.get(key) || { recharge: 0, bonus: 0, withdraw: 0 }
      entry.withdraw += tx.amount
      txMap.set(key, entry)
    }

    const cashoutMap = new Map<string, number>()
    for (const w2 of cashoutWithdrawals) {
      if (!inWindow(w2.createdAt)) continue
      cashoutMap.set(w2.userId, (cashoutMap.get(w2.userId) || 0) + w2.amount)
    }

    return { key: w.key, txMap, cashoutMap }
  })

  let rows = providerUsers.map(pu => {
    const key = keyOf(pu.userId, pu.providerId)
    const row: any = {
      userId: pu.userId,
      username: pu.user.username,
      email: pu.user.email,
      providerId: pu.providerId,
      providerName: pu.provider.name,
      accountName: pu.accountName,
      providerUserId: pu.providerUserId,
      windows: {} as Record<WindowKey, { pointsAdded: number; bonus: number; totalAdded: number; pointsWithdrawn: number; net: number; cashout: number }>,
    }
    for (const w of perWindow) {
      const tx = w.txMap.get(key) || { recharge: 0, bonus: 0, withdraw: 0 }
      const totalAdded = tx.recharge + tx.bonus
      row.windows[w.key] = {
        pointsAdded: tx.recharge,
        bonus: tx.bonus,
        totalAdded,
        pointsWithdrawn: tx.withdraw,
        net: totalAdded - tx.withdraw,
        cashout: w.cashoutMap.get(pu.userId) || 0,
      }
    }
    return row
  })

  // Most game accounts are created but never actually recharged/withdrawn —
  // showing all of them makes the report mostly noise. When a filter window
  // is given, narrow to accounts with real activity in that specific period
  // (the same period the admin selected to report on).
  if (activeFilterWindow) {
    rows = rows.filter((r: any) => r.windows[activeFilterWindow].pointsAdded > 0 || r.windows[activeFilterWindow].pointsWithdrawn > 0)
  }

  return rows
}

function parseRange(value: unknown): WindowKey {
  return value === '8h' || value === '24h' || value === 'all' ? value : '8h'
}

// Fetches live in-game balance for every row, with bounded concurrency and a
// per-row timeout so one slow/unreachable provider can't hang the batch.
// Failures resolve to `null` (never thrown) — shown as "N/A" downstream.
async function attachLiveBalances<T extends { providerId: string; providerUserId: string }>(rows: T[]): Promise<(T & { liveBalance: number | null })[]> {
  const CONCURRENCY = 10
  const PER_ROW_TIMEOUT_MS = 6000
  const serviceCache = new Map<string, any>()

  const getService = async (providerId: string) => {
    if (!serviceCache.has(providerId)) {
      serviceCache.set(providerId, await ProviderFactory.getProviderById(providerId))
    }
    return serviceCache.get(providerId)
  }

  const out = rows.map(r => ({ ...r, liveBalance: null as number | null }))

  let cursor = 0
  async function worker() {
    while (cursor < out.length) {
      const i = cursor++
      const row = out[i]
      try {
        const service = await getService(row.providerId)
        if (!service) continue
        row.liveBalance = await Promise.race([
          service.getPlayerBalance(row.providerUserId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), PER_ROW_TIMEOUT_MS)),
        ])
      } catch {
        // leave as null — provider unreachable/erroring, not fatal to the report
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, out.length) }, worker))

  return out
}

// GET /api/admin/game-balance-report?range=8h|24h|all&providerId=&search=&includeLiveBalance=true&onlyActive=true
export const getGameBalanceReport = asyncHandler(async (req: Request, res: Response) => {
  const range = parseRange(req.query.range)
  const onlyActive = req.query.onlyActive !== 'false' // defaults to true
  let data: any[] = await buildGameBalanceReport(req.query.providerId as string | undefined, req.query.search as string | undefined, onlyActive ? range : null)
  if (req.query.includeLiveBalance === 'true') data = await attachLiveBalances(data)
  res.json({ success: true, data, range })
})

// GET /api/admin/game-balance-report/live-balance?userId=&providerId=
// On-demand single lookup, used by the on-screen table's per-row "Check"
// button so opening the report never has to wait on N external API calls.
export const getLiveGameBalance = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.userId as string
  const providerId = req.query.providerId as string
  if (!userId || !providerId) throw new AppError('userId and providerId are required', 400)

  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId } })
  if (!providerUser) throw new AppError('Provider account not found', 404)

  const providerService = await ProviderFactory.getProviderById(providerId)
  if (!providerService) throw new AppError('Provider not found or inactive', 404)

  try {
    const balance = await providerService.getPlayerBalance(providerUser.providerUserId)
    res.json({ success: true, data: { balance } })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to fetch live balance' })
  }
})

// GET /api/admin/game-balance-report/export?range=8h|24h|all&providerId=&search=&onlyActive=true
// Always includes live balances — export is a one-off action where a short
// wait (bounded by attachLiveBalances' concurrency + per-row timeout) is
// expected, unlike loading the on-screen table.
export const exportGameBalanceReport = asyncHandler(async (req: Request, res: Response) => {
  const range = parseRange(req.query.range)
  const onlyActive = req.query.onlyActive !== 'false' // defaults to true
  const built = await buildGameBalanceReport(req.query.providerId as string | undefined, req.query.search as string | undefined, onlyActive ? range : null)
  const rows = await attachLiveBalances(built)

  const rangeLabel = range === '8h' ? 'Last 8 Hours' : range === '24h' ? 'Last 24 Hours' : 'All Time'
  const wsRows = rows.map(r => ({
    Username: r.username,
    Email: r.email,
    Game: r.providerName,
    'In-Game Account': r.accountName,
    'Live Game Balance': r.liveBalance === null ? 'N/A' : r.liveBalance,
    [`Base Points Added (${rangeLabel})`]: r.windows[range].pointsAdded,
    [`Bonus Added — Estimated (${rangeLabel})`]: r.windows[range].bonus,
    [`Total Added incl. Bonus (${rangeLabel})`]: r.windows[range].totalAdded,
    [`Points Withdrawn (${rangeLabel})`]: r.windows[range].pointsWithdrawn,
    [`Net In-Game (${rangeLabel})`]: r.windows[range].net,
    [`Platform Cashout (${rangeLabel})`]: r.windows[range].cashout,
    'Total Added incl. Bonus (All-Time Reference)': r.windows.all.totalAdded,
  }))

  const providerBalances = await fetchProviderAgentBalances()
  const balanceRows = providerBalances.map(p => ({
    Game: p.providerName,
    'Remaining Agent Balance': p.balance === null ? 'N/A' : p.balance,
    'Used Today': p.usedToday,
    Status: p.error || 'OK',
  }))

  const wb = XLSX.utils.book_new()
  // Balances sheet added first so it's the tab Excel opens on by default —
  // otherwise it's easy to miss as a second tab behind the per-user table.
  const balanceWs = XLSX.utils.json_to_sheet(balanceRows)
  XLSX.utils.book_append_sheet(wb, balanceWs, 'Remaining Balance Per Game')
  const ws = XLSX.utils.json_to_sheet(wsRows)
  XLSX.utils.book_append_sheet(wb, ws, 'Game Balance Report')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', `attachment; filename="game-balance-report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER AGENT BALANCES — how much credit is left in each game provider's
// own agent account (the pool the admin recharges players from), not any
// single player's balance. Same figure "Test Connection" already reveals
// one provider at a time; this surfaces all of them together, alongside how
// much of that pool has been handed out to players so far today.
// ═══════════════════════════════════════════════════════════════════════════

async function fetchProviderAgentBalances() {
  const providers = await prisma.provider.findMany({ where: { status: true }, select: { id: true, name: true } })
  const PER_PROVIDER_TIMEOUT_MS = 8000

  // "Today" = since midnight UTC (server time), not a rolling 24h window —
  // this is a cheap DB aggregate, independent of the live balance calls below,
  // so it's always available even for a provider whose API is unreachable.
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const [usedTodayRows, balances] = await Promise.all([
    prisma.providerTransaction.groupBy({
      by: ['providerId'],
      where: {
        type: 'recharge',
        status: 'success',
        providerId: { in: providers.map(p => p.id) },
        createdAt: { gte: startOfToday },
      },
      _sum: { amount: true },
    }),
    Promise.all(providers.map(async p => {
      try {
        const service = await ProviderFactory.getProviderById(p.id)
        if (!service) return { providerId: p.id, providerName: p.name, balance: null, error: 'Provider not configured' }
        const balance = await Promise.race([
          service.getAgentBalance(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), PER_PROVIDER_TIMEOUT_MS)),
        ])
        return { providerId: p.id, providerName: p.name, balance, error: null as string | null }
      } catch (error: any) {
        return { providerId: p.id, providerName: p.name, balance: null, error: error.message || 'Connection failed' }
      }
    })),
  ])

  const usedTodayMap = new Map<string, number>()
  for (const row of usedTodayRows) usedTodayMap.set(row.providerId, row._sum.amount || 0)

  return balances.map(b => ({ ...b, usedToday: usedTodayMap.get(b.providerId) || 0 }))
}

// GET /api/admin/game-balance-report/provider-balances
export const getProviderAgentBalances = asyncHandler(async (req: Request, res: Response) => {
  const data = await fetchProviderAgentBalances()
  res.json({ success: true, data })
})

// GET /api/admin/provider-transactions/unresolved — transactions stuck in 'pending' or 'unknown', for manual
// reconciliation (FIN-7). 'pending' rows older than a few minutes indicate the request never got as far as a
// provider response at all (a crashed process, most likely); 'unknown' rows are the genuinely ambiguous ones
// transferFunds could not resolve on its own.
export const getUnresolvedProviderTransactions = asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.providerTransaction.findMany({
    where: { status: { in: ['pending', 'unknown'] } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { username: true, email: true } }, provider: { select: { name: true } } },
    take: 200,
  })
  res.json({ success: true, data: rows })
})

// PATCH /api/admin/provider-transactions/:id/resolve — body: { resolution: 'success' | 'failed', notes?: string }
// Manually finalizes a transaction an admin has confirmed the true outcome of (by checking the provider's own
// dashboard/live balance for that player). This does NOT re-run the provider call and does NOT grant any
// welcome/deposit/referral bonus automatically — those decisions require the same human judgment call about
// what actually happened, so an admin marking 'success' here should grant any owed bonus separately via the
// existing add-balance tooling if appropriate. This endpoint's job is narrowly to stop the transaction from
// being silently stuck forever and to make its final state count (or not count) correctly in wallet balance math.
export const resolveProviderTransaction = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { resolution, notes } = req.body as { resolution?: string; notes?: string }
  if (resolution !== 'success' && resolution !== 'failed') {
    throw new AppError("resolution must be 'success' or 'failed'", 400)
  }

  const tx = await prisma.providerTransaction.findUnique({ where: { id } })
  if (!tx) throw new AppError('Transaction not found', 404)
  if (tx.status !== 'pending' && tx.status !== 'unknown') {
    throw new AppError(`Only pending/unknown transactions can be manually resolved (this one is ${tx.status})`, 400)
  }

  const claim = await prisma.providerTransaction.updateMany({
    where: { id, status: tx.status },
    data: { status: resolution, errorMessage: notes ? `[admin-resolved] ${notes}`.slice(0, 300) : tx.errorMessage },
  })
  if (claim.count !== 1) throw new AppError('This transaction was just changed by someone else — refresh and check its status', 409)

  securityLog('admin_action', req as any, { action: 'provider_transaction_resolve', transactionId: id, resolution, orderId: tx.orderId })
  res.json({ success: true, message: `Transaction marked ${resolution}` })
})
