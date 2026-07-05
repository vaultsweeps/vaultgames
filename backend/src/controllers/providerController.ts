import { Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { WalletService, invalidateWalletCache } from '../services/WalletService'
import { SyncService } from '../services/syncService'
import { createNotification } from '../services/notificationService'
import { logger } from '../utils/logger'

// POST /api/provider/create-account?gameId=xxx
export const createProviderAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  // Resolve the provider for this game
  const providerService = gameId
    ? await ProviderFactory.getProviderForGame(gameId)
    : await ProviderFactory.getActiveProvider()

  if (!providerService) throw new AppError('No active game provider configured. Please contact support.', 503)

  const providerId = providerService.getProviderId()

  // Check if user already has an account with THIS provider
  const existing = await prisma.providerUser.findFirst({ where: { userId, providerId } })
  if (existing) {
    return res.json({ success: true, message: 'Provider account already exists', data: { accountName: existing.accountName } })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  if (!user) throw new AppError('User not found', 404)

  try {
    const providerData = await providerService.createPlayer(user.username)
    await prisma.providerUser.create({
      data: { userId, providerId, providerUserId: providerData.userId, accountName: providerData.accountName }
    })
    res.json({ success: true, message: 'Game account created successfully!', data: { accountName: providerData.accountName } })
  } catch (err: any) {
    if (err?.message?.includes('Username Already Exists') || err?.message?.includes('Username already exists')) {
      let newProviderData = null;
      let attempts = 0;
      let currentUsername = user.username;
      
      while (!newProviderData && attempts < 5) {
        attempts++;
        const suffix = Math.floor(Math.random() * 9000) + 1000;
        // Keep it under standard length limits
        currentUsername = `${user.username.substring(0, 10)}_${suffix}`; 
        
        try {
          newProviderData = await providerService.createPlayer(currentUsername);
        } catch (retryErr: any) {
          if (!retryErr?.message?.includes('Username Already Exists') && !retryErr?.message?.includes('Username already exists')) {
            throw retryErr; 
          }
        }
      }
      
      if (newProviderData) {
        await prisma.providerUser.create({
          data: { userId, providerId, providerUserId: newProviderData.userId, accountName: newProviderData.accountName }
        });
        return res.json({ 
          success: true, 
          message: `Game account created with username: ${newProviderData.accountName} (your original username was taken in the game)`, 
          data: { accountName: newProviderData.accountName } 
        });
      } else {
        throw new AppError('Could not generate a unique game username. Please contact support.', 500);
      }
    }
    throw err
  }
})

// GET /api/provider/account?gameId=xxx
export const getProviderAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  // If a gameId is given, resolve the provider ONLY for that specific game.
  // If the game has no provider assigned, return maintenance status — do NOT fall back.
  if (gameId) {
    const providerId = await ProviderFactory.getProviderIdForGame(gameId)
    if (!providerId) {
      // Game exists but has no provider — show maintenance
      return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false, isMaintenance: true } })
    }
    const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId }, include: { provider: true } })
    if (!providerUser) {
      return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false } })
    }
    // Get live balance
    const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
    let balance = 0
    if (providerService) {
      try { balance = await providerService.getPlayerBalance(providerUser.providerUserId) } catch { balance = 0 }
    }
    const depositedResult = await prisma.providerTransaction.aggregate({
      _sum: { amount: true },
      where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' }
    })
    const totalDeposited = depositedResult._sum.amount || 0

    return res.json({ success: true, data: { accountName: providerUser.accountName, balance, totalDeposited, hasAccount: true, providerName: providerUser.provider?.name || '' } })
  }

  // No gameId — return any provider account the user has (generic dashboard use)
  const providerUser = await prisma.providerUser.findFirst({ where: { userId }, include: { provider: true } })
  if (!providerUser) {
    return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false } })
  }

  // Get live balance from the correct provider
  const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
  let balance = 0
  if (providerService) {
    try {
      balance = await providerService.getPlayerBalance(providerUser.providerUserId)
    } catch {
      balance = 0
    }
  }

  const depositedResult = await prisma.providerTransaction.aggregate({
    _sum: { amount: true },
    where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' }
  })
  const totalDeposited = depositedResult._sum.amount || 0

  res.json({
    success: true,
    data: {
      accountName: providerUser.accountName,
      balance,
      totalDeposited,
      hasAccount: true,
      providerName: providerUser.provider?.name || ''
    }
  })
})

