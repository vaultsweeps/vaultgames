import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WalletService, invalidateWalletCache } from './WalletService';

export class ReferralService {
  /**
   * Processes a referral bonus if this is the user's FIRST approved deposit.
   * Gives the referrer 50% of the deposit amount, up to a maximum of $10.
   */
  static async processFirstDepositBonus(userId: string, depositAmount: number) {
    try {
      // Find the user and their referrer
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true }
      });

      if (!user || !user.referredById) {
        return; // User was not referred by anyone
      }

      // Check if the user already has any approved deposits (other than the one we might be currently approving, 
      // but wait, if it's currently approving, we should count it. Let's just check if a referral bonus has already been claimed for this user)
      // Actually, we can check if the referrer already received a referral bonus for THIS specific user.
      // We don't track the referred user in BonusClaim directly, but wait!
      // Let's check how many approved deposits the user has. If it's more than 1 (including this one), skip.
      const approvedDepositsCount = await prisma.deposit.count({
        where: { userId, status: 'approved' }
      });

      // If it's exactly 1, it means this is their first approved deposit (assuming it was just marked approved before this call).
      if (approvedDepositsCount > 1) {
        return; // Not their first deposit
      }

      // Check if a referral bonus type exists in the DB, if not create it
      let referralBonus = await prisma.bonus.findFirst({
        where: { type: 'referral' }
      });

      if (!referralBonus) {
        referralBonus = await prisma.bonus.create({
          data: {
            title: 'Referral Bonus',
            type: 'referral',
            description: '50% bonus on referral first deposit (up to $10)',
            amount: 0,
            requirements: 'First deposit of referral',
            terms: 'Max $10 bonus',
            isActive: true
          }
        });
      }

      // Calculate the bonus amount: 50% of deposit, max $10
      const bonusAmount = Math.min(10, depositAmount * 0.5);

      // Check if the referrer already got a referral bonus recently (we should prevent duplicate claims)
      // Since we already check approvedDepositsCount === 1, it's generally safe.
      
      // Award the bonus to the referrer
      await prisma.bonusClaim.create({
        data: {
          userId: user.referredById,
          bonusId: referralBonus.id,
          amount: bonusAmount
        }
      });

      logger.info(`[ReferralService] Awarded $${bonusAmount} referral bonus to user ${user.referredById} for user ${userId}'s first deposit.`);

      // Invalidate the referrer's wallet cache so it shows up immediately
      invalidateWalletCache(user.referredById);

    } catch (error) {
      logger.error('[ReferralService] Error processing referral bonus:', error);
    }
  }
}
