import prisma from '../lib/prisma';
import { getCached, invalidateCached } from '../lib/redis';

const WALLET_CACHE_TTL = 10; // 10 seconds

// Bonus Balance system cutover. Referral/freeplay/wheel/crypto-deposit-bonus grants made BEFORE this instant
// keep counting toward Wallet Balance forever, exactly as they do today — nothing is moved or backfilled, so
// no existing user's displayed balance ever changes. Grants from this instant onward go only into the new
// Bonus Balance ledger (UserBonus/BonusTransaction) and are excluded here via the `createdAt` filters below.
//
// MUST be set via the BONUS_BALANCE_CUTOVER_AT env var to the exact go-live instant of this deploy (the
// moment grantUserBonusTx becomes reachable in ReferralService/couponController/wheelController/
// DepositBonusService). Deliberately NOT computed as `new Date()` at module load: this is a long-running
// PM2-managed process that restarts routinely (crashes, routine deploys, `pm2 restart`), and a value that
// re-evaluates to "now" on every restart would silently creep forward forever, re-opening the double-count
// window below on every single restart rather than once.
//
// Getting this wrong is a real-money bug in BOTH directions, so there is no safe default — the env var must
// be set deliberately, once, at the moment this code actually goes live:
//   - Set LATER than actual go-live: any legacy-type grant (referral/freeplay/wheel/crypto-bonus) made in the
//     gap is double-counted — it lands in BOTH Wallet Balance (still under the cutover) AND Bonus Balance (the
//     new grantUserBonusTx hook, already live) — letting the same money be effectively spent twice.
//   - Set EARLIER than actual go-live (including the unset/far-future default below while the grant hooks are
//     already live): the double-counting above happens from the moment of deploy, not after a gap. Set too far
//     in the PAST relative to go-live instead and pre-existing historical bonus money for every user vanishes
//     from Wallet Balance instantly — the exact regression this whole cutover design exists to avoid.
// The default below is intentionally far-future (i.e. "nothing has cut over yet") rather than epoch-0, because
// an instant visible balance drop for every existing user is worse than a quieter double-count that only
// starts accruing once this is actually deployed — but it is NOT a safe value to deploy with. See the loud
// startup warning below.
export const BONUS_BALANCE_CUTOVER_AT = process.env.BONUS_BALANCE_CUTOVER_AT
  ? new Date(process.env.BONUS_BALANCE_CUTOVER_AT)
  : new Date('2099-01-01T00:00:00.000Z');

if (!process.env.BONUS_BALANCE_CUTOVER_AT) {
  // eslint-disable-next-line no-console
  console.warn(
    '[WalletService] BONUS_BALANCE_CUTOVER_AT is not set — the Bonus Balance system will double-count every ' +
    'new referral/freeplay/wheel/crypto-bonus grant into BOTH Wallet Balance and Bonus Balance. Set this env ' +
    'var to the exact deploy instant (e.g. the current UTC time) before/at the moment this code goes live.'
  );
}

export function invalidateWalletCache(userId: string) {
  // Fire and forget invalidations
  invalidateCached(`wallet_balances:${userId}`).catch(() => {});
  invalidateCached(`wallet_referral:${userId}`).catch(() => {});
  invalidateCached(`wallet_withdrawable:${userId}`).catch(() => {});
  invalidateCached(`wallet_display:${userId}`).catch(() => {});
}

