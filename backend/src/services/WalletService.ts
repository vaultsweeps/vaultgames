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

  static async getWalletBalance(userId: string): Promise<number> {
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

    const withdrawable = Math.max(0, totalDeposited + totalGameWithdrawals - totalWithdrawn - totalGameRecharges);
    const usedBonus = Math.max(0, totalGameRecharges - (totalDeposited + totalGameWithdrawals - totalWithdrawn));
    const remainingBonus = Math.max(0, bonuses - usedBonus);
    
    return withdrawable + remainingBonus;
  }

  /**
   * Returns the withdrawable (real cash) balance.
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

    const totalDeposited = deposits._sum.amount || 0;
    const totalWithdrawn = withdrawals._sum.amount || 0;
    const totalGameRecharges = gameRecharges._sum.amount || 0;
    const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;

    return Math.max(0, totalDeposited + totalGameWithdrawals - totalWithdrawn - totalGameRecharges);
  }
}
