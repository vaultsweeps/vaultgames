import prisma from '../lib/prisma';
import { getCached, invalidateCached } from '../lib/redis';

const WALLET_CACHE_TTL = 10; // 10 seconds

export function invalidateWalletCache(userId: string) {
  // Fire and forget invalidations
  invalidateCached(`wallet_balances:${userId}`).catch(() => {});
  invalidateCached(`wallet_referral:${userId}`).catch(() => {});
  invalidateCached(`wallet_withdrawable:${userId}`).catch(() => {});
  invalidateCached(`wallet_display:${userId}`).catch(() => {});
  invalidateCached(`wallet_wheel:${userId}`).catch(() => {});
}

export class WalletService {
  /**
   * Returns the total referral bonus balance earned by the user historically.
   */
  static async getHistoricalReferralBonus(userId: string): Promise<number> {
    const referralBonuses = await prisma.bonusClaim.aggregate({
      where: { userId, bonus: { type: 'referral' } },
      _sum: { amount: true }
    });
    return referralBonuses._sum.amount || 0;
  }

  /**
   * Returns the withdrawable (real cash) balance and display balance together.
   */
  static async getBalances(userId: string) {
    return getCached(`wallet_balances:${userId}`, async () => {
      // Run all aggregates in parallel for maximum speed
      const [deposits, withdrawals, gameRecharges, gameWithdrawals, referralBonuses, wheelBonuses] = await Promise.all([
        prisma.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { userId, status: { in: ['pending', 'approved', 'paid'] } }, _sum: { amount: true } }),
        prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: 'success' }, _sum: { amount: true } }),
        prisma.providerTransaction.aggregate({ where: { userId, type: 'withdraw', status: 'success' }, _sum: { amount: true } }),
        prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'referral' } }, _sum: { amount: true } }),
        prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'wheel' } }, _sum: { amount: true } })
      ]);

      const totalDeposited = deposits._sum.amount || 0;
      const totalWithdrawn = withdrawals._sum.amount || 0;
      const totalGameRecharges = gameRecharges._sum.amount || 0;
      const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;
      const totalReferralBonus = referralBonuses._sum.amount || 0;
      const totalWheelBonus = wheelBonuses._sum.amount || 0;

      // 1. Calculate the absolute total wallet balance mathematically
      const totalWalletBalance = totalDeposited + totalGameWithdrawals + totalReferralBonus + totalWheelBonus - totalWithdrawn - totalGameRecharges;
      
      // Ensure it never technically drops below 0 due to floating point or weird manual edits
      const displayBalance = Math.max(0, totalWalletBalance);

      // 2. Calculate remaining referral bonus (assumes bonus is used LAST after real cash)
      // Wheel bonuses are also considered bonus balance in this context
      const remainingBonus = Math.min(totalReferralBonus + totalWheelBonus, displayBalance);

      // 3. The withdrawable cash is simply whatever is left over after reserving the remaining bonus
      const withdrawableBalance = Math.max(0, displayBalance - remainingBonus);

      return { displayBalance, withdrawableBalance, remainingBonus };
    }, WALLET_CACHE_TTL);
  }

  static async getReferralBonusBalance(userId: string): Promise<number> {
    const balances = await this.getBalances(userId);
    return balances.remainingBonus;
  }

  static async getWithdrawableBalance(userId: string): Promise<number> {
    const balances = await this.getBalances(userId);
    return balances.withdrawableBalance;
  }

  static async getWalletBalance(userId: string): Promise<number> {
    const balances = await this.getBalances(userId);
    return balances.displayBalance;
  }
}
