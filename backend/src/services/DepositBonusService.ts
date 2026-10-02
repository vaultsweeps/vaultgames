import prisma from '../lib/prisma'
import { logger } from '../utils/logger'
import { BonusLedgerService } from './BonusLedgerService'

/**
 * Grants a promotional deposit bonus (currently: the 20% crypto-deposit bonus) as its own ledger row, kept
 * entirely separate from Deposit.amount — which must always hold the real, confirmed deposit amount only.
 * Also grants the same amount into the new Bonus Balance ledger (sourceType CRYPTO_BONUS), in the SAME
 * transaction as the legacy DepositBonus row, so one can never exist without the other.
 *
 * Idempotent: DepositBonus.depositId is unique, so a repeated provider callback for the same deposit (retry,
 * duplicate webhook delivery, concurrent requests) hits that constraint on the second attempt and is a safe
 * no-op — nothing is credited twice. This is the same pattern as ReferralReward.refereeId.
 */
export async function grantDepositBonus(opts: {
  depositId: string
  userId: string
  amount: number
  type: string
}): Promise<boolean> {
  const amount = Math.round(opts.amount * 100) / 100
  if (amount <= 0) return false
  try {
    await prisma.$transaction(async (tx) => {
      const bonus = await tx.depositBonus.create({
        data: { depositId: opts.depositId, userId: opts.userId, amount, type: opts.type },
      })
      await BonusLedgerService.grantUserBonusTx(tx, {
        userId: opts.userId,
        sourceType: 'CRYPTO_BONUS',
        amount,
        referenceId: bonus.id,
      })
    })
    logger.info(`[DepositBonusService] Granted $${amount} (${opts.type}) for deposit ${opts.depositId}`)
    return true
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // A bonus for this deposit already exists — a retried callback or a concurrent request. Not an error.
      return false
    }
    logger.error('[DepositBonusService] Error granting deposit bonus:', error)
    return false
  }
}

/**
 * Reverses a deposit's bonus if the underlying deposit is later voided/reversed/refunded, so it stops
 * counting toward the user's balance — mirroring how the deposit itself is handled (see adminController's
 * void path). A deposit with no bonus row (non-crypto, or the bonus was never granted) is a no-op. Also
 * revokes whatever is still unspent of the linked Bonus Balance grant (already-spent money is not clawed back
 * retroactively — see BonusLedgerService.revokeUserBonusGrant).
 */
export async function reverseDepositBonus(depositId: string): Promise<void> {
  const reversedBonuses = await prisma.depositBonus.findMany({ where: { depositId, status: 'paid' } })
  if (reversedBonuses.length === 0) return

  await prisma.depositBonus.updateMany({
    where: { depositId, status: 'paid' },
    data: { status: 'reversed' },
  }).catch((e) => logger.error('[DepositBonusService] Error reversing deposit bonus:', e))

  for (const bonus of reversedBonuses) {
    const linkedUserBonus = await prisma.userBonus.findFirst({
      where: { referenceId: bonus.id, sourceType: 'CRYPTO_BONUS' },
    }).catch(() => null)
    if (linkedUserBonus) {
      await BonusLedgerService.revokeUserBonusGrant(linkedUserBonus.id, bonus.id)
        .catch((e) => logger.error('[DepositBonusService] Error revoking linked UserBonus grant:', e))
    }
  }
}

/** Lifetime PAID deposit-bonus total for a user (used by WalletService). */
export async function getTotalDepositBonus(userId: string, client: { depositBonus: { aggregate: typeof prisma.depositBonus.aggregate } } = prisma): Promise<number> {
  const r = await client.depositBonus.aggregate({ where: { userId, status: 'paid' }, _sum: { amount: true } })
  return r._sum.amount || 0
}
