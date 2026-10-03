import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { invalidateWalletCache } from './WalletService';
import { BonusLedgerService } from './BonusLedgerService';

const MAX_REFERRAL_BONUS = 10;

/**
 * Tiered (not percentage-based) referral reward: the referee's qualifying amount (their first approved
 * deposit, or their first game recharge if that happens first) decides a flat reward for the referrer —
 * $5 if it's under $10, $10 if it's $10 or more. Still only ever paid once per referee, via
 * grantReferralReward's unique-per-referee gate.
 */
export function computeReferralBonusAmount(qualifyingAmount: number): number {
  return qualifyingAmount < 10 ? 5 : 10;
}

// Extracted as a pure function so it's unit-testable on its own: a live database check is not possible for
// this specific signal, because UserProfile.phone carries a partial unique index (phone IS NOT NULL AND
// phone <> ''), so two different accounts can never actually hold the same verified phone number today. This
// check exists purely as defense-in-depth for any row that predates that constraint.
export function samePhoneSignal(phoneA: string | null | undefined, phoneB: string | null | undefined): boolean {
  return !!phoneA && !!phoneB && phoneA === phoneB
}

/** Same IP alone is deliberately not enough — see assessAbuseSignals. Also a pure, unit-testable function. */
export function sameIpWithinWindow(ipsA: string[], ipsB: string[], createdAtA: Date, createdAtB: Date, windowMs = 60 * 60 * 1000): boolean {
  const setA = new Set(ipsA.filter(Boolean))
  const sameIp = ipsB.some(ip => ip && setA.has(ip))
  if (!sameIp) return false
  return Math.abs(createdAtB.getTime() - createdAtA.getTime()) < windowMs
}

export class ReferralService {
  /**
   * The single, idempotent gate every referral-reward trigger goes through. `refereeId` is unique on
   * ReferralReward, so no matter which trigger fires first — the referee's first approved deposit
   * (processFirstDepositBonus) or their first game recharge (providerController.transferFunds) — only one
   * reward row can ever exist for that referee, and every later attempt (a retry, a webhook replay, the
   * OTHER trigger firing afterwards, two concurrent requests) is a guaranteed no-op rather than a double
   * payment. The DB unique constraint itself is what makes this atomic: there is no read-then-write race,
   * because the insert either succeeds once or fails with P2002 for everyone else.
   */
  static async grantReferralReward(opts: {
    referrerId: string
    refereeId: string
    amount: number
    triggerSource: 'first_deposit' | 'first_recharge'
    triggerDepositId?: string
  }): Promise<{ granted: boolean; flagged: boolean }> {
    const { referrerId, refereeId, triggerSource, triggerDepositId } = opts
    const amount = Math.round(Math.min(MAX_REFERRAL_BONUS, Math.max(0, opts.amount)) * 100) / 100

    // Self-referral is not reachable today (referredById is set once, at registration, from a code that must
    // already belong to an existing account — a user cannot know their own code before their account and
    // that code exist), but this is cheap insurance against any future path that could set it otherwise.
    if (referrerId === refereeId) {
      logger.warn(`[ReferralService] Ignored a self-referral reward attempt for user ${referrerId}`)
      return { granted: false, flagged: false }
    }
    if (amount <= 0) return { granted: false, flagged: false }

    const abuse = await this.assessAbuseSignals(referrerId, refereeId)

    try {
      // The ReferralReward create and the Bonus Balance grant happen in the SAME transaction, so a grant can
      // never be orphaned relative to the reward row that caused it — if either write fails, both roll back.
      const reward = await prisma.$transaction(async (tx) => {
        const r = await tx.referralReward.create({
          data: {
            referrerId,
            refereeId,
            amount,
            triggerSource,
            triggerDepositId,
            status: abuse.flag ? 'flagged' : 'paid',
            flagReason: abuse.flag ? abuse.reason : null,
          },
        })
        // Flagged rewards do not grant Bonus Balance until/unless a staff review approves them — there is no
        // existing "approve a flagged referral" flow yet, so a flagged reward simply never grants today.
        if (!abuse.flag) {
          await BonusLedgerService.grantUserBonusTx(tx, {
            userId: referrerId,
            sourceType: 'REFERRAL_BONUS',
            amount,
            referenceId: r.id,
          })
        }
        return r
      })

      if (abuse.flag) {
        // Never expose the signal itself to either account — this is staff-only information. This fires from
        // background flows (deposit approval, game recharge) with no HTTP request in scope, so it goes
        // through the plain logger (still grep-able as [SECURITY]) rather than the request-scoped securityLog.
        logger.warn(`[SECURITY] referral_reward_flagged ${JSON.stringify({ referralRewardId: reward.id, referrerId, refereeId, reason: abuse.reason })}`)
        return { granted: false, flagged: true }
      }

      invalidateWalletCache(referrerId)
      logger.info(`[ReferralService] Awarded $${amount} referral bonus to user ${referrerId} for user ${refereeId}'s ${triggerSource === 'first_deposit' ? 'first deposit' : 'first recharge'}.`)
      return { granted: true, flagged: false }
    } catch (error: any) {
      if (error?.code === 'P2002') {
        // A reward for this referee already exists (paid, flagged, or rejected) — this is the expected,
        // correct outcome for a retry, a duplicate webhook delivery, a concurrent request, or the OTHER
        // trigger path firing after this one already succeeded. Not an error.
        return { granted: false, flagged: false }
      }
      logger.error('[ReferralService] Error granting referral reward:', error)
      return { granted: false, flagged: false }
    }
  }

