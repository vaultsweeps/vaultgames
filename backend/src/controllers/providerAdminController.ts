import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { ProviderService } from '../services/provider/ProviderService'
import { createProviderService } from '../services/provider/ProviderFactory'

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

export const createProvider = asyncHandler(async (req: Request, res: Response) => {
  const { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout, retryCount, endpoints } = req.body
  const provider = await prisma.provider.create({
    data: { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout: Number(requestTimeout), retryCount: Number(retryCount), endpoints: endpoints || {} }
  })
  res.status(201).json({ success: true, data: maskProvider(provider) })
})

export const updateProvider = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, apiBaseUrl, agentId, secretKey, logo, requestTimeout, retryCount, status, endpoints } = req.body
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
    res.status(400).json({ success: false, message: error.message || 'Connection failed' })
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
