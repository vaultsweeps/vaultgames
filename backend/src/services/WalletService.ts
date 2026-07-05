import prisma from '../lib/prisma';

// In-memory wallet balance cache (10-second TTL)
// Eliminates 4 aggregate DB queries per balance fetch for the same user.
// Always invalidated immediately on deposit, withdrawal, or game transfer.
const walletCache = new Map<string, { balance: number; expiresAt: number }>()
const WALLET_CACHE_TTL = 10_000 // 10 seconds

export function invalidateWalletCache(userId: string) {
  walletCache.delete(userId)
}

function getWalletCached(userId: string): number | null {
  const entry = walletCache.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { walletCache.delete(userId); return null }
  return entry.balance
}

function setWalletCached(userId: string, balance: number) {
  walletCache.set(userId, { balance, expiresAt: Date.now() + WALLET_CACHE_TTL })
}

export class WalletService {
  /**
   * Returns the total referral bonus balance earned by the user.
   * This amount is NOT withdrawable — it can only be used to recharge game balance.
   */
  static async getReferralBonusBalance(userId: string): Promise<number> {
    const referralBonuses = await prisma.bonusClaim.aggregate({
      where: { userId, bonus: { type: 'referral' } },
      _sum: { amount: true }
    });
    return referralBonuses._sum.amount || 0;
  }

  /**
   * Returns the withdrawable (real cash) balance.
   * Formula:
   *   Withdrawable = Total Platform Deposits
   *                + Total Cashouts from Games
   *                - Total Platform Withdrawals
   *                - Total Deposits to Games
   *
   * NOTE: Referral bonuses are intentionally excluded here — they can only
   * be transferred to a game, never cashed out.
   */
  static async getWithdrawableBalance(userId: string): Promise<number> {
    // All 4 aggregates run in parallel for maximum speed
    const [deposits, withdrawals, gameRecharges, gameWithdrawals] = await Promise.all([
      prisma.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { userId, status: { in: ['pending', 'approved', 'paid'] } }, _sum: { amount: true } }),
      prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: 'success' }, _sum: { amount: true } }),
      prisma.providerTransaction.aggregate({ where: { userId, type: 'withdraw', status: 'success' }, _sum: { amount: true } }),
    ]);

    const totalDeposited = deposits._sum.amount || 0;
    const totalWithdrawn = withdrawals._sum.amount || 0;
    const totalGameRecharges = gameRecharges._sum.amount || 0;
    const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;

    return totalDeposited + totalGameWithdrawals - totalWithdrawn - totalGameRecharges;
  }

  /**
   * Returns the full display balance (includes referral bonuses).
   * This is shown to the user in the UI as their "main wallet balance".
   * Formula:
   *   Display Balance = Withdrawable Balance + Referral Bonus Balance
   *
   * Cached for 10 seconds per user. Invalidated by invalidateWalletCache().
   */
  static async getWalletBalance(userId: string): Promise<number> {
    // Serve from cache if still fresh
    const cached = getWalletCached(userId)
    if (cached !== null) return cached

    // Compute fresh: both sub-queries run in parallel
    const [withdrawable, referral] = await Promise.all([
      WalletService.getWithdrawableBalance(userId),
      WalletService.getReferralBonusBalance(userId),
    ]);
    const balance = withdrawable + referral

    // Store in cache
    setWalletCached(userId, balance)

    return balance;
  }
}