// POST /api/provider/reset-password?gameId=xxx
export const resetProviderPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  const providerId = gameId
    ? await ProviderFactory.getProviderIdForGame(gameId)
    : null

  const providerUser = providerId
    ? await prisma.providerUser.findFirst({ where: { userId, providerId } })
    : await prisma.providerUser.findFirst({ where: { userId } })

  if (!providerUser) throw new AppError('No provider account found', 404)

  const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
  if (!providerService) throw new AppError('Provider service unavailable', 503)

  const newPassword = 'NxS_' + crypto.randomBytes(4).toString('hex')

  try {
    await providerService.resetPlayerPassword(providerUser.providerUserId, newPassword)
  } catch (err: any) {
    // Re-throw the actual provider error so we can see what went wrong in logs
    const msg = err?.message || 'Unknown error';
    logger.error(`[reset-password] Failed for user=${userId} game=${gameId}: ${msg}`);
    throw new AppError(`Failed to reset provider password: ${msg}`, err?.statusCode || 500)
  }

  res.json({ success: true, data: { newPassword } })
})

// GET /api/provider/transactions?gameId=xxx
export const getProviderTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  const providerId = gameId 
    ? await ProviderFactory.getProviderIdForGame(gameId)
    : null

  const whereClause = providerId 
    ? { userId, providerId }
    : { userId }

  const transactions = await prisma.providerTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  res.json({ success: true, data: transactions })
})

