import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'

// Admin CRUD for PaymentMethod. Deposit and cashout availability are separate flags (depositEnabled /
// cashoutEnabled) so the admin "Deposit methods" and "Cashout methods" tabs never switch each other's methods off.

const BRANDS = ['chime', 'cashapp', 'paypal', 'venmo', 'zelle', 'other']
const TYPES = ['wallet', 'bank', 'card', 'crypto']

const str = (v: unknown, max: number, label: string): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') throw new AppError(`${label} must be text`, 400)
  const t = v.trim()
  if (t.length > max) throw new AppError(`${label} must be at most ${max} characters`, 400)
  return t || null
}

// Links end up in an <a href> / <img src> on the player side — only plain https URLs are accepted
const httpsUrl = (v: unknown, label: string): string | null | undefined => {
  const s = str(v, 500, label)
  if (!s) return s
  let u: URL
  try { u = new URL(s) } catch { throw new AppError(`${label} must be a valid URL`, 400) }
  if (u.protocol !== 'https:') throw new AppError(`${label} must start with https://`, 400)
  return u.toString()
}

const num = (v: unknown, label: string): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new AppError(`${label} must be a positive number`, 400)
  return n
}

const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

function parseFields(body: any) {
  const brand = str(body.brand, 20, 'Payment app')
  if (brand && !BRANDS.includes(brand)) throw new AppError('Unknown payment app', 400)
  const type = str(body.type, 20, 'Type')
  if (type && !TYPES.includes(type)) throw new AppError('Unknown type', 400)
  const data = {
    name: str(body.name, 60, 'Name') ?? undefined,
    type: (type ?? undefined) as any,
    minAmount: num(body.minAmount, 'Min amount'),
    maxAmount: num(body.maxAmount, 'Max amount'),
    feePercent: num(body.feePercent, 'Fee'),
    instructions: str(body.instructions, 1000, 'Instructions'),
    isActive: bool(body.isActive),
    cashoutEnabled: bool(body.cashoutEnabled),
    depositEnabled: bool(body.depositEnabled),
    brand,
    tag: str(body.tag, 80, 'Tag'),
    displayName: str(body.displayName, 40, 'Name on tile'),
    linkUrl: httpsUrl(body.linkUrl, 'Payment link'),
    qrUrl: httpsUrl(body.qrUrl, 'QR image URL'),
    sortOrder: num(body.sortOrder, 'Sort order') !== undefined ? Math.round(num(body.sortOrder, 'Sort order')!) : undefined,
  }
  if (data.brand && body.tag !== undefined && !data.tag) {
    throw new AppError('Tag is required for this payment app', 400)
  }
  return data
}

const checkRange = (min?: number, max?: number) => {
  if (min !== undefined && max !== undefined && min > max) throw new AppError('Min amount cannot be greater than max amount', 400)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'method'

async function uniqueCode(base: string) {
  let code = base
  for (let i = 2; await prisma.paymentMethod.findUnique({ where: { code } }); i++) code = `${base}${i}`
  return code
}

export const listPaymentMethods = asyncHandler(async (_req: Request, res: Response) => {
  const methods = await prisma.paymentMethod.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  res.json({ success: true, data: methods })
})

export const createPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const d = parseFields(req.body)
  if (!d.name) throw new AppError('Name is required', 400)
  if (d.brand && !d.tag) throw new AppError('Tag is required for this payment app', 400)
  checkRange(d.minAmount, d.maxAmount)
  const purpose = req.body.purpose === 'deposit' || req.body.purpose === 'cashout' ? req.body.purpose : null

  const rawCode = typeof req.body.code === 'string' ? req.body.code.trim().toLowerCase().replace(/\s/g, '') : ''
  let code: string
  if (rawCode) {
    if (!/^[a-z0-9_-]{2,32}$/.test(rawCode)) throw new AppError('Code may only use letters, numbers, - and _', 400)
    if (await prisma.paymentMethod.findUnique({ where: { code: rawCode } })) throw new AppError('That code is already used by another method', 400)
    code = rawCode
  } else {
    code = await uniqueCode(slug(d.brand && d.brand !== 'other' ? `${d.brand}${d.name}` : d.name))
  }

  const method = await prisma.paymentMethod.create({
    data: {
      ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
      name: d.name,
      code,
      type: d.type ?? 'wallet',
      minAmount: d.minAmount ?? 10,
      maxAmount: d.maxAmount ?? 10000,
      feePercent: d.feePercent ?? 0,
      instructions: d.instructions ?? '',
      isActive: d.isActive ?? true,
      // A method added from one tab only shows on that side; the legacy form (no purpose) keeps its old defaults
      cashoutEnabled: purpose === 'deposit' ? false : purpose === 'cashout' ? (d.cashoutEnabled ?? true) : (d.cashoutEnabled ?? false),
      depositEnabled: purpose === 'cashout' ? false : purpose === 'deposit' ? (d.depositEnabled ?? true) : (d.depositEnabled ?? true),
    } as any
  })
  res.json({ success: true, data: method })
})

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) throw new AppError('Payment method not found', 404)
  const d = parseFields(req.body)
  delete (d as any).type // type/code are fixed after creation (code is how existing deposits and flows find the method)
  checkRange(d.minAmount ?? existing.minAmount, d.maxAmount ?? existing.maxAmount)
  const method = await prisma.paymentMethod.update({ where: { id: existing.id }, data: d as any })
  res.json({ success: true, data: method })
})

// Legacy master on/off (kept for compatibility)
export const togglePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) throw new AppError('Not found', 404)
  const method = await prisma.paymentMethod.update({ where: { id: existing.id }, data: { isActive: !existing.isActive } })
  res.json({ success: true, data: method })
})

// Turns a method on/off for ONE side only. "Live" on a side = isActive && <side>Enabled.
export const setPaymentMethodAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { purpose, enabled } = req.body
  if (purpose !== 'deposit' && purpose !== 'cashout') throw new AppError('purpose must be deposit or cashout', 400)
  if (typeof enabled !== 'boolean') throw new AppError('enabled must be true or false', 400)
  const existing = await prisma.paymentMethod.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) throw new AppError('Not found', 404)

  const flag = purpose === 'deposit' ? 'depositEnabled' : 'cashoutEnabled'
  const other = purpose === 'deposit' ? 'cashoutEnabled' : 'depositEnabled'
  const data: Record<string, boolean> = { [flag]: enabled }
  if (enabled && !existing.isActive) {
    // Re-activating the master switch must not silently make the OTHER side live too
    data.isActive = true
    data[other] = false
  }
  const method = await prisma.paymentMethod.update({ where: { id: existing.id }, data })
  res.json({ success: true, data: method })
})

export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) throw new AppError('Not found', 404)
  const [deposits, withdrawals] = await Promise.all([
    prisma.deposit.count({ where: { paymentMethodId: existing.id } }),
    prisma.withdrawal.count({ where: { paymentMethodId: existing.id } }),
  ])
  if (deposits || withdrawals) {
    const parts = [deposits && `${deposits} deposit${deposits === 1 ? '' : 's'}`, withdrawals && `${withdrawals} cashout${withdrawals === 1 ? '' : 's'}`].filter(Boolean).join(' and ')
    throw new AppError(`Can't delete "${existing.name}" — ${parts} in history use it. Switch it off instead; history stays intact.`, 400)
  }
  await prisma.paymentMethod.delete({ where: { id: existing.id } })
  res.json({ success: true })
})
