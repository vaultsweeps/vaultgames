import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Audit-trail writer for the WALLET side, mirroring BonusTransaction. Fire-and-forget (same reliability
 * posture as the existing ActivityLog/Notification writes) — WalletService's derived aggregate remains the
 * authoritative balance source; this table is for history/reporting only, never read back for a balance
 * computation.
 */
export function recordWalletTransaction(opts: {
  userId: string;
  type: string; // DEPOSIT | BONUS_CONVERSION | GAME_DEBIT | GAME_WIN | WITHDRAWAL_HOLD | WITHDRAWAL | WITHDRAWAL_REVERSAL | ADMIN_ADJUSTMENT
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  metadata?: Record<string, any>;
}): void {
  prisma.walletTransaction
    .create({
      data: {
        userId: opts.userId,
        type: opts.type,
        amount: Math.round(opts.amount * 100) / 100,
        balanceBefore: Math.round(opts.balanceBefore * 100) / 100,
        balanceAfter: Math.round(opts.balanceAfter * 100) / 100,
        referenceId: opts.referenceId,
        metadata: opts.metadata,
      },
    })
    .catch((err) => logger.error('[WalletTransactionService] Failed to record wallet transaction:', err));
}
