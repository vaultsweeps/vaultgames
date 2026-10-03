import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { BonusLedgerService } from './BonusLedgerService';

const FREEPLAY_AMOUNT = 3;
const MIN_WEEKLY_DEPOSITS = 5;
const QUALIFYING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Standard ISO-8601 week-year key (e.g. "2026-W40"), computed in UTC. This IS the weekly idempotency
 * boundary via SundayFreeplayClaim's [userId, weekKey] unique constraint — a re-run or crash-recovery for
 * the same week simply hits a unique-constraint violation and moves on.
 */
export function getUTCISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Monday=1 .. Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export class SundayFreeplayService {
  /**
   * Grants the $3 weekly Freeplay bonus to every active, non-banned user with >= $5 in APPROVED deposits in
   * the 7 days immediately before the grant runs (a rolling window, not a lifetime total — a user who
   * deposited $5 months ago but nothing recently does not qualify) who hasn't already claimed it for the
   * current UTC ISO week. Server-side eligibility only — never trusts a client-supplied flag.
   */
  static async runWeeklyGrant(): Promise<void> {
    const now = new Date();
    const weekKey = getUTCISOWeekKey(now);
    const windowStart = new Date(now.getTime() - QUALIFYING_WINDOW_MS);

    // Narrow to users with an approved deposit inside the window and no claim yet this week; the exact
    // windowed-total >= $5 check runs per-candidate below since Prisma can't express a HAVING-sum filter
    // directly. Runs once a week via cron, so a straightforward per-candidate loop is fine at current scale.
    const candidates = await prisma.user.findMany({
      where: {
        isActive: true,
        isBanned: false,
        deposits: { some: { status: 'approved', createdAt: { gte: windowStart } } },
        sundayFreeplayClaims: { none: { weekKey } },
      },
      select: { id: true },
    });

    logger.info(`[SundayFreeplayService] Week ${weekKey}: evaluating ${candidates.length} candidate(s)`);

    for (const { id: userId } of candidates) {
      try {
        const depositSum = await prisma.deposit.aggregate({
          where: { userId, status: 'approved', createdAt: { gte: windowStart } },
          _sum: { amount: true },
        });
        const windowedDeposits = depositSum._sum.amount || 0;
        if (windowedDeposits < MIN_WEEKLY_DEPOSITS) continue;

        await prisma.$transaction(async (tx) => {
          const claim = await tx.sundayFreeplayClaim.create({
            data: { userId, weekKey, amount: FREEPLAY_AMOUNT },
          });
          const grant = await BonusLedgerService.grantUserBonusTx(tx, {
            userId,
            sourceType: 'FREEPLAY',
            amount: FREEPLAY_AMOUNT,
            referenceId: claim.id,
          });
          if (grant) {
            await tx.sundayFreeplayClaim.update({
              where: { id: claim.id },
              data: { userBonusId: grant.userBonusId },
            });
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2002') continue; // already claimed this week — race with a concurrent run
        logger.error(`[SundayFreeplayService] Failed to grant freeplay to user ${userId}:`, err);
      }
    }
  }

  static startCron() {
    console.log('[SundayFreeplayService] Starting Sunday Freeplay cron job');
    // 00:05 UTC every Sunday. Deploy server's TZ should be confirmed so "Sunday" means what's operationally
    // expected — UTC vs. local can differ by hours right at the boundary.
    cron.schedule('5 0 * * 0', () => {
      this.runWeeklyGrant().catch((err) =>
        logger.error('[SundayFreeplayService] runWeeklyGrant cron error:', err),
      );
    });
  }
}
