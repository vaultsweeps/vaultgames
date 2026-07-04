import prisma from '../lib/prisma';
import { createNotification } from './notificationService';

export class DepositService {
  /**
   * Processes a deposit approval and awards appropriate bonuses.
   * This is called by both manual admin approval and automatic payment gateways (like Zappay).
   */
  static async approveDeposit(depositId: string, approvedById?: string, notes?: string) {
    const deposit = await prisma.deposit.findUnique({ 
      where: { id: depositId }, 
      include: { user: true } 
    });
    
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status === 'approved') return deposit; // Already approved

    // 1. Mark deposit as approved
    const updatedDeposit = await prisma.deposit.update({
      where: { id: depositId },
      data: { 
        status: 'approved', 
        notes: notes || deposit.notes, 
        approvedBy: approvedById, 
        approvedAt: new Date() 
      }
    });

    // 2. Log transaction
    await prisma.transactionLog.create({
      data: { 
        type: 'deposit_approved', 
        entityId: deposit.id, 
        userId: deposit.userId, 
        amount: deposit.amount, 
        status: 'approved' 
      }
    });

    // 3. Notify User
    await createNotification(deposit.userId, {
      title: 'Deposit Approved! ✓',
      message: `Your deposit of $${deposit.amount} has been approved and is ready to use.`,
      type: 'success', 
      link: '/dashboard/deposits'
    });

    // 4. Calculate & Award Bonuses
    await this.awardDepositBonuses(deposit.userId, deposit.amount);

    return updatedDeposit;
  }

  /**
   * Calculates Welcome, Referral, and Regular Deposit bonuses based on the user's history.
   */
  private static async awardDepositBonuses(userId: string, amount: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Check if this is the first approved deposit for this user
    const previousDepositsCount = await prisma.deposit.count({
      where: { userId, status: 'approved' }
    });

    // Note: Since the current deposit is already marked 'approved' above, 
    // the count will be 1 if this is their first deposit.
    const isFirstDeposit = previousDepositsCount === 1;

    let bonusAmount = 0;

    if (isFirstDeposit && user.isVerified) {
      // 100% Signup Bonus
      bonusAmount = amount;
      const welcomeBonusDef = await prisma.bonus.findFirst({ where: { type: 'welcome' } });
      if (welcomeBonusDef) {
        await prisma.bonusClaim.create({ 
          data: { userId, bonusId: welcomeBonusDef.id, amount: bonusAmount } 
        });
        await createNotification(userId, {
          title: 'Welcome Bonus Received!',
          message: `You received a 100% match bonus of $${bonusAmount.toFixed(2)} for your first deposit!`,
          type: 'success',
          link: '/dashboard/bonuses'
        });
      }
      
      // Referral Bonus logic for the referrer
      if (user.referredById) {
        const refBonus = Math.min(amount * 0.5, 10);
        const refBonusDef = await prisma.bonus.findFirst({ where: { type: 'referral' } });
        if (refBonusDef) {
          await prisma.bonusClaim.create({ 
            data: { userId: user.referredById, bonusId: refBonusDef.id, amount: refBonus } 
          });
          await createNotification(user.referredById, {
            title: 'Referral Bonus Received!',
            message: `You just received $${refBonus.toFixed(2)} because your referred friend ${user.username} made their first deposit.`,
            type: 'success',
            link: '/dashboard/bonuses'
          });
        }
      }
    } else {
      // 30% Regular Bonus
      bonusAmount = amount * 0.3;
      const depositBonusDef = await prisma.bonus.findFirst({ where: { type: 'deposit' } });
      if (depositBonusDef) {
        await prisma.bonusClaim.create({ 
          data: { userId, bonusId: depositBonusDef.id, amount: bonusAmount } 
        });
        await createNotification(userId, {
          title: 'Deposit Bonus Received!',
          message: `You received a 30% bonus of $${bonusAmount.toFixed(2)} for your deposit!`,
          type: 'success',
          link: '/dashboard/bonuses'
        });
      }
    }
  }
}
