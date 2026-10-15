import { Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'

// GET /api/admin/reports/summary?period=7m|3m|1m|1w
//
// Read-only financial breakdown for the admin Reports page:
//  - money received (approved deposits) and money paid out (approved/paid cashouts) per payment method for the last
//    24 hours, 7 days, 30 days and all time
//  - totals, a time series and the payment-method share for the selected period
// Admin manual credits (payment method code "manual") and admin "Void" withdrawals are NOT real money in or out, so they
// are left out of those figures and reported on their own.

type Period = '7m' | '3m' | '1m' | '1w'
type Money = { amount: number; count: number }
type Windows = { h24: Money; d7: Money; d30: Money; all: Money }

const DAY = 24 * 60 * 60 * 1000
const round2 = (n: number) => Math.round(n * 100) / 100
const emptyMoney = (): Money => ({ amount: 0, count: 0 })
const emptyWindows = (): Windows => ({ h24: emptyMoney(), d7: emptyMoney(), d30: emptyMoney(), all: emptyMoney() })
const ADMIN_VOID = 'Admin Void'
const MANUAL_CODE = 'manual'
const MAX_ROWS = 50_000

const add = (m: Money, amount: number) => { m.amount += amount; m.count += 1 }
const finish = (m: Money): Money => ({ amount: round2(m.amount), count: m.count })
const finishWindows = (w: Windows): Windows => ({ h24: finish(w.h24), d7: finish(w.d7), d30: finish(w.d30), all: finish(w.all) })

function utcDay(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }

function buildBuckets(period: Period, now: Date) {
  const buckets: { key: string; label: string; start: Date }[] = []
  const monthly = period === '7m' || period === '3m'
  if (monthly) {
    const months = period === '7m' ? 7 : 3
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      buckets.push({ key: `${start.getUTCFullYear()}-${start.getUTCMonth()}`, label: start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), start })
    }
  } else {
    const days = period === '1m' ? 30 : 7
    const today = utcDay(now)
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(today.getTime() - i * DAY)
      buckets.push({ key: start.toISOString().slice(0, 10), label: start.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), start })
    }
  }
  const keyOf = (d: Date) => monthly ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : d.toISOString().slice(0, 10)
  return { buckets, keyOf, start: buckets[0].start }
}

