import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { BonusService, invalidateBonusCache } from './BonusService';

export interface BonusDebitBreakdownEntry {
  userBonusId: string;
  sourceType: string;
  amountConsumed: number;
}

export class BonusLedgerService {
  /**
   * Grants a new bonus balance instance. Called from WITHIN the same transaction as the caller's own
   * idempotent write (coupon claim, referral reward, wheel spin, crypto deposit bonus, Sunday Freeplay
   * claim) so a grant can never be orphaned relative to the event that caused it — if the caller's
   * transaction rolls back, this grant rolls back with it.
   */
  static async grantUserBonusTx(
    tx: Prisma.TransactionClient,
    opts: {
      userId: string;
      sourceType: string;
      amount: number;
      referenceId?: string;
      expiresAt?: Date;
    },
  ): Promise<{ userBonusId: string } | null> {
    const amount = Math.round(opts.amount * 100) / 100;
    if (amount <= 0) return null;

    const before = await tx.userBonus.aggregate({
      where: { userId: opts.userId, status: 'active' },
      _sum: { remainingAmount: true },
    });
    const balanceBefore = Math.round((before._sum.remainingAmount || 0) * 100) / 100;

    const userBonus = await tx.userBonus.create({
      data: {
        userId: opts.userId,
        sourceType: opts.sourceType,
        originalAmount: amount,
        remainingAmount: amount,
        referenceId: opts.referenceId,
        expiresAt: opts.expiresAt,
      },
    });

    await tx.bonusTransaction.create({
      data: {
        userId: opts.userId,
        userBonusId: userBonus.id,
        type: 'BONUS_CREDIT',
        sourceType: opts.sourceType,
        amount,
        balanceBefore,
        balanceAfter: Math.round((balanceBefore + amount) * 100) / 100,
        referenceId: opts.referenceId,
      },
    });

    invalidateBonusCache(opts.userId);
    return { userBonusId: userBonus.id };
  }

