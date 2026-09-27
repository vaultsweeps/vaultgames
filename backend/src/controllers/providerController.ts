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
import { ReferralService } from '../services/ReferralService'
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

// GET /api/provider/account-fast?gameId=xxx — DB-only, no external provider call. Returns just enough to
// show the account name (and, on the frontend, its locally-remembered password) immediately. Measured in
// production: the full /account endpoint's live balance fetch from the provider's own API can take 3+
// seconds (external network dependency, largely outside our control to speed up directly), which was
// blocking the credentials card from showing anything at all for that whole time even though the account
// name itself is a same-DB lookup that resolves in a couple hundred ms. The frontend now shows credentials
// from this endpoint immediately, then fills in the live balance from the existing (slower) endpoint
// separately, in the background — same data, same accuracy, just no longer serialized behind each other.
export const getProviderAccountFast = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const gameId = req.query.gameId as string | undefined
  if (!gameId) return res.json({ success: true, data: { accountName: null, hasAccount: false } })

  const providerId = await ProviderFactory.getProviderIdForGame(gameId)
  if (!providerId) return res.json({ success: true, data: { accountName: null, hasAccount: false, isMaintenance: true } })

  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId }, include: { provider: true } })
  if (!providerUser) return res.json({ success: true, data: { accountName: null, hasAccount: false } })

  res.json({ success: true, data: { accountName: providerUser.accountName, hasAccount: true, providerName: providerUser.provider?.name || '' } })
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
/**
 * Marks a pending ProviderTransaction as the outcome of a failed/ambiguous provider call.
 *
 * - A DEFINITIVE rejection (every provider adapter throws AppError(..., 400) when the provider actually
 *   responded and said no — confirmed across ProviderService/CashMachineProviderService/OrionstarProviderService/
 *   FastApiProviderService) is safe to mark 'failed': nothing was moved, no reconciliation needed.
 * - Anything else (AppError(..., 502) for a network-level failure, or any unexpected error) is genuinely
 *   ambiguous — we do not know whether the provider processed the request. One reconciliation attempt is made
 *   using the provider's own getPlayerBalance (the only status-lookup every adapter already exposes — no new
 *   provider API is invented here) before falling back to 'unknown' for manual/later reconciliation.
 */
async function resolveAmbiguousTransfer(opts: {
  err: any
  providerService: import('../services/provider/ProviderAdapter').ProviderAdapter
  providerUser: { providerUserId: string }
  type: 'recharge' | 'withdraw'
  orderId: string
  userId: string
  balanceBefore?: number
}): Promise<{ resolvedAsFailed: boolean }> {
  const { err, providerService, providerUser, type, orderId, userId, balanceBefore } = opts
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const sanitized = String((err instanceof AppError ? err.message : err?.message) || 'Unknown error').slice(0, 300)

  if (statusCode === 400) {
    await prisma.providerTransaction.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'failed', errorMessage: sanitized } })
    return { resolvedAsFailed: true }
  }

  // Ambiguous (502 / network-level / unexpected). Try once to find out what actually happened.
  if (balanceBefore !== undefined) {
    try {
      const balanceAfter = await providerService.getPlayerBalance(providerUser.providerUserId)
      if (type === 'recharge' && balanceAfter <= balanceBefore + 0.01) {
        // Balance never moved — the recharge did not reach the provider (or was rejected before applying).
        await prisma.providerTransaction.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'failed', errorMessage: sanitized } })
        return { resolvedAsFailed: true }
      }
      if (type === 'withdraw' && balanceAfter >= balanceBefore - 0.01) {
        // Balance never dropped — the sweep did not reach the provider.
        await prisma.providerTransaction.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'failed', errorMessage: sanitized } })
        return { resolvedAsFailed: true }
      }
      // Balance DID move: the provider actually processed this. We deliberately do NOT auto-finalize as
      // 'success' here — doing so without also running the bonus-grant/credit logic would under-pay the user
      // (game got the money, but no bonus/notification), which is worse than a held 'unknown' a human reviews.
    } catch {
      // Reconciliation itself failed (provider unreachable) — genuinely unknown, fall through.
    }
  }

  await prisma.providerTransaction.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'unknown', errorMessage: sanitized } })
  logger.error(`[transferFunds] AMBIGUOUS provider outcome for orderId=${orderId} user=${userId}, type=${type} — needs manual reconciliation: ${sanitized}`)
  return { resolvedAsFailed: false }
}

