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
import { ReferralService, computeReferralBonusAmount } from '../services/ReferralService'
import { logger } from '../utils/logger'
import { Prisma } from '@prisma/client'
import { BonusService, invalidateBonusCache } from '../services/BonusService'
import { BonusLedgerService, BonusDebitBreakdownEntry } from '../services/BonusLedgerService'
import { BonusCashoutRuleService } from '../services/BonusCashoutRuleService'
import { recordWalletTransaction } from '../services/WalletTransactionService'
import { isDuplicateAccountError } from '../utils/providerErrors'

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
    if (isDuplicateAccountError(err)) {
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
          if (!isDuplicateAccountError(retryErr)) {
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

    return res.json({ success: true, data: { accountName: providerUser.accountName, balance, totalDeposited, hasAccount: true, providerName: providerUser.provider?.name || '', activeFundingSource: providerUser.activeFundingSource } })
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
      providerName: providerUser.provider?.name || '',
      activeFundingSource: providerUser.activeFundingSource
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
  const { gameId, amount, type, useBonus } = req.body; // type: 'recharge' | 'withdraw'
  const userId = req.user!.id;

  if (!gameId || !amount || amount <= 0 || !['recharge', 'withdraw'].includes(type)) {
    throw new AppError('Invalid transfer parameters', 400);
  }

  // Only a strict boolean `true` is ever treated as a bonus-funding request — never a truthy string/number
  // from a malformed client. The server re-validates eligibility independently below regardless of this flag.
  const requestedUseBonus = useBonus === true;

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
  const [providerId, walletBalanceForRecharge, bonusBalanceForRecharge, unresolvedWalletRecharges, unresolvedBonusRecharges] = await Promise.all([
    ProviderFactory.getProviderIdForGame(gameId),
    // Fresh, uncached read: the 10s cached balance could let parallel/rapid requests pass the same check
    type === 'recharge' ? WalletService.getBalancesRaw(userId).then(b => b.displayBalance) : Promise.resolve(null),
    type === 'recharge' ? BonusService.getBonusBalanceRaw(userId) : Promise.resolve(null),
    // Any recharge still pending/unresolved counts as already-spent for THIS eligibility check — otherwise a
    // second recharge attempt while a prior one's outcome is still unknown could spend the same wallet money
    // twice if that prior one turns out to have actually succeeded at the provider. Split by funding source
    // (NULL-safe: a bare `fundingSource: { not: 'BONUS' }` is not something to trust on a nullable column —
    // see WalletService) so a pending bonus-funded recharge never blocks wallet eligibility and vice versa.
    type === 'recharge'
      ? prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: { in: ['pending', 'unknown'] }, OR: [{ fundingSource: null }, { fundingSource: { not: 'BONUS' } }] }, _sum: { amount: true } }).then(r => r._sum.amount || 0)
      : Promise.resolve(0),
    type === 'recharge'
      ? prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: { in: ['pending', 'unknown'] }, fundingSource: 'BONUS' }, _sum: { amount: true } }).then(r => r._sum.amount || 0)
      : Promise.resolve(0),
  ]);

  if (!providerId) {
    // Either the game has no provider assigned, or its provider is currently disabled in Admin — a clearer
    // message than "create an account first", which is misleading when the real cause is maintenance.
    throw new AppError('This game is temporarily unavailable. Please contact support or try again later.', 503);
  }

  const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId } });

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

  // Live game balance, fetched once up front for a recharge — reused below both (a) as the reconciliation
  // snapshot (replacing a second, now-redundant fetch later), and (b) to detect a session that's actually
  // empty right now even if a stale ProviderUser.activeFundingSource is still set from a prior session that
  // never explicitly cashed out (e.g. the player lost everything via gameplay rather than withdrawing) —
  // without this check, that stale value would permanently trap the user on one funding source.
  let liveBalanceNow: number | undefined;
  if (type === 'recharge') {
    try { liveBalanceNow = await providerService.getPlayerBalance(providerUser.providerUserId) } catch { /* best-effort */ }
  }
  // Fail SAFE, not open: if the balance fetch itself failed (`undefined`), we do NOT know the game is empty,
  // so treat it as NOT empty — preserving whatever mixing-guard/breakdown state already existed. Treating a
  // failed fetch as "empty" would let a transient provider hiccup silently bypass the mixing guard and wipe
  // activeSessionBonusBreakdown even though the game might still hold real money from a different source.
  const gameIsEmpty = liveBalanceNow !== undefined && liveBalanceNow < 0.01;

  // 1. Check balances
  let minCashout = 50, maxCashout = 50, liveGameBalance = 0;
  let fundingSource: 'WALLET' | 'BONUS' | null = null;
  let bonusDebitBreakdown: BonusDebitBreakdownEntry[] = [];
  let capturedFundingSourceForWithdraw: string | null = null;
  if (type === 'recharge') {
    const existingActiveSource = gameIsEmpty ? null : providerUser.activeFundingSource;

    if (requestedUseBonus) {
      // Server-side re-validation, never trust the client flag alone.
      if ((walletBalanceForRecharge ?? 0) > 0) {
        throw new AppError('Bonus Balance can only be used to recharge when your Wallet Balance is $0.', 400);
      }
      const availableBonus = (bonusBalanceForRecharge ?? 0) - unresolvedBonusRecharges;
      if (availableBonus < amount) {
        throw new AppError(`Not enough bonus balance available. Available: $${Math.max(0, availableBonus).toFixed(2)}`, 400);
      }
      if (existingActiveSource && existingActiveSource !== 'BONUS') {
        throw new AppError('Your game balance is currently funded by your Wallet. Please cash out before switching to Bonus Balance.', 400);
      }
      fundingSource = 'BONUS';
    } else {
      const availableForRecharge = (walletBalanceForRecharge ?? 0) - unresolvedWalletRecharges;
      if (availableForRecharge < amount) {
        throw new AppError(`Not enough funds! Click on this message to deposit $${(amount - availableForRecharge).toFixed(2)}`, 400);
      }
      if (existingActiveSource && existingActiveSource !== 'WALLET') {
        throw new AppError('Your game balance is currently funded by Bonus Balance. Please cash out before adding Wallet funds.', 400);
      }
      fundingSource = 'WALLET';
    }
  } else {
    // withdraw (cash out from game) — captured BEFORE any mutation; used after a successful sweep below.
    capturedFundingSourceForWithdraw = providerUser.activeFundingSource;

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
  // This entire block is the EXISTING, untouched 100%/30% game-recharge promotional bonus mechanism — it is
  // deliberately separate from the Bonus Balance system (UserBonus/BonusCashoutRule) and only ever applies to
  // a WALLET-funded recharge; a Bonus-Balance-funded recharge sends the exact requested amount with no
  // inflation (see the `fundingSource === 'BONUS'` branch below).
  let finalProviderAmount = amount;
  let bonusAmount = 0;
  let bonusKind: 'welcome' | 'deposit' | null = null;
  let wonWelcomeClaim = false;
  let user: { id: string; username: string; email: string; isVerified: boolean; isPhoneVerified: boolean; referredById: string | null } | null = null;
  let userProfile: { phone: string | null } | null = null;
  let welcomeBonusDef: { id: string } | null = null, depositBonusDef: { id: string } | null = null, referralBonusDef: { id: string } | null = null;

  if (type === 'recharge' && fundingSource === 'WALLET') {
    // NOTE: firstRechargeCheck is GLOBAL (across all games) — the 100% signup bonus
    // is a one-time reward for the very first ever recharge on the platform.
    [user, userProfile, welcomeBonusDef, depositBonusDef, referralBonusDef] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true, isVerified: true, isPhoneVerified: true, referredById: true } }),
      prisma.userProfile.findUnique({ where: { userId }, select: { phone: true } }),
      prisma.bonus.findFirst({ where: { type: 'welcome' } }),
      prisma.bonus.findFirst({ where: { type: 'deposit' } }),
      prisma.bonus.findFirst({ where: { type: 'referral' } })
    ]);

    if (welcomeBonusDef && user?.isVerified && user?.isPhoneVerified) {
      // Atomic claim of the one-time welcome-bonus slot: `create` (not a read-then-upsert) against the
      // unique [userId, bonusId] constraint is the race's winner-takes-it-all gate — a concurrent duplicate
      // attempt hits P2002 and falls back to the regular 30% bonus below. This closes a real pre-existing
      // race where two simultaneous "first recharge" requests could both read "not yet claimed" and both
      // receive the 100% bonus before either had written its claim. Reversed (deleted) below if THIS specific
      // recharge later definitively fails, so a failed attempt never permanently burns the one-time bonus.
      try {
        await prisma.bonusClaim.create({ data: { userId, bonusId: welcomeBonusDef.id, amount } });
        wonWelcomeClaim = true;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }

    if (wonWelcomeClaim) {
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
  // comparing against the CURRENT live balance. For a recharge this reuses the fetch already taken above
  // (the mixing-guard staleness check) instead of a second, redundant provider round trip.
  const balanceBeforeForReconciliation: number | undefined = type === 'recharge' ? liveBalanceNow : liveGameBalance;

  // 3. Create the durable PENDING record BEFORE calling the provider. orderId is unique, so this IS the
  // idempotency boundary: a concurrent or replayed request for the same orderId (see the replay check above)
  // can never create a second row, and this exact orderId is what gets passed to the provider as its own
  // transaction reference. fundingSource is stamped now (not just on success) because the unresolved-recharge
  // aggregates above read pending/unknown rows to block double-spending the same money.
  await prisma.providerTransaction.create({
    data: { providerId: providerUser.providerId, userId, type, amount, orderId, status: 'pending', balanceBefore: balanceBeforeForReconciliation, fundingSource: type === 'recharge' ? fundingSource : null }
  });

  // 3.5 For a Bonus-Balance-funded recharge, debit atomically BEFORE calling the provider — never read-then-
  // write (see BonusLedgerService). If the debit itself can't fully complete (a concurrent race), the pending
  // row must not be left dangling, since the idempotent-replay check above would otherwise treat it as
  // "already being processed" forever.
  if (type === 'recharge' && fundingSource === 'BONUS') {
    try {
      bonusDebitBreakdown = await BonusLedgerService.debitUserBonusFIFO(userId, amount, orderId);
    } catch (err: any) {
      await prisma.providerTransaction.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'failed', errorMessage: String(err?.message || 'Bonus debit failed').slice(0, 300) } });
      throw err;
    }
  }

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
      // Only reverse on a DEFINITIVE failure — an ambiguous/unknown outcome might have actually reached the
      // provider, so reversing now would risk letting the same money be spent twice (mirrors the existing
      // wallet-side reasoning: nothing is "given back" in the ambiguous branch below either).
      if (bonusDebitBreakdown.length > 0) {
        await BonusLedgerService.reverseUserBonusDebit(userId, bonusDebitBreakdown, orderId).catch((e) => logger.error('[transferFunds] Failed to reverse bonus debit after a definitively failed recharge:', e));
      }
      if (wonWelcomeClaim && welcomeBonusDef) {
        // Release the one-time welcome-bonus slot claimed earlier so a future genuine first recharge can
        // still receive it — this attempt never actually moved any money.
        await prisma.bonusClaim.deleteMany({ where: { userId, bonusId: welcomeBonusDef.id } }).catch((e) => logger.error('[transferFunds] Failed to release welcome-bonus claim after a definitively failed recharge:', e));
      }
      throw new AppError(`Transfer failed: ${String(err?.message || 'Unknown error').slice(0, 300)}`, err instanceof AppError ? err.statusCode : 502);
    }
    return res.status(202).json({ success: false, message: 'Your transfer could not be confirmed and is being verified. Please check back in a few minutes before trying again.', data: { reconciling: true } });
  }

  // 5. SUCCESS — for a bonus-origin cashout, resolve the final eligible Wallet credit BEFORE finalizing the
  // durable record, since the stored `amount` must be the capped credit, never the full swept winnings.
  let bonusConversionResult: { eligibleWalletCredit: number; forfeitedAmount: number; ruleApplied: boolean; totalWinnings: number } | null = null;
  if (type === 'withdraw' && capturedFundingSourceForWithdraw === 'BONUS') {
    bonusConversionResult = await settleBonusCashoutConversion({
      userId,
      orderId,
      totalWinnings: creditedAmount,
      sessionBreakdown: (providerUser.activeSessionBonusBreakdown as Record<string, number> | null) || {},
    });
    creditedAmount = bonusConversionResult.eligibleWalletCredit;
  }

  // Finalize the durable record atomically, THEN (only now) grant whichever bonus was computed.
  await prisma.providerTransaction.update({
    where: { orderId },
    data: {
      status: 'success',
      amount: creditedAmount,
      ...(type === 'recharge' && fundingSource === 'BONUS' ? { bonusSourceBreakdown: bonusDebitBreakdown as any } : {}),
    },
  });
  invalidateWalletCache(userId);

  if (type === 'recharge' && fundingSource === 'WALLET') {
    if (!providerUser.activeFundingSource || gameIsEmpty) {
      await prisma.providerUser.update({
        where: { id: providerUser.id },
        data: { activeFundingSource: 'WALLET', ...(gameIsEmpty ? { activeSessionBonusBreakdown: Prisma.JsonNull } : {}) },
      }).catch((e) => logger.error('[transferFunds] Failed to stamp activeFundingSource=WALLET:', e));
    }
    // Audit-only — WalletService's derived aggregate remains the authoritative balance (unchanged by this row).
    recordWalletTransaction({
      userId,
      type: 'GAME_DEBIT',
      amount: -amount,
      balanceBefore: walletBalanceForRecharge ?? 0,
      balanceAfter: (walletBalanceForRecharge ?? 0) - amount,
      referenceId: orderId,
    });
  } else if (type === 'recharge' && fundingSource === 'BONUS') {
    const priorBreakdown: Record<string, number> = gameIsEmpty ? {} : ((providerUser.activeSessionBonusBreakdown as Record<string, number> | null) || {});
    const mergedBreakdown = { ...priorBreakdown };
    for (const entry of bonusDebitBreakdown) {
      mergedBreakdown[entry.sourceType] = Math.round(((mergedBreakdown[entry.sourceType] || 0) + entry.amountConsumed) * 100) / 100;
    }
    await prisma.providerUser.update({
      where: { id: providerUser.id },
      data: { activeFundingSource: 'BONUS', activeSessionBonusBreakdown: mergedBreakdown },
    }).catch((e) => logger.error('[transferFunds] Failed to merge activeSessionBonusBreakdown:', e));
  } else if (type === 'withdraw') {
    // The sweep always drains the ENTIRE live game balance, so after any successful cashout the game account
    // is empty again regardless of its prior funding source — clear the tag so the next recharge is free to
    // choose either Wallet or Bonus Balance.
    await prisma.providerUser.update({
      where: { id: providerUser.id },
      data: { activeFundingSource: null, activeSessionBonusBreakdown: Prisma.JsonNull },
    }).catch((e) => logger.error('[transferFunds] Failed to clear activeFundingSource after cashout:', e));

    if (capturedFundingSourceForWithdraw !== 'BONUS') {
      // The bonus-origin case already records its own BONUS_CONVERSION row inside settleBonusCashoutConversion.
      recordWalletTransaction({
        userId,
        type: 'GAME_WIN',
        amount: creditedAmount,
        balanceBefore: 0,
        balanceAfter: creditedAmount,
        referenceId: orderId,
        metadata: voidedAmount > 0 ? { voidedAmount } : undefined,
      });
    }
  }

  if (type === 'recharge' && fundingSource === 'WALLET' && bonusAmount > 0 && user) {
    if (bonusKind === 'welcome' && welcomeBonusDef) {
      // The BonusClaim row was already atomically created at decision time above (the race-closing claim) —
      // it must NOT be upserted/incremented again here, or this one-time bonus would be double-counted.
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
        const refBonus = computeReferralBonusAmount(amount);
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

  // 6. Build response message (wallet-path contract unchanged)
  let message: string;
  if (type === 'recharge' && bonusAmount > 0) {
    message = `Transfer successful! Added $${bonusAmount.toFixed(2)} bonus to your game balance.`;
  } else if (type === 'recharge' && fundingSource === 'BONUS') {
    message = `Transfer successful! $${amount.toFixed(2)} funded from your Bonus Balance.`;
  } else if (type === 'withdraw') {
    if (bonusConversionResult) {
      message = bonusConversionResult.ruleApplied
        ? `Cashout successful! Your $${bonusConversionResult.totalWinnings.toFixed(2)} bonus-origin win converted to $${bonusConversionResult.eligibleWalletCredit.toFixed(2)} Wallet credit under the applicable Bonus Cashout Rule.`
        : `Cashout successful! Your bonus-origin winnings did not meet any active Bonus Cashout Rule, so no Wallet credit was issued this time.`;
    } else if (voidedAmount > 0) {
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
    data: type === 'withdraw'
      ? {
          credited: creditedAmount,
          voided: voidedAmount,
          ...(bonusConversionResult ? {
            bonusConversion: {
              totalWinnings: bonusConversionResult.totalWinnings,
              eligibleWalletCredit: bonusConversionResult.eligibleWalletCredit,
              forfeitedAmount: bonusConversionResult.forfeitedAmount,
            },
          } : {}),
        }
      : undefined
  });
})

