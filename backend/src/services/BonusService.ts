import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { getCached, invalidateCached } from '../lib/redis';

const BONUS_CACHE_TTL = 10; // 10 seconds, matches WalletService's WALLET_CACHE_TTL

export function invalidateBonusCache(userId: string) {
  invalidateCached(`bonus_balance:${userId}`).catch(() => {});
}

export class BonusService {
  /**
   * Cached sum of every ACTIVE UserBonus.remainingAmount for the user — the Bonus Balance shown in the UI.
   */
  static async getBonusBalance(userId: string): Promise<number> {
    return getCached(`bonus_balance:${userId}`, () => this.getBonusBalanceRaw(userId), BONUS_CACHE_TTL);
  }

  /**
   * Uncached read, and accepts a transaction client so it can be called from inside a Serializable
   * transaction for a race-safe pre-debit eligibility check — mirrors WalletService.getBalancesRaw.
   */
  static async getBonusBalanceRaw(
    userId: string,
    client: Pick<typeof prisma, 'userBonus'> = prisma,
  ): Promise<number> {
    const result = await client.userBonus.aggregate({
      where: { userId, status: 'active' },
      _sum: { remainingAmount: true },
    });
    return Math.round((result._sum.remainingAmount || 0) * 100) / 100;
  }

  /**
   * Active bonus grants in FIFO consumption order (oldest first) — the order debitUserBonusFIFO consumes
   * them in.
   */
  static async getActiveUserBonuses(
    userId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.userBonus.findMany({
      where: { userId, status: 'active', remainingAmount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