export const getReportsSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const raw = String(req.query.period || '7m')
  const period: Period = (['7m', '3m', '1m', '1w'] as const).includes(raw as Period) ? (raw as Period) : '7m'
  const now = new Date()
  const { buckets, keyOf, start: periodStart } = buildBuckets(period, now)
  const since = new Date(Math.min(periodStart.getTime(), now.getTime() - 30 * DAY))
  const t24 = now.getTime() - DAY
  const t7 = now.getTime() - 7 * DAY
  const t30 = now.getTime() - 30 * DAY

  const [deposits, withdrawals, newUsers, depositAll, withdrawalAll, pendingDeposits, pendingWithdrawals, manualAll, voidAll] = await Promise.all([
    prisma.deposit.findMany({
      where: { status: 'approved', OR: [{ approvedAt: { gte: since } }, { approvedAt: null, createdAt: { gte: since } }] },
      select: { amount: true, approvedAt: true, createdAt: true, paymentMethod: { select: { id: true, name: true, code: true } } },
      take: MAX_ROWS,
    }),
    prisma.withdrawal.findMany({
      where: {
        status: { in: ['approved', 'paid'] },
        NOT: { accountInfo: ADMIN_VOID },
        OR: [{ processedAt: { gte: since } }, { processedAt: null, approvedAt: { gte: since } }, { processedAt: null, approvedAt: null, createdAt: { gte: since } }],
      },
      select: { amount: true, processedAt: true, approvedAt: true, createdAt: true, paymentMethodStr: true, paymentMethod: { select: { id: true, name: true, code: true } } },
      take: MAX_ROWS,
    }),
    prisma.user.findMany({ where: { role: 'user', createdAt: { gte: periodStart } }, select: { createdAt: true }, take: MAX_ROWS }),
    prisma.deposit.groupBy({ by: ['paymentMethodId'], where: { status: 'approved' }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.groupBy({ by: ['paymentMethodId', 'paymentMethodStr'], where: { status: { in: ['approved', 'paid'] }, NOT: { accountInfo: ADMIN_VOID } }, _sum: { amount: true }, _count: true }),
    prisma.deposit.aggregate({ where: { status: { in: ['pending', 'processing'] } }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.aggregate({ where: { status: 'pending' }, _sum: { amount: true }, _count: true }),
    prisma.deposit.aggregate({ where: { status: 'approved', paymentMethod: { code: MANUAL_CODE } }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.aggregate({ where: { accountInfo: ADMIN_VOID }, _sum: { amount: true }, _count: true }),
  ])

  type MethodRow = { name: string; code: string; deposits: Windows; cashouts: Windows }
  const methods = new Map<string, MethodRow>()
  const methodFor = (key: string, name: string, code: string) => {
    let m = methods.get(key)
    if (!m) { m = { name, code, deposits: emptyWindows(), cashouts: emptyWindows() }; methods.set(key, m) }
    return m
  }
  const windows = { deposits: emptyWindows(), cashouts: emptyWindows() }
  const periodTotals = { deposits: emptyMoney(), cashouts: emptyMoney() }
  const series = buckets.map(b => ({ key: b.key, label: b.label, deposits: 0, cashouts: 0, users: 0 }))
  const seriesIndex = new Map(series.map((s, i) => [s.key, i]))
  const share = new Map<string, number>()
  const adminCredits = emptyWindows()
  const adminVoids = emptyWindows()

  const place = (w: Windows, t: number, amount: number) => {
    if (t >= t24) add(w.h24, amount)
    if (t >= t7) add(w.d7, amount)
    if (t >= t30) add(w.d30, amount)
  }

  for (const d of deposits) {
    const when = d.approvedAt ?? d.createdAt
    const t = when.getTime()
    if (d.paymentMethod?.code === MANUAL_CODE) { place(adminCredits, t, d.amount); continue }
    const pm = d.paymentMethod
    const m = methodFor(pm?.id ?? 'unknown', pm?.name ?? 'Other / unknown', pm?.code ?? 'unknown')
    place(m.deposits, t, d.amount)
    place(windows.deposits, t, d.amount)
    if (t >= periodStart.getTime()) {
      add(periodTotals.deposits, d.amount)
      const i = seriesIndex.get(keyOf(when)); if (i !== undefined) series[i].deposits += d.amount
      share.set(m.name, (share.get(m.name) || 0) + d.amount)
    }
  }

  for (const w of withdrawals) {
    const when = w.processedAt ?? w.approvedAt ?? w.createdAt
    const t = when.getTime()
    const pm = w.paymentMethod
    const key = pm?.id ?? `str:${w.paymentMethodStr || 'unknown'}`
    const m = methodFor(key, pm?.name ?? (w.paymentMethodStr || 'Other / unknown'), pm?.code ?? 'unknown')
    place(m.cashouts, t, w.amount)
    place(windows.cashouts, t, w.amount)
    if (t >= periodStart.getTime()) {
      add(periodTotals.cashouts, w.amount)
      const i = seriesIndex.get(keyOf(when)); if (i !== undefined) series[i].cashouts += w.amount
    }
  }

  // all-time figures come straight from the database (no row cap)
  const methodInfo = new Map((await prisma.paymentMethod.findMany({ select: { id: true, name: true, code: true } })).map(p => [p.id, p]))
  for (const g of depositAll) {
    const pm = g.paymentMethodId ? methodInfo.get(g.paymentMethodId) : undefined
    if (pm?.code === MANUAL_CODE) { adminCredits.all = { amount: g._sum.amount || 0, count: g._count }; continue }
    const m = methodFor(pm?.id ?? 'unknown', pm?.name ?? 'Other / unknown', pm?.code ?? 'unknown')
    m.deposits.all = { amount: g._sum.amount || 0, count: g._count }
    windows.deposits.all.amount += g._sum.amount || 0; windows.deposits.all.count += g._count
  }
  for (const g of withdrawalAll) {
    const pm = g.paymentMethodId ? methodInfo.get(g.paymentMethodId) : undefined
    const key = pm?.id ?? `str:${g.paymentMethodStr || 'unknown'}`
    const m = methodFor(key, pm?.name ?? (g.paymentMethodStr || 'Other / unknown'), pm?.code ?? 'unknown')
    m.cashouts.all.amount += g._sum.amount || 0; m.cashouts.all.count += g._count
    windows.cashouts.all.amount += g._sum.amount || 0; windows.cashouts.all.count += g._count
  }
  adminVoids.all = { amount: voidAll._sum.amount || 0, count: voidAll._count }

  for (const u of newUsers) {
    const i = seriesIndex.get(keyOf(u.createdAt)); if (i !== undefined) series[i].users += 1
  }

  const depositShareTotal = [...share.values()].reduce((s, v) => s + v, 0)
  const methodRows = [...methods.values()]
    .map(m => ({ name: m.name, code: m.code, deposits: finishWindows(m.deposits), cashouts: finishWindows(m.cashouts) }))
    .sort((a, b) => b.deposits.all.amount - a.deposits.all.amount || b.cashouts.all.amount - a.cashouts.all.amount)

  const dWin = finishWindows(windows.deposits)
  const cWin = finishWindows(windows.cashouts)
  const net = (k: keyof Windows) => round2(dWin[k].amount - cWin[k].amount)

  res.json({
    success: true,
    data: {
      period,
      generatedAt: now.toISOString(),
      totals: {
        deposits: finish(periodTotals.deposits),
        cashouts: finish(periodTotals.cashouts),
        net: round2(periodTotals.deposits.amount - periodTotals.cashouts.amount),
        newUsers: newUsers.length,
      },
      windows: {
        h24: { deposits: dWin.h24, cashouts: cWin.h24, net: net('h24') },
        d7: { deposits: dWin.d7, cashouts: cWin.d7, net: net('d7') },
        d30: { deposits: dWin.d30, cashouts: cWin.d30, net: net('d30') },
        all: { deposits: dWin.all, cashouts: cWin.all, net: net('all') },
      },
      methods: methodRows,
      share: [...share.entries()].map(([name, amount]) => ({ name, amount: round2(amount), percent: depositShareTotal > 0 ? round2((amount / depositShareTotal) * 100) : 0 })).sort((a, b) => b.amount - a.amount),
      series: series.map(s => ({ label: s.label, deposits: round2(s.deposits), cashouts: round2(s.cashouts), users: s.users })),
      pending: {
        deposits: { amount: round2(pendingDeposits._sum.amount || 0), count: pendingDeposits._count },
        cashouts: { amount: round2(pendingWithdrawals._sum.amount || 0), count: pendingWithdrawals._count },
      },
      // Not counted in any figure above: admin manual credits and admin "Void" balance removals
      adminCredits: finishWindows(adminCredits),
      adminVoids: finishWindows(adminVoids),
    },
  })
})
