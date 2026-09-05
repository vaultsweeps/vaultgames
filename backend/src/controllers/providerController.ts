import { Response } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { ProviderFactory } from '../services/provider/ProviderFactory'
import { WalletService, invalidateWalletCache } from '../services/WalletService'
import { SyncService } from '../services/syncService'
import { createNotification } from '../services/notificationService'
import { TelegramService } from '../services/TelegramService'
import { logger } from '../utils/logger'

// POST /api/provider/create-account?gameId=xxx
export const createProviderAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const startTotal = performance.now();
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  // Resolve the provider and user concurrently to save DB round-trips
  const t0 = performance.now();
  const [providerService, user] = await Promise.all([
    gameId ? ProviderFactory.getProviderForGame(gameId) : ProviderFactory.getActiveProvider(),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  ]);
  const t1 = performance.now();
  logger.info(`[createAccount] Provider & User lookup took ${t1 - t0}ms`);

  if (!providerService) throw new AppError('No active game provider configured. Please contact support.', 503)
  if (!user) throw new AppError('User not found', 404)

  const providerId = providerService.getProviderId()

  const t2 = performance.now();
  // Check if user already has an account with THIS provider
  const existing = await prisma.providerUser.findFirst({ where: { userId, providerId } })
  const t3 = performance.now();
  logger.info(`[createAccount] Existing account lookup took ${t3 - t2}ms`);
  
  if (existing) {
    return res.json({ success: true, message: 'Provider account already exists', data: { accountName: existing.accountName } })
  }

  try {
    const t4 = performance.now();
    const providerData = await providerService.createPlayer(user.username)
    const t5 = performance.now();
    logger.info(`[createAccount] External Provider API creation took ${t5 - t4}ms`);
    
    const t6 = performance.now();
    await prisma.providerUser.create({
      data: { userId, providerId, providerUserId: providerData.userId, accountName: providerData.accountName }
    })
    const t7 = performance.now();
    logger.info(`[createAccount] DB Insert took ${t7 - t6}ms`);
    
    res.json({ success: true, message: 'Game account created successfully!', data: { accountName: providerData.accountName } })
    logger.info(`[createAccount] Total Request Time: ${performance.now() - startTotal}ms`);
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
  const startTotal = performance.now();
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined

  // If a gameId is given, resolve the provider ONLY for that specific game.
  // If the game has no provider assigned, return maintenance status — do NOT fall back.
  if (gameId) {
    const t0 = performance.now();
    const providerId = await ProviderFactory.getProviderIdForGame(gameId)
    if (!providerId) {
      // Game exists but has no provider — show maintenance
      return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false, isMaintenance: true } })
    }
    const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId }, include: { provider: true } })
    const t1 = performance.now();
    logger.info(`[getAccount] DB Lookups (Provider ID + User) took ${t1 - t0}ms`);

    if (!providerUser) {
      return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false } })
    }
    
    // Get live balance and DB lastRecharge in parallel
    const t2 = performance.now();
    const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
    
    let balance = 0
    let totalDeposited = 0
    
    const [balanceResult, lastRechargeResult] = await Promise.allSettled([
      providerService ? providerService.getPlayerBalance(providerUser.providerUserId) : Promise.reject('No provider service'),
      prisma.providerTransaction.findFirst({
        where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    if (balanceResult.status === 'fulfilled') balance = balanceResult.value;
    if (lastRechargeResult.status === 'fulfilled' && lastRechargeResult.value) {
      totalDeposited = lastRechargeResult.value.amount;
    }
    
    const t3 = performance.now();
    logger.info(`[getAccount] Parallel Balance & Recharge fetch took ${t3 - t2}ms`);
    logger.info(`[getAccount] Total Request Time: ${performance.now() - startTotal}ms`);

    return res.json({ success: true, data: { accountName: providerUser.accountName, balance, totalDeposited, hasAccount: true, providerName: providerUser.provider?.name || '' } })
  }

  // No gameId — return any provider account the user has (generic dashboard use)
  const t0_gen = performance.now();
  const providerUser = await prisma.providerUser.findFirst({ where: { userId }, include: { provider: true } })
  if (!providerUser) {
    return res.json({ success: true, data: { accountName: null, balance: 0, hasAccount: false } })
  }

  // Get live balance and DB lastRecharge in parallel
  const providerService = await ProviderFactory.getProviderById(providerUser.providerId)
  let balance = 0
  let totalDeposited = 0

  const [balanceResult, lastRechargeResult] = await Promise.allSettled([
    providerService ? providerService.getPlayerBalance(providerUser.providerUserId) : Promise.reject('No provider service'),
    prisma.providerTransaction.findFirst({
      where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  if (balanceResult.status === 'fulfilled') balance = balanceResult.value;
  if (lastRechargeResult.status === 'fulfilled' && lastRechargeResult.value) {
    totalDeposited = lastRechargeResult.value.amount;
  }
  
  logger.info(`[getAccount (generic)] Total Request Time: ${performance.now() - startTotal}ms`);

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

  // Generate a safe alphanumeric password (no underscores or special chars UltraPanda rejects)
  const newPassword = 'Nx' + crypto.randomBytes(6).toString('hex') // e.g. "Nx1a2b3c4d5e6f"

  try {
    // IMPORTANT: pass providerUser.providerUserId (the provider-side username)
    // NOT userId (which is the internal DB cuid and would produce a different hash)
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

  // Parallelize: get provider config (cached) AND look up user's game account at same time
  const [providerId, walletBalanceForRecharge] = await Promise.all([
    ProviderFactory.getProviderIdForGame(gameId),
    type === 'recharge' ? WalletService.getWalletBalance(userId) : Promise.resolve(null)
  ]);

  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId: providerId ?? '' } });
  
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
    if (walletBalanceForRecharge !== null && walletBalanceForRecharge < amount) {
      throw new AppError(`Not enough funds! Click on this message to deposit $${(amount - walletBalanceForRecharge).toFixed(2)}`, 400);
    }
  } else {
    // withdraw (cash out from game)
    const lastRecharge = await prisma.providerTransaction.findFirst({
      where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' },
      orderBy: { createdAt: 'desc' }
    });
    const totalDeposited = lastRecharge?.amount || 0;

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

    // Validate minimum eligibility only — exceeding max is handled by void logic
    if (amount < minCashout) {
      throw new AppError(`Minimum cashout amount is $${minCashout}.`, 400);
    }

    // Fetch live game balance to determine actual withdrawal from provider
    const liveGameBalance = await providerService.getPlayerBalance(providerUser.providerUserId);
    if (liveGameBalance <= 0) {
      throw new AppError('No game balance to cash out.', 400);
    }

    // Attach to req so we can use it later without re-fetching
    (req as any).__cashout__ = { minCashout, maxCashout, liveGameBalance };
  }

  // 2. Process with provider
  const orderId = `TX${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  let finalProviderAmount = amount;
  let bonusAmount = 0;
  let voidedAmount = 0;       // amount voided due to exceeding cashout cap
  let creditedAmount = amount; // amount that will actually be credited to wallet

  try {
    if (type === 'recharge') {
      // Parallelize user lookup + first-recharge check + all bonus definitions — all independent
      // NOTE: firstRechargeCheck is GLOBAL (across all games) — the 100% signup bonus
      // is a one-time reward for the very first ever recharge on the platform.
      const [user, userProfile, welcomeBonusDef, depositBonusDef, referralBonusDef] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true, isVerified: true, isPhoneVerified: true, referredById: true } }),
        prisma.userProfile.findUnique({ where: { userId }, select: { phone: true } }),
        prisma.bonus.findFirst({ where: { type: 'welcome' } }),
        prisma.bonus.findFirst({ where: { type: 'deposit' } }),
        prisma.bonus.findFirst({ where: { type: 'referral' } })
      ]);

      const welcomeClaim = welcomeBonusDef
        ? await prisma.bonusClaim.findUnique({ where: { userId_bonusId: { userId, bonusId: welcomeBonusDef.id } } })
        : null;
      
      const hasClaimedWelcome = !!welcomeClaim;

      if (!hasClaimedWelcome && user?.isVerified && user?.isPhoneVerified) {
        // 100% Signup Bonus
        bonusAmount = amount;
        if (welcomeBonusDef) {
          try {
            // Upsert: records the claim without failing if user played another game before
            await prisma.bonusClaim.upsert({
              where: { userId_bonusId: { userId, bonusId: welcomeBonusDef.id } },
              create: { userId, bonusId: welcomeBonusDef.id, amount: bonusAmount },
              update: { amount: { increment: bonusAmount } },
            });
          } catch (e) {
            // Silently continue — bonus is already credited to game
          }
        }

        // Notify the user about their bonus
        createNotification(userId, {
          title: '🎉 100% Welcome Bonus Claimed!',
          message: `Congratulations! A $${bonusAmount.toFixed(2)} welcome bonus has been added to your game balance because you verified both your email and phone number.`,
          type: 'success',
          link: '/dashboard/bonuses'
        }).catch(e => logger.error('Failed to send bonus notification: ' + e.message));

        // Notify admins via Telegram
        const phone = userProfile?.phone || 'N/A';
        TelegramService.sendBonusClaimedNotification(
          user!.username,
          user!.email,
          phone,
          bonusAmount,
          amount
        ).catch(e => logger.error('Failed to send Telegram bonus notification: ' + e.message));
        
        // Referral Bonus logic for the referrer — DB write awaited for durability, notification fire-and-forget
        if (user?.referredById && referralBonusDef) {
          const refBonus = Math.min(amount * 0.5, 10);
          try {
            await prisma.bonusClaim.create({ data: { userId: user.referredById, bonusId: referralBonusDef.id, amount: refBonus } });
            // Fire-and-forget: notification delivery doesn't block the response
            createNotification(user.referredById, {
              title: 'Referral Bonus Received!',
              message: `You just received $${refBonus.toFixed(2)} because your referred friend ${user.username} made their first transfer.`,
              type: 'success',
              link: '/dashboard/bonuses'
            }).catch(e => logger.error('Failed to send notification: ' + e.message));
          } catch (e) {
            // Ignore unique constraint error
          }
        }
      } else {
        // 30% Regular Deposit Bonus — applied on every recharge after the first.
        // This bonus always applies regardless of wheel/freeplay/coupon history.
        bonusAmount = Math.floor(amount * 0.3);
        if (depositBonusDef) {
          try {
            // Upsert: accumulate the total bonus amount received across all rechargess
            await prisma.bonusClaim.upsert({
              where: { userId_bonusId: { userId, bonusId: depositBonusDef.id } },
              create: { userId, bonusId: depositBonusDef.id, amount: bonusAmount },
              update: { amount: { increment: bonusAmount } },
            });
          } catch (e) {
            // Silently continue — bonus is already credited to the game
          }
        }
      }

      finalProviderAmount = amount + bonusAmount;
      await providerService.rechargePlayer(providerUser.providerUserId, finalProviderAmount, orderId);
    } else {
      // CASHOUT: withdraw the user-requested amount (or full balance if less), cap at maxCashout
      const { maxCashout, liveGameBalance } = (req as any).__cashout__ as { minCashout: number; maxCashout: number; liveGameBalance: number };

      // How much to actually pull from the game — the FULL balance (sweep everything out)
      const withdrawFromProvider = Math.floor(liveGameBalance);

      // How much to credit the user's wallet — capped at their max allowed cashout
      creditedAmount = Math.min(withdrawFromProvider, maxCashout);
      // Anything above the cap is voided (not credited to wallet)
      voidedAmount = Math.max(0, withdrawFromProvider - creditedAmount);

      // Pull the full balance out of the game provider
      await providerService.withdrawPlayer(providerUser.providerUserId, withdrawFromProvider, orderId);
    }
  } catch (err: any) {
    throw new AppError(`Transfer failed: ${err.message}`, 500);
  }

  // 3. Record Transaction & invalidate wallet cache — both fire-and-forget after response
  // We await the DB write to ensure durability, but cache invalidation is detached
  await prisma.providerTransaction.create({
    data: {
      providerId: providerUser.providerId,
      userId,
      type,
      amount: creditedAmount,
      orderId,
      status: 'success'
    }
  });

  // Fire-and-forget: cache invalidation doesn't need to block the response
  invalidateWalletCache(userId);

  // 4. Build response message
  let message: string;
  if (type === 'recharge' && bonusAmount > 0) {
    message = `Transfer successful! Added $${bonusAmount.toFixed(2)} bonus to your game balance.`;
  } else if (type === 'withdraw') {
    if (voidedAmount > 0) {
      message = `Cashout successful! $${creditedAmount.toFixed(2)} has been credited to your wallet. $${voidedAmount.toFixed(2)} was voided (exceeded your cashout limit).`;
    } else {
      message = `Cashout successful! $${creditedAmount.toFixed(2)} has been credited to your wallet.`;
    }
  } else {
    message = 'Transfer successful';
  }

  res.json({ 
    success: true, 
    message,
    data: type === 'withdraw' ? { credited: creditedAmount, voided: voidedAmount } : undefined
  });
})

// GET /api/provider/accounts
export const getAllProviderAccounts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const startTotal = performance.now()
  const userId = req.user!.id
  
  // Fetch games + providerUsers in parallel
  const [games, providerUsers] = await Promise.all([
    prisma.game.findMany({ where: { isActive: true } }),
    prisma.providerUser.findMany({ where: { userId }, include: { provider: true } })
  ])
  
  // Pre-fetch all provider IDs for all games in parallel (hits cache after first call)
  const gameProviderIds = await Promise.all(
    games.map(g => ProviderFactory.getProviderIdForGame(g.id).catch(() => null))
  )
  
  // Fetch all live balances in parallel
  const balances: Record<string, number> = {}
  await Promise.all(providerUsers.map(async (pu) => {
    try {
      const pService = await ProviderFactory.getProviderById(pu.providerId)
      balances[pu.providerId] = pService ? await pService.getPlayerBalance(pu.providerUserId) : 0
    } catch {
      balances[pu.providerId] = 0
    }
  }))

  // Build result synchronously — no more per-game DB awaits
  const result = games.map((game, idx) => {
    const providerId = gameProviderIds[idx]
    if (!providerId) return null
    const pu = providerUsers.find(p => p.providerId === providerId)
    return {
      id: game.id,
      name: game.name,
      thumbnailUrl: game.thumbnailUrl,
      accountName: pu ? pu.accountName : null,
      balance: pu ? (balances[providerId] || 0) : 0,
      hasAccount: !!pu
    }
  }).filter(Boolean)

  logger.info(`[getAllAccounts] Total Time: ${performance.now() - startTotal}ms`)
  res.json({ success: true, data: result })
})