  /**
   * Atomically consumes `amount` of bonus balance across active UserBonus rows, oldest first (FIFO). Uses a
   * per-row guarded `updateMany` (not read-then-write) so a concurrent debit of the SAME row can never
   * over-consume it — the exact anti-pattern behind a real production coupon-overclaim bug fixed earlier in
   * this engagement. On a losing race for a row it simply re-reads and moves on, bounded by
   * MAX_TOTAL_ATTEMPTS; if it can never fully consume the requested amount, it restores whatever it DID take
   * before throwing, so a failed recharge attempt never leaves a dangling partial bonus debit.
   */
  static async debitUserBonusFIFO(
    userId: string,
    amount: number,
    referenceId?: string,
  ): Promise<BonusDebitBreakdownEntry[]> {
    let remaining = Math.round(amount * 100) / 100;
    if (remaining <= 0) return [];

    const breakdown: BonusDebitBreakdownEntry[] = [];
    const MAX_TOTAL_ATTEMPTS = 20;

    for (let attempt = 0; attempt < MAX_TOTAL_ATTEMPTS && remaining > 0; attempt++) {
      const candidates = await prisma.userBonus.findMany({
        where: { userId, status: 'active', remainingAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });
      if (candidates.length === 0) break;

      for (const row of candidates) {
        if (remaining <= 0) break;
        const consume = Math.round(Math.min(row.remainingAmount, remaining) * 100) / 100;
        if (consume <= 0) continue;

        const balanceBefore = await BonusService.getBonusBalanceRaw(userId);

        const result = await prisma.userBonus.updateMany({
          where: { id: row.id, remainingAmount: { gte: consume } },
          data: { remainingAmount: { decrement: consume } },
        });
        if (result.count === 0) continue; // lost the race on this row — re-fetch on the next outer attempt

        const updated = await prisma.userBonus.findUnique({ where: { id: row.id } });
        if (updated && updated.remainingAmount <= 0.001 && updated.status === 'active') {
          await prisma.userBonus.updateMany({
            where: { id: row.id, status: 'active' },
            data: { status: 'depleted' },
          });
        }

        await prisma.bonusTransaction.create({
          data: {
            userId,
            userBonusId: row.id,
            type: 'BONUS_GAME_DEBIT',
            sourceType: row.sourceType,
            amount: -consume,
            balanceBefore,
            balanceAfter: Math.round((balanceBefore - consume) * 100) / 100,
            referenceId,
          },
        });

        breakdown.push({ userBonusId: row.id, sourceType: row.sourceType, amountConsumed: consume });
        remaining = Math.round((remaining - consume) * 100) / 100;
      }
    }

    if (remaining > 0.001) {
      if (breakdown.length > 0) {
        await this.reverseUserBonusDebit(userId, breakdown, referenceId);
      }
      throw new AppError('Insufficient bonus balance (concurrent update) — please retry', 409);
    }

    invalidateBonusCache(userId);
    return breakdown;
  }

  /**
   * Revokes an entire bonus GRANT — used when the underlying event that caused it is later voided (e.g. a
   * crypto deposit reversed as fraudulent/refunded). Zeroes out whatever is still unspent and marks the
   * UserBonus 'reversed', logging a negative BONUS_REVERSAL row for the amount actually clawed back. Money
   * already consumed by a game recharge is NOT retroactively clawed back — only what's still sitting unspent.
   * A no-op if the grant is already inactive or already fully spent.
   */
  static async revokeUserBonusGrant(userBonusId: string, referenceId?: string): Promise<void> {
    const row = await prisma.userBonus.findUnique({ where: { id: userBonusId } });
    if (!row || row.status !== 'active' || row.remainingAmount <= 0) return;

    const clawback = row.remainingAmount;
    const balanceBefore = await BonusService.getBonusBalanceRaw(row.userId);

    const result = await prisma.userBonus.updateMany({
      where: { id: userBonusId, status: 'active' },
      data: { remainingAmount: 0, status: 'reversed' },
    });
    if (result.count === 0) return; // lost a race (e.g. got spent concurrently) — nothing left to claw back

    await prisma.bonusTransaction.create({
      data: {
        userId: row.userId,
        userBonusId,
        type: 'BONUS_REVERSAL',
        sourceType: row.sourceType,
        amount: -clawback,
        balanceBefore,
        balanceAfter: Math.round((balanceBefore - clawback) * 100) / 100,
        referenceId,
      },
    });
    invalidateBonusCache(row.userId);
  }

  /**
   * Restores exactly the given breakdown via atomic increments + a BONUS_REVERSAL row each. Used on a
   * definitive recharge failure, a losing-race rollback inside debitUserBonusFIFO above, and from admin
   * reconciliation of an 'unknown' bonus-funded recharge later resolved to 'failed'.
   */
  static async reverseUserBonusDebit(
    userId: string,
    breakdown: BonusDebitBreakdownEntry[],
    referenceId?: string,
  ): Promise<void> {
    for (const entry of breakdown) {
      const row = await prisma.userBonus.findUnique({ where: { id: entry.userBonusId } });
      if (!row) continue; // UserBonus rows are never deleted — this should not happen

      const balanceBefore = await BonusService.getBonusBalanceRaw(userId);

      await prisma.userBonus.update({
        where: { id: entry.userBonusId },
        data: {
          remainingAmount: { increment: entry.amountConsumed },
          // A depleted bonus that gets money restored becomes active again; reversed/expired stays as-is.
          status: row.status === 'depleted' ? 'active' : row.status,
        },
      });

      await prisma.bonusTransaction.create({
        data: {
          userId,
          userBonusId: entry.userBonusId,
          type: 'BONUS_REVERSAL',
          sourceType: entry.sourceType,
          amount: entry.amountConsumed,
          balanceBefore,
          balanceAfter: Math.round((balanceBefore + entry.amountConsumed) * 100) / 100,
          referenceId,
        },
      });
    }
    invalidateBonusCache(userId);
  }
}