export const transferFunds = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { gameId, amount, type } = req.body; // type: 'recharge' | 'withdraw'
  const userId = req.user!.id;

  if (!gameId || !amount || amount <= 0 || !['recharge', 'withdraw'].includes(type)) {
    throw new AppError('Invalid transfer parameters', 400);
  }

  // Idempotency key for this logical transfer: if the frontend sends the SAME key again (a retry after a
  // timeout, a double-click that got through, a duplicate submit from two tabs), it resolves to the SAME
  // ProviderTransaction row below instead of ever calling the provider a second time. Falls back to a fresh,
  // always-unique key when absent, which is exactly today's old behaviour (no regression for that case).
  // Namespaced by userId so one user can never collide with (or be blocked/read by) another user's key.
  const idemHeader = (req.header('Idempotency-Key') || '').trim()
  const orderId = /^[A-Za-z0-9_-]{8,80}$/.test(idemHeader)
    ? `TX-${userId}-${idemHeader}`
    : `TX${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  // Parallelize: get provider config (cached) AND look up user's game account at same time
  const [providerId, walletBalanceForRecharge, unresolvedRecharges] = await Promise.all([
    ProviderFactory.getProviderIdForGame(gameId),
    // Fresh, uncached read: the 10s cached balance could let parallel/rapid requests pass the same check
    type === 'recharge' ? WalletService.getBalancesRaw(userId).then(b => b.displayBalance) : Promise.resolve(null),
    // Any recharge still pending/unresolved counts as already-spent for THIS eligibility check — otherwise a
    // second recharge attempt while a prior one's outcome is still unknown could spend the same wallet money
    // twice if that prior one turns out to have actually succeeded at the provider.
    type === 'recharge'
      ? prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: { in: ['pending', 'unknown'] } }, _sum: { amount: true } }).then(r => r._sum.amount || 0)
      : Promise.resolve(0)
  ]);

  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId: providerId ?? '' } });

  if (!providerUser) {
    throw new AppError('No game account found. Please create an account first.', 404);
  }

  const providerService = await ProviderFactory.getProviderById(providerUser.providerId);
  if (!providerService) throw new AppError('Provider service unavailable', 503);

  // Idempotent replay: an existing row for this exact orderId means this exact logical transfer was already
  // attempted. Resolve to that row's recorded outcome — never call the provider again for it.
  const existingTx = await prisma.providerTransaction.findUnique({ where: { orderId } });
  if (existingTx) {
    // A reused Idempotency-Key with a DIFFERENT transfer type is not a legitimate replay of the same logical
    // transfer — it's a client bug (or a key collision). Refuse rather than resolve to an unrelated stored
    // outcome. (amount is intentionally not compared here: for a withdrawal, the stored amount is overwritten
    // to the actual credited total on success, which can legitimately differ from the originally requested
    // amount once the cashout cap/void logic applies — that is not a mismatch.)
    if (existingTx.type !== type) {
      throw new AppError('This Idempotency-Key was already used for a different transfer request. Please retry with a new one.', 409);
    }
    if (existingTx.status === 'success') {
      return res.json({ success: true, message: 'Transfer already completed.', data: { alreadyProcessed: true, credited: existingTx.amount } });
    }
    if (existingTx.status === 'failed') {
      throw new AppError(`Transfer failed: ${existingTx.errorMessage || 'Please try again.'}`, 400);
    }
    if (existingTx.status === 'unknown') {
      return res.status(202).json({ success: false, message: 'Your previous transfer could not be confirmed and is being verified. Please wait a few minutes before trying again.', data: { reconciling: true } });
    }
    return res.status(409).json({ success: false, message: 'This transfer is already being processed.' });
  }

  // Force player offline before checking balances and transferring
  try {
    await providerService.forcePlayerOffline(providerUser.providerUserId);
  } catch (error) {
    console.warn(`Could not force player ${providerUser.providerUserId} offline:`, error);
  }

  // 1. Check balances
  let minCashout = 50, maxCashout = 50, liveGameBalance = 0;
  if (type === 'recharge') {
    const availableForRecharge = (walletBalanceForRecharge ?? 0) - unresolvedRecharges;
    if (availableForRecharge < amount) {
      throw new AppError(`Not enough funds! Click on this message to deposit $${(amount - availableForRecharge).toFixed(2)}`, 400);
    }
  } else {
    // withdraw (cash out from game)
    const lastRecharge = await prisma.providerTransaction.findFirst({
      where: { userId, providerId: providerUser.providerId, type: 'recharge', status: 'success' },
      orderBy: { createdAt: 'desc' }
    });
    const totalDeposited = lastRecharge?.amount || 0;

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
    liveGameBalance = await providerService.getPlayerBalance(providerUser.providerUserId);
    if (liveGameBalance <= 0) {
      throw new AppError('No game balance to cash out.', 400);
    }

    // The cashout sweeps the WHOLE live game balance, so the minimum must hold for that real number. Checking only the
    // client-supplied `amount` let anyone pass a huge amount and cash out (recycled bonus money) below the minimum.
    if (Math.floor(liveGameBalance) < Math.floor(minCashout)) {
      throw new AppError(`Minimum cashout amount is $${minCashout}.`, 400);
    }
  }

  // 2. Compute (but do not yet GRANT) whichever bonus this recharge would qualify for. The actual DB writes
  // (BonusClaim upsert, referral reward) only happen after the provider call is confirmed successful, below —
  // a failed or ambiguous transfer must never create a permanent reward for money that was never moved.
  let finalProviderAmount = amount;
  let bonusAmount = 0;
  let bonusKind: 'welcome' | 'deposit' | null = null;
  let user: { id: string; username: string; email: string; isVerified: boolean; isPhoneVerified: boolean; referredById: string | null } | null = null;
  let userProfile: { phone: string | null } | null = null;
  let welcomeBonusDef: { id: string } | null = null, depositBonusDef: { id: string } | null = null, referralBonusDef: { id: string } | null = null;

  if (type === 'recharge') {
    // NOTE: firstRechargeCheck is GLOBAL (across all games) — the 100% signup bonus
    // is a one-time reward for the very first ever recharge on the platform.
    [user, userProfile, welcomeBonusDef, depositBonusDef, referralBonusDef] = await Promise.all([
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
      bonusAmount = amount; // 100% signup bonus
      bonusKind = 'welcome';
    } else {
      bonusAmount = Math.floor(amount * 0.3); // 30% regular deposit bonus, every recharge after the first
      bonusKind = 'deposit';
    }
    finalProviderAmount = amount + bonusAmount;
  }

  // Snapshot the live game balance right before the provider call — stored on the durable row so an
  // ambiguous outcome can be reconciled later (by this request if it fails, or by an admin afterwards) by
  // comparing against the CURRENT live balance, using only the adapter's existing getPlayerBalance capability.
  let balanceBeforeForReconciliation: number | undefined;
  if (type === 'recharge') {
    try { balanceBeforeForReconciliation = await providerService.getPlayerBalance(providerUser.providerUserId) } catch { /* best-effort */ }
  } else {
    balanceBeforeForReconciliation = liveGameBalance;
  }

  // 3. Create the durable PENDING record BEFORE calling the provider. orderId is unique, so this IS the
  // idempotency boundary: a concurrent or replayed request for the same orderId (see the replay check above)
  // can never create a second row, and this exact orderId is what gets passed to the provider as its own
  // transaction reference.
  await prisma.providerTransaction.create({
    data: { providerId: providerUser.providerId, userId, type, amount, orderId, status: 'pending', balanceBefore: balanceBeforeForReconciliation }
  });

  // 4. Call the provider EXACTLY ONCE for this orderId.
  let creditedAmount = amount;
  let voidedAmount = 0;
  try {
    if (type === 'recharge') {
      await providerService.rechargePlayer(providerUser.providerUserId, finalProviderAmount, orderId);
    } else {
      // How much to actually pull from the game — the FULL balance (sweep everything out)
      const withdrawFromProvider = Math.floor(liveGameBalance);
      // How much to credit the user's wallet — capped at their max allowed cashout
      creditedAmount = Math.min(withdrawFromProvider, maxCashout);
      // Anything above the cap is voided (not credited to wallet)
      voidedAmount = Math.max(0, withdrawFromProvider - creditedAmount);
      await providerService.withdrawPlayer(providerUser.providerUserId, withdrawFromProvider, orderId);
    }
  } catch (err: any) {
    const { resolvedAsFailed } = await resolveAmbiguousTransfer({ err, providerService, providerUser, type, orderId, userId, balanceBefore: balanceBeforeForReconciliation });
    if (resolvedAsFailed) {
      throw new AppError(`Transfer failed: ${String(err?.message || 'Unknown error').slice(0, 300)}`, err instanceof AppError ? err.statusCode : 502);
    }
    return res.status(202).json({ success: false, message: 'Your transfer could not be confirmed and is being verified. Please check back in a few minutes before trying again.', data: { reconciling: true } });
  }

  // 5. SUCCESS — finalize the durable record atomically, THEN (only now) grant whichever bonus was computed.
  await prisma.providerTransaction.update({ where: { orderId }, data: { status: 'success', amount: creditedAmount } });
  invalidateWalletCache(userId);

  if (type === 'recharge' && bonusAmount > 0 && user) {
    if (bonusKind === 'welcome' && welcomeBonusDef) {
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

      createNotification(userId, {
        title: '🎉 100% Welcome Bonus Claimed!',
        message: `Congratulations! A $${bonusAmount.toFixed(2)} welcome bonus has been added to your game balance because you verified both your email and phone number.`,
        type: 'success',
        link: '/dashboard/bonuses'
      }).catch(e => logger.error('Failed to send bonus notification: ' + e.message));

      const phone = userProfile?.phone || 'N/A';
      TelegramService.sendBonusClaimedNotification(user.username, user.email, phone, bonusAmount, amount)
        .catch(e => logger.error('Failed to send Telegram bonus notification: ' + e.message));

      // Referral bonus for the referrer, triggered by the referee's first-ever game recharge. Goes through
      // the same idempotent gate as the deposit-triggered path (ReferralService.grantReferralReward): a
      // referee can trigger a reward from EITHER their first approved deposit or their first recharge,
      // whichever happens first, but never both — the shared unique-per-referee ledger row means the
      // second trigger (from either path) is always a safe no-op rather than a double payment.
      if (user.referredById && referralBonusDef) {
        const refBonus = Math.min(amount * 0.5, 10);
        const { granted } = await ReferralService.grantReferralReward({
          referrerId: user.referredById,
          refereeId: userId,
          amount: refBonus,
          triggerSource: 'first_recharge',
        });
        if (granted) {
          createNotification(user.referredById, {
            title: 'Referral Bonus Received!',
            message: `You just received $${refBonus.toFixed(2)} because your referred friend ${user.username} made their first transfer.`,
            type: 'success',
            link: '/dashboard/bonuses'
          }).catch(e => logger.error('Failed to send notification: ' + e.message));
        }
      }
    } else if (bonusKind === 'deposit' && depositBonusDef) {
      try {
        // Upsert: accumulate the total bonus amount received across all recharges
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

  // 6. Build response message (unchanged contract)
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