/**
 * Settles a bonus-origin game cashout: finds the matching BonusCashoutRule, computes the eligible Wallet
 * credit, and atomically records BonusConversion + the two BonusTransaction audit rows. Idempotent on
 * BonusConversion.providerTransactionOrderId — a retried/duplicate call for the same orderId re-reads the
 * already-recorded outcome instead of ever crediting twice (the idempotent-replay check at the very top of
 * transferFunds already short-circuits a genuine HTTP retry before this is ever reached again for the same
 * orderId; the unique constraint is kept as a hard backstop regardless, e.g. against a reconciliation re-run).
 */
async function settleBonusCashoutConversion(opts: {
  userId: string
  orderId: string
  totalWinnings: number
  sessionBreakdown: Record<string, number>
}): Promise<{ eligibleWalletCredit: number; forfeitedAmount: number; ruleApplied: boolean; totalWinnings: number }> {
  const { userId, orderId, sessionBreakdown } = opts
  const totalWinnings = Math.round(opts.totalWinnings * 100) / 100
  const sessionSourceTypes = Object.keys(sessionBreakdown)

  const rule = await BonusCashoutRuleService.findMatchingRule(totalWinnings, sessionSourceTypes.length > 0 ? sessionSourceTypes : ['ALL'])
  const eligibleWalletCredit = BonusCashoutRuleService.computeEligibleWalletCredit(totalWinnings, rule)
  const forfeitedAmount = Math.round(Math.max(0, totalWinnings - eligibleWalletCredit) * 100) / 100
  const currentBonusBalance = await BonusService.getBonusBalanceRaw(userId)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bonusConversion.create({
        data: {
          userId,
          providerTransactionOrderId: orderId,
          totalWinnings,
          eligibleWalletCredit,
          ruleId: rule?.id,
          ruleMinAmountSnapshot: rule?.minAmount,
          ruleMaxAmountSnapshot: rule?.maxAmount,
          ruleWalletCreditSnapshot: rule?.walletCreditAmount,
          primarySourceType: sessionSourceTypes[0],
          sourceBreakdown: sessionBreakdown,
        },
      })
      // Audit-only rows — the game win itself never touches Bonus Balance (it was already spent funding the
      // recharge), and the conversion credits WALLET balance, not Bonus Balance, so before/after are the
      // current (unchanged) bonus balance for both.
      await tx.bonusTransaction.create({
        data: { userId, type: 'BONUS_GAME_WIN', amount: totalWinnings, balanceBefore: currentBonusBalance, balanceAfter: currentBonusBalance, referenceId: orderId, metadata: { sourceBreakdown: sessionBreakdown } },
      })
      await tx.bonusTransaction.create({
        data: { userId, type: 'BONUS_CONVERSION', amount: eligibleWalletCredit, balanceBefore: currentBonusBalance, balanceAfter: currentBonusBalance, referenceId: orderId, metadata: { totalWinnings, forfeitedAmount, ruleId: rule?.id } },
      })
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // A BonusConversion for this orderId already exists — re-read what was already recorded rather than
      // ever crediting a second time.
      const existing = await prisma.bonusConversion.findUnique({ where: { providerTransactionOrderId: orderId } })
      if (existing) {
        return {
          eligibleWalletCredit: existing.eligibleWalletCredit,
          forfeitedAmount: Math.round(Math.max(0, existing.totalWinnings - existing.eligibleWalletCredit) * 100) / 100,
          ruleApplied: !!existing.ruleId,
          totalWinnings: existing.totalWinnings,
        }
      }
    }
    throw err
  }

  recordWalletTransaction({
    userId,
    type: 'BONUS_CONVERSION',
    amount: eligibleWalletCredit,
    balanceBefore: 0, // WalletService's derived aggregate remains the authoritative balance; this row is audit-only
    balanceAfter: eligibleWalletCredit,
    referenceId: orderId,
    metadata: { totalWinnings, forfeitedAmount, ruleId: rule?.id },
  })

  return { eligibleWalletCredit, forfeitedAmount, ruleApplied: !!rule, totalWinnings }
}

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

