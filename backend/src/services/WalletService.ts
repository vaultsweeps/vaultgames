import prisma from '../lib/prisma';
import { getCached, invalidateCached } from '../lib/redis';

const WALLET_CACHE_TTL = 10; // 10 seconds

export function invalidateWalletCache(userId: string) {
  // Fire and forget invalidations
  invalidateCached(`wallet_referral:${userId}`).catch(() => {});
  invalidateCached(`wallet_withdrawable:${userId}`).catch(() => {});
  invalidateCached(`wallet_display:${userId}`).catch(() => {});
}

export class WalletService {
  /**
   * Returns the total referral bonus balance earned by the user.
   * This amount is NOT withdrawable — it can only be used to recharge game balance.
   */
  static async getReferralBonusBalance(userId: string): Promise<number> {
    return getCached(`wallet_referral:${userId}`, async () => {
      const referralBonuses = await prisma.bonusClaim.aggregate({
        where: { userId, bonus: { type: 'referral' } },
        _sum: { amount: true }
      });
      return referralBonuses._sum.amount || 0;
    }, WALLET_CACHE_TTL);
  }

  /**
   * Returns the withdrawable (real cash) balance.
   */
  static async getWithdrawableBalance(userId: string): Promise<number> {
    return getCached(`wallet_withdrawable:${userId}`, async () => {
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
    }, WALLET_CACHE_TTL);
  }

  /**
   * Returns the full display balance (includes referral bonuses).
   */
  static async getWalletBalance(userId: string): Promise<number> {
    return getCached(`wallet_display:${userId}`, async () => {
      // Compute fresh: both sub-queries run in parallel
      const [withdrawable, referral] = await Promise.all([
        WalletService.getWithdrawableBalance(userId),
        WalletService.getReferralBonusBalance(userId),
      ]);
      return withdrawable + referral;
    }, WALLET_CACHE_TTL);
  }
}