  /**
   * Conservative, deliberately narrow heuristics — a starting point, not a full fraud-scoring system.
   * Same IP ALONE is never sufficient (families, offices, campuses, carriers and VPNs legitimately share
   * addresses), so it only contributes when paired with a second, independent signal. Same verified phone is
   * treated as strong on its own; in practice this should rarely trigger at all, since phone verification is
   * already enforced to be unique across accounts (see authController.verifyPhoneOTP), so it mainly guards
   * legacy rows from before that rule existed.
   */
  private static async assessAbuseSignals(referrerId: string, refereeId: string): Promise<{ flag: boolean; reason: string }> {
    const [referrer, referee] = await Promise.all([
      prisma.user.findUnique({ where: { id: referrerId }, select: { createdAt: true, profile: { select: { phone: true } } } }),
      prisma.user.findUnique({ where: { id: refereeId }, select: { createdAt: true, profile: { select: { phone: true } } } }),
    ])
    if (!referrer || !referee) return { flag: false, reason: '' }

    if (samePhoneSignal(referrer.profile?.phone, referee.profile?.phone)) {
      return { flag: true, reason: 'same_verified_phone' }
    }

    const [referrerIps, refereeIps] = await Promise.all([
      prisma.activityLog.findMany({ where: { userId: referrerId, action: { in: ['register', 'login'] } }, select: { ip: true }, take: 20 }),
      prisma.activityLog.findMany({ where: { userId: refereeId, action: { in: ['register', 'login'] } }, select: { ip: true }, take: 20 }),
    ])
    // Shared IP plus the accounts being created close together in time is a materially stronger pattern than
    // either signal alone — real referrals between people who share a network are not usually made within
    // minutes of each other, whereas one person opening two accounts back-to-back typically is. Same IP by
    // itself is never sufficient (families, offices, campuses, carriers, VPNs legitimately share addresses).
    if (sameIpWithinWindow(referrerIps.map(r => r.ip), refereeIps.map(r => r.ip), referrer.createdAt, referee.createdAt)) {
      return { flag: true, reason: 'same_ip_and_accounts_created_within_1h' }
    }

    return { flag: false, reason: '' }
  }

  /**
   * Processes a referral bonus if this is the user's FIRST approved deposit. Gives the referrer a flat $5 or
   * $10 depending on the deposit amount — see computeReferralBonusAmount. Safe to call more than once for
   * the same deposit (e.g. a retried webhook) — grantReferralReward is the idempotency boundary.
   */
  static async processFirstDepositBonus(userId: string, depositAmount: number, depositId?: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });
      if (!user || !user.referredById) return; // User was not referred by anyone

      // First-approved-deposit check (unchanged from the original logic)
      const approvedDepositsCount = await prisma.deposit.count({ where: { userId, status: 'approved' } });
      if (approvedDepositsCount > 1) return; // Not their first deposit

      const bonusAmount = computeReferralBonusAmount(depositAmount);
      await this.grantReferralReward({
        referrerId: user.referredById,
        refereeId: userId,
        amount: bonusAmount,
        triggerSource: 'first_deposit',
        triggerDepositId: depositId,
      });
    } catch (error) {
      logger.error('[ReferralService] Error processing referral bonus:', error);
    }
  }

  /** Lifetime PAID referral earnings (both the legacy BonusClaim rows and the new ReferralReward ledger). */
  static async getTotalEarnings(userId: string): Promise<number> {
    const [legacy, current] = await Promise.all([
      prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'referral' } }, _sum: { amount: true } }),
      prisma.referralReward.aggregate({ where: { referrerId: userId, status: 'paid' }, _sum: { amount: true } }),
    ])
    return (legacy._sum.amount || 0) + (current._sum.amount || 0)
  }
}
