import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { invalidateWalletCache } from '../services/WalletService';

// Wheel configuration
const WHEEL_PRIZES = [
  { id: '1', type: 'cash', value: 1.5, label: '$1.50 Cash', weight: 300, color: '#0ea5e9' }, // 30%
  { id: '2', type: 'cash', value: 2.5, label: '$2.50 Cash', weight: 250, color: '#0284c7' }, // 25%
  { id: '3', type: 'cash', value: 3.5, label: '$3.50 Cash', weight: 150, color: '#0ea5e9' }, // 15%
  { id: '4', type: 'percentage', value: 0.15, label: '15% Bonus', weight: 100, color: '#0284c7' }, // 10%
  { id: '5', type: 'cash', value: 5.0, label: '$5.00 Cash', weight: 80, color: '#0ea5e9' }, // 8%
  { id: '6', type: 'percentage', value: 0.25, label: '25% Bonus', weight: 50, color: '#0284c7' }, // 5%
  { id: '7', type: 'cash', value: 7.0, label: '$7.00 Cash', weight: 40, color: '#0ea5e9' }, // 4%
  { id: '8', type: 'cash', value: 10.0, label: '$10.00 Cash', weight: 20, color: '#0284c7' }, // 2%
  { id: '9', type: 'percentage', value: 0.50, label: '50% Bonus', weight: 10, color: '#0ea5e9' }, // 1%
];

// Helper to check eligibility
async function checkEligibility(userId: string) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Check last spin
  const lastSpin = await prisma.bonusClaim.findFirst({
    where: {
      userId,
      bonus: { type: 'wheel' },
      createdAt: { gte: fortyEightHoursAgo }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Check deposits in last 24h
  const recentDeposits = await prisma.deposit.aggregate({
    where: {
      userId,
      status: 'approved',
      createdAt: { gte: twentyFourHoursAgo }
    },
    _sum: { amount: true }
  });

  const depositTotal = recentDeposits._sum.amount || 0;
  const hasMetDepositGoal = depositTotal >= 50;
  const canSpin = !lastSpin && hasMetDepositGoal;

  let nextSpinTime = null;
  if (lastSpin) {
    nextSpinTime = new Date(lastSpin.createdAt.getTime() + 48 * 60 * 60 * 1000);
  }

  return {
    canSpin,
    depositTotal,
    hasMetDepositGoal,
    nextSpinTime,
    lastSpinAt: lastSpin?.createdAt || null
  };
}

export const getWheelStatus = async (req: AuthRequest, res: Response) => {
  const status = await checkEligibility(req.user!.id);
  res.json({ success: true, data: { ...status, prizes: WHEEL_PRIZES } });
};

export const spinWheel = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const status = await checkEligibility(userId);
  if (!status.canSpin) {
    if (!status.hasMetDepositGoal) {
      throw new AppError('You must deposit at least $50 within the last 24 hours to spin the wheel.', 403);
    }
    if (status.nextSpinTime) {
      throw new AppError(`You can spin the wheel again on ${status.nextSpinTime.toLocaleString()}`, 403);
    }
    throw new AppError('You are not eligible to spin the wheel yet.', 403);
  }

  // Calculate prize using weighted random
  const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedPrize = WHEEL_PRIZES[0];

  for (const prize of WHEEL_PRIZES) {
    random -= prize.weight;
    if (random <= 0) {
      selectedPrize = prize;
      break;
    }
  }

  // Calculate amount to award
  let awardedAmount = 0;
  if (selectedPrize.type === 'cash') {
    awardedAmount = selectedPrize.value;
  } else if (selectedPrize.type === 'percentage') {
    // Percentage of last 24h deposits
    awardedAmount = parseFloat((status.depositTotal * selectedPrize.value).toFixed(2));
  }

  // Find or create wheel bonus
  let wheelBonus = await prisma.bonus.findFirst({ where: { type: 'wheel' } });
  if (!wheelBonus) {
    wheelBonus = await prisma.bonus.create({
      data: {
        title: 'Wheel Spin Bonus',
        description: 'Bonus awarded from the Spin the Wheel feature',
        type: 'wheel',
        requirements: 'none',
        terms: 'Standard bonus terms apply.'
      }
    });
  }

  // Record the win
  const claim = await prisma.bonusClaim.create({
    data: {
      userId,
      bonusId: wheelBonus.id,
      amount: awardedAmount,
    }
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'wheel_spin_win',
      metadata: { prize: selectedPrize.label, amount: awardedAmount }
    }
  });

  // Invalidate wallet cache so the balance automatically updates
  invalidateWalletCache(userId);

  res.json({
    success: true,
    data: {
      prize: selectedPrize,
      awardedAmount,
      claimId: claim.id
    }
  });
};