export class WalletService {
  /**
   * Returns the total referral bonus balance earned by the user historically.
   */
  static async getHistoricalReferralBonus(userId: string): Promise<number> {
    const [legacy, current] = await Promise.all([
      prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'referral' } }, _sum: { amount: true } }),
      prisma.referralReward.aggregate({ where: { referrerId: userId, status: 'paid' }, _sum: { amount: true } }),
    ]);
    return (legacy._sum.amount || 0) + (current._sum.amount || 0);
  }

  /**
   * Returns the withdrawable (real cash) balance and display balance together.
   */
  static async getBalances(userId: string) {
    return getCached(`wallet_balances:${userId}`, async () => {
      // Run all aggregates in parallel for maximum speed
      const [deposits, withdrawals, gameRecharges, gameWithdrawals, referralBonuses, freeplayBonuses, wheelBonuses, referralRewards, wheelSpinWins, depositBonuses] = await Promise.all([
        prisma.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { userId, status: { in: ['pending', 'approved', 'paid'] } }, _sum: { amount: true } }),
        // Explicit `OR: [null, not 'BONUS']` rather than a bare `fundingSource: { not: 'BONUS' }` — SQL's
        // three-valued NULL logic means a plain `<> 'BONUS'` comparison does not necessarily match a NULL
        // column, and Prisma's own handling of `not` on a nullable field is not something to bet real money
        // on without being able to verify the generated SQL. Every pre-Bonus-Balance-system row has
        // fundingSource === null and MUST still be counted — wrongly excluding it would zero out every
        // existing user's recharge total and inflate their wallet balance the moment this ships.
        prisma.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: 'success', OR: [{ fundingSource: null }, { fundingSource: { not: 'BONUS' } }] }, _sum: { amount: true } }),
        prisma.providerTransaction.aggregate({ where: { userId, type: 'withdraw', status: 'success' }, _sum: { amount: true } }),
        // Legacy source (rows written before the ReferralReward/WheelSpin ledgers existed) — kept so past
        // balances never shift; new referral/wheel money is recorded only in the two ledgers below.
        // Cutover-filtered: see BONUS_BALANCE_CUTOVER_AT above.
        prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'referral' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
        prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'freeplay' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
        prisma.bonusClaim.aggregate({ where: { userId, bonus: { type: 'wheel' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
        prisma.referralReward.aggregate({ where: { referrerId: userId, status: 'paid', createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
        prisma.wheelSpin.aggregate({ where: { userId, isWin: true, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
        // FIN-6: the 20% crypto-deposit bonus, kept out of Deposit.amount — see DepositBonusService.
        prisma.depositBonus.aggregate({ where: { userId, status: 'paid', createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      ]);

      const totalDeposited = deposits._sum.amount || 0;
      const totalWithdrawn = withdrawals._sum.amount || 0;
      const totalGameRecharges = gameRecharges._sum.amount || 0;
      const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;
      const totalReferralBonus = (referralBonuses._sum.amount || 0) + (referralRewards._sum.amount || 0);
      const totalFreeplayBonus = freeplayBonuses._sum.amount || 0;
      const totalWheelBonus = (wheelBonuses._sum.amount || 0) + (wheelSpinWins._sum.amount || 0);
      const totalDepositBonus = depositBonuses._sum.amount || 0;

      const totalNonWithdrawable = totalReferralBonus + totalFreeplayBonus + totalWheelBonus + totalDepositBonus;

      // 1. Calculate the absolute total wallet balance mathematically
      const totalWalletBalance = totalDeposited + totalGameWithdrawals + totalNonWithdrawable - totalWithdrawn - totalGameRecharges;

      // Ensure it never technically drops below 0 due to floating point or weird manual edits
      const displayBalance = Math.max(0, totalWalletBalance);

      // 2. Calculate remaining referral bonus (assumes bonus is used LAST after real cash)
      const remainingBonus = Math.min(totalNonWithdrawable, displayBalance);

      // 3. The withdrawable cash is simply whatever is left over after reserving the remaining bonus
      const withdrawableBalance = Math.max(0, displayBalance - remainingBonus);

      return { displayBalance, withdrawableBalance, remainingBonus, totalDepositBonus };
    }, WALLET_CACHE_TTL);
  }

  /**
   * Same computation as getBalances, but bypasses the Redis cache and accepts
   * a Prisma transaction client so it can be called from inside a
   * Serializable transaction to get a race-safe read of the current balance
   * (used right before debiting funds, e.g. withdrawal creation).
   */
  static async getBalancesRaw(userId: string, client: Pick<typeof prisma, 'deposit' | 'withdrawal' | 'providerTransaction' | 'bonusClaim' | 'referralReward' | 'wheelSpin' | 'depositBonus'> = prisma) {
    const [deposits, withdrawals, gameRecharges, gameWithdrawals, referralBonuses, freeplayBonuses, wheelBonuses, referralRewards, wheelSpinWins, depositBonuses] = await Promise.all([
      client.deposit.aggregate({ where: { userId, status: 'approved' }, _sum: { amount: true } }),
      client.withdrawal.aggregate({ where: { userId, status: { in: ['pending', 'approved', 'paid'] } }, _sum: { amount: true } }),
      client.providerTransaction.aggregate({ where: { userId, type: 'recharge', status: 'success', OR: [{ fundingSource: null }, { fundingSource: { not: 'BONUS' } }] }, _sum: { amount: true } }),
      client.providerTransaction.aggregate({ where: { userId, type: 'withdraw', status: 'success' }, _sum: { amount: true } }),
      client.bonusClaim.aggregate({ where: { userId, bonus: { type: 'referral' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      client.bonusClaim.aggregate({ where: { userId, bonus: { type: 'freeplay' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      client.bonusClaim.aggregate({ where: { userId, bonus: { type: 'wheel' }, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      client.referralReward.aggregate({ where: { referrerId: userId, status: 'paid', createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      client.wheelSpin.aggregate({ where: { userId, isWin: true, createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
      client.depositBonus.aggregate({ where: { userId, status: 'paid', createdAt: { lt: BONUS_BALANCE_CUTOVER_AT } }, _sum: { amount: true } }),
    ]);

    const totalDeposited = deposits._sum.amount || 0;
    const totalWithdrawn = withdrawals._sum.amount || 0;
    const totalGameRecharges = gameRecharges._sum.amount || 0;
    const totalGameWithdrawals = gameWithdrawals._sum.amount || 0;
    const totalReferralBonus = (referralBonuses._sum.amount || 0) + (referralRewards._sum.amount || 0);
    const totalFreeplayBonus = freeplayBonuses._sum.amount || 0;
    const totalWheelBonus = (wheelBonuses._sum.amount || 0) + (wheelSpinWins._sum.amount || 0);
    const totalDepositBonus = depositBonuses._sum.amount || 0;

    const totalNonWithdrawable = totalReferralBonus + totalFreeplayBonus + totalWheelBonus + totalDepositBonus;

    const totalWalletBalance = totalDeposited + totalGameWithdrawals + totalNonWithdrawable - totalWithdrawn - totalGameRecharges;
    const displayBalance = Math.max(0, totalWalletBalance);
    const remainingBonus = Math.min(totalNonWithdrawable, displayBalance);
    const withdrawableBalance = Math.max(0, displayBalance - remainingBonus);

    return { displayBalance, withdrawableBalance, remainingBonus };
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