// POST /api/provider/transfer
export const transferFunds = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { gameId, amount, type } = req.body; // type: 'recharge' | 'withdraw'
  const userId = req.user!.id;
  
  if (!gameId || !amount || amount <= 0 || !['recharge', 'withdraw'].includes(type)) {
    throw new AppError('Invalid transfer parameters', 400);
  }

  const providerId = await ProviderFactory.getProviderIdForGame(gameId);
  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId } });
  
  if (!providerUser) {
    throw new AppError('No game account found. Please create an account first.', 404);
  }

  const providerService = await ProviderFactory.getProviderById(providerUser.providerId);
  if (!providerService) throw new AppError('Provider service unavailable', 503);

  // Force player offline before checking balances and transferring
  try {
    await providerService.forcePlayerOffline(providerUser.providerUserId);
  } catch (error) {
    console.warn(`Could not force player ${providerUser.providerUserId} offline:`, error);
  }

  // 1. Check balances
  if (type === 'recharge') {
    const walletBalance = await WalletService.getWalletBalance(userId);
    if (walletBalance < amount) {
      throw new AppError(`Not enough funds! Click on this message to deposit $${(amount - walletBalance).toFixed(2)}`, 400);
    }
  } else {
    // withdraw (cash out from game)
    const depositedResult = await prisma.providerTransaction.aggregate({
      _sum: { amount: true },
      where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' }
    });
    const totalDeposited = depositedResult._sum.amount || 0;

    let minCashout = 50;
    let maxCashout = 50;
    
    if (totalDeposited <= 5) {
      minCashout = 50; maxCashout = 50;
    } else if (totalDeposited >= 6 && totalDeposited <= 9) {
      minCashout = 50; maxCashout = 100;
    } else if (totalDeposited >= 10 && totalDeposited <= 15) {
      minCashout = 50; maxCashout = totalDeposited * 15;
    } else if (totalDeposited >= 16 && totalDeposited <= 50) {
      minCashout = totalDeposited * 3; maxCashout = totalDeposited * 15;
    } else if (totalDeposited > 50) {
      minCashout = totalDeposited * 3; maxCashout = 1000;
    }

    if (amount < minCashout) {
      throw new AppError(`Minimum cashout amount is $${minCashout}.`, 400);
    }
    if (amount > maxCashout) {
      throw new AppError(`Maximum cashout amount is $${maxCashout}.`, 400);
    }

    const gameBalance = await providerService.getPlayerBalance(providerUser.providerUserId);
    if (gameBalance < amount) {
      throw new AppError('Insufficient funds in game account.', 400);
    }
  }

  // 2. Process with provider
  const orderId = `TX_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  let finalProviderAmount = amount;
  let bonusAmount = 0;

  try {
    if (type === 'recharge') {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const firstRechargeCheck = await prisma.providerTransaction.findFirst({
        where: { userId, type: 'recharge', status: 'success' }
      });
      const isFirstRecharge = !firstRechargeCheck;

      if (isFirstRecharge && user?.isVerified) {
        // 100% Signup Bonus
        bonusAmount = amount;
        let bonusDef = await prisma.bonus.findFirst({ where: { type: 'welcome' } });
        if (bonusDef) {
          try {
            await prisma.bonusClaim.create({ data: { userId, bonusId: bonusDef.id, amount: bonusAmount } });
          } catch (e) {
            // Ignore unique constraint error if a previous failed recharge attempt already created this claim
          }
        }
        
        // Referral Bonus logic for the referrer
        if (user?.referredById) {
          const refBonus = Math.min(amount * 0.5, 10);
          let refBonusDef = await prisma.bonus.findFirst({ where: { type: 'referral' } });
          if (refBonusDef) {
            try {
              await prisma.bonusClaim.create({ data: { userId: user.referredById, bonusId: refBonusDef.id, amount: refBonus } });
              await createNotification(user.referredById, {
                title: 'Referral Bonus Received!',
                message: `You just received $${refBonus.toFixed(2)} because your referred friend ${user.username} made their first transfer.`,
                type: 'success',
                link: '/dashboard/bonuses'
              });
            } catch (e) {
              // Ignore unique constraint error
            }
          }
        }
      } else {
        // 30% Regular Bonus
        bonusAmount = amount * 0.3;
        let bonusDef = await prisma.bonus.findFirst({ where: { type: 'deposit' } });
        if (bonusDef) {
          try {
            await prisma.bonusClaim.create({ data: { userId, bonusId: bonusDef.id, amount: bonusAmount } });
          } catch (e) {
            // Ignore unique constraint error for recurring bonuses so transfer succeeds
          }
        }
      }

      finalProviderAmount = amount + bonusAmount;
      await providerService.rechargePlayer(providerUser.providerUserId, finalProviderAmount, orderId);
    } else {
      await providerService.withdrawPlayer(providerUser.providerUserId, amount, orderId);
    }
  } catch (err: any) {
    throw new AppError(`Transfer failed: ${err.message}`, 500);
  }

  // 3. Record Transaction (log the base amount so wallet is deducted properly)
  await prisma.providerTransaction.create({
    data: {
      providerId: providerUser.providerId,
      userId,
      type,
      amount,
      orderId,
      status: 'success'
    }
  });

  // Invalidate the wallet cache since funds were moved
  invalidateWalletCache(userId);

  res.json({ 
    success: true, 
    message: type === 'recharge' && bonusAmount > 0 
      ? `Transfer successful! Added $${bonusAmount.toFixed(2)} bonus to your game balance.` 
      : 'Transfer successful' 
  });
})

// GET /api/provider/accounts
export const getAllProviderAccounts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  
  // get all games
  const games = await prisma.game.findMany({ where: { isActive: true } })
  
  // get all provider users
  const providerUsers = await prisma.providerUser.findMany({ 
    where: { userId },
    include: { provider: true }
  })
  
  // fetch balances for all provider users in parallel
  const balances: Record<string, number> = {}
  await Promise.all(providerUsers.map(async (pu) => {
    try {
      const pService = await ProviderFactory.getProviderById(pu.providerId)
      if (pService) {
        balances[pu.providerId] = await pService.getPlayerBalance(pu.providerUserId)
      } else {
        balances[pu.providerId] = 0
      }
    } catch {
      balances[pu.providerId] = 0
    }
  }))

  const result = []
  for (const game of games) {
    const providerId = await ProviderFactory.getProviderIdForGame(game.id).catch(() => null)
    
    if (providerId) {
      const pu = providerUsers.find(p => p.providerId === providerId)
      result.push({
        id: game.id,
        name: game.name,
        thumbnailUrl: game.thumbnailUrl,
        accountName: pu ? pu.accountName : null,
        balance: pu ? (balances[providerId] || 0) : 0,
        hasAccount: !!pu
      })
    }
  }

  res.json({ success: true, data: result })
})

