import prisma from '../lib/prisma';

export class WalletService {
  /**
   * Returns the total bonus balance earned by the user (welcome, deposit, referral).
   * This amount is NOT withdrawable — it can only be used to recharge game balance.
   */
  static async getTotalBonusBalance(userId: string): Promise<number> {
    const bonuses = await prisma.bonusClaim.aggregate({
      where: { userId },
      _sum: { amount: true }
    });
    return bonuses._sum.amount || 0;
  }

  /**
   * Returns the withdrawable (real cash) balance.
   * Formula:
   *   Withdrawable = Total Platform Deposits
   *                + Total Cashouts from Games
   *                - Total Platform Withdrawals
   *                - Total Deposits to Games
   *                - Total Bonuses
   *
   * NOTE: Bonuses are intentionally excluded here — they can only
   * be transferred to a game, never cashed out.
   */
  static async getWithdrawableBalance(userId: string): Promise<number> {
    const deposits = await prisma.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true }
    });

    const withdrawals = await prisma.withdrawal.aggregate({
      where: { userId, status: { in: ['pending', 'approved', 'paid'] } },
      _sum: { amount: true }
    });

    const gameRecharges = await prisma.providerTransaction.aggregate({
      where: { userId, type: 'recharge', status: 'success' },
      _sum: { amount: true }
    });

    const gameWithdrawals = await prisma.providerTransaction.aggregate({
      where: { userId, type: 'withdraw', status: 'success' },
      _sum: { amount: true }
    });

    const bonuses = await WalletService.getTotalBonusBalance(userId);

    const totalDeposited = deposits._sum.amount || 0;
    const totalWithdrawn = withdrawals._sum.amount || 0;
    const totalGameRecharges = gameRecharges._sum.amount || 0;
    const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;

    const withdrawable = totalDeposited + totalGameWithdrawals - totalWithdrawn - totalGameRecharges - bonuses;
    
    // Can never be negative
    return Math.max(0, withdrawable);
  }

  /**
   * Returns the full display balance (includes all bonuses).
   * This is shown to the user in the UI as their "main wallet balance".
   * Formula:
   *   Display Balance = Withdrawable Balance + Bonus Balance
   */
  static async getWalletBalance(userId: string): Promise<number> {
    const [withdrawable, bonus] = await Promise.all([
      WalletService.getWithdrawableBalance(userId),
      WalletService.getTotalBonusBalance(userId),
    ]);
    return withdrawable + bonus;
  }
}
