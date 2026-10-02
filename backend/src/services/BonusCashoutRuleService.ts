import prisma from '../lib/prisma';
import { BonusCashoutRule } from '@prisma/client';

export class BonusCashoutRuleService {
  /**
   * Finds the active rule that applies to a swept amount + the set of bonus sourceTypes that funded the
   * session. A rule's `sourceTypes` being empty, or containing 'ALL', means it applies to every source type;
   * otherwise at least one of the session's source types must be listed on the rule. Among matches, highest
   * `priority` wins; ties broken by the newest rule.
   */
  static async findMatchingRule(
    amount: number,
    sessionSourceTypes: string[],
  ): Promise<BonusCashoutRule | null> {
    const candidates = await prisma.bonusCashoutRule.findMany({
      where: {
        isActive: true,
        minAmount: { lte: amount },
        maxAmount: { gte: amount },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return (
      candidates.find(
        (rule) =>
          rule.sourceTypes.length === 0 ||
          rule.sourceTypes.includes('ALL') ||
          rule.sourceTypes.some((st) => sessionSourceTypes.includes(st)),
      ) ?? null
    );
  }

  /**
   * How much of a bonus-funded session's total winnings converts to Wallet Balance. $0 if no rule matched —
   * the entire amount is then forfeited (never credited anywhere), surfaced to the caller separately from
   * the existing over-cap "voided" concept so the two are never confused.
   */
  static computeEligibleWalletCredit(totalWinnings: number, rule: BonusCashoutRule | null): number {
    if (!rule) return 0;
    const credit = Math.min(rule.walletCreditAmount, totalWinnings);
    return Math.round(Math.max(0, credit) * 100) / 100;
  }
}
