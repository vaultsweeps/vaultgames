import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { BonusLedgerService } from './BonusLedgerService';

export const FREEPLAY_AMOUNT = 3;
export const MIN_WEEKLY_DEPOSITS = 5;
const QUALIFYING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FREEPLAY_TIMEZONE = 'America/New_York';

/**
 * The Freeplay week runs Sunday through Saturday, New York time, keyed by that week's Sunday
 * (e.g. "SUN-2026-10-04"). Claims are made by texting staff on Signal and granted by staff afterwards, so
 * a Sunday request processed on Monday must still count for the SAME week — a Monday-start (ISO) week
 * would push it into the next week and wrongly block the customer's following Sunday claim.
 * SundayFreeplayClaim's [userId, weekKey] unique constraint enforces one grant per user per week.
 */
export function getFreeplayWeekKey(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: FREEPLAY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const sunday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - dayOfWeek));
  return `SUN-${sunday.toISOString().slice(0, 10)}`;
}

export interface FreeplayStatus {
  eligible: boolean;
  amount: number;
  minDeposit: number;
  recentDeposits: number;
  weekKey: string;
  checks: {
    accountActive: boolean;
    depositRequirementMet: boolean;
    notClaimedThisWeek: boolean;
  };
}

export class SundayFreeplayService {
  /**
   * Server-side eligibility for the $3 weekly Freeplay — never trusts a client-supplied flag:
   *  - account active and not banned
   *  - >= $5 in APPROVED deposits in the 7 days before now (a rolling window, not a lifetime total)
   *  - not already granted in the current Freeplay week
   */
  static async getStatus(userId: string, now: Date = new Date()): Promise<FreeplayStatus | null> {
    const weekKey = getFreeplayWeekKey(now);
    const windowStart = new Date(now.getTime() - QUALIFYING_WINDOW_MS);
    const [user, depositSum, claim] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, isBanned: true } }),
      prisma.deposit.aggregate({ where: { userId, status: 'approved', createdAt: { gte: windowStart } }, _sum: { amount: true } }),
      prisma.sundayFreeplayClaim.findUnique({ where: { userId_weekKey: { userId, weekKey } }, select: { id: true } }),
    ]);
    if (!user) return null;

    const recentDeposits = Math.round((depositSum._sum.amount || 0) * 100) / 100;
    const checks = {
      accountActive: user.isActive && !user.isBanned,
      depositRequirementMet: recentDeposits >= MIN_WEEKLY_DEPOSITS,
      notClaimedThisWeek: !claim,
    };
    return {
      eligible: checks.accountActive && checks.depositRequirementMet && checks.notClaimedThisWeek,
      amount: FREEPLAY_AMOUNT,
      minDeposit: MIN_WEEKLY_DEPOSITS,
      recentDeposits,
      weekKey,
      checks,
    };
  }

  /**
   * Grants this week's $3 Freeplay to one user — called by staff after the customer requests it on Signal.
   * Re-checks eligibility server-side at grant time. The claim row and the Bonus Balance grant are written in
   * one transaction, and the [userId, weekKey] unique constraint makes a double grant impossible even if two
   * staff members click at the same moment.
   */
  static async grantForUser(userId: string, grantedBy: string): Promise<{ granted: true; amount: number; weekKey: string } | { granted: false; reason: string }> {
    const status = await this.getStatus(userId);
    if (!status) return { granted: false, reason: 'User not found' };
    if (!status.checks.accountActive) return { granted: false, reason: 'Account is inactive or banned' };
    if (!status.checks.notClaimedThisWeek) return { granted: false, reason: 'Already received Freeplay this week' };
    if (!status.checks.depositRequirementMet) {
      return { granted: false, reason: `Needs at least $${MIN_WEEKLY_DEPOSITS} in approved deposits in the last 7 days (has $${status.recentDeposits.toFixed(2)})` };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.sundayFreeplayClaim.create({
          data: { userId, weekKey: status.weekKey, amount: FREEPLAY_AMOUNT },
        });
        const grant = await BonusLedgerService.grantUserBonusTx(tx, {
          userId,
          sourceType: 'FREEPLAY',
          amount: FREEPLAY_AMOUNT,
          referenceId: claim.id,
        });
        if (grant) {
          await tx.sundayFreeplayClaim.update({ where: { id: claim.id }, data: { userBonusId: grant.userBonusId } });
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return { granted: false, reason: 'Already received Freeplay this week' };
      throw err;
    }

    logger.info(`[SundayFreeplayService] Granted $${FREEPLAY_AMOUNT} Freeplay to user ${userId} for ${status.weekKey} (by admin ${grantedBy})`);
    return { granted: true, amount: FREEPLAY_AMOUNT, weekKey: status.weekKey };
  }
}
