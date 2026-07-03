import { PrismaClient, BonusType } from '@prisma/client';

const prisma = new PrismaClient();

async function updateBonuses() {
  console.log('Clearing old bonuses...');
  await prisma.bonusClaim.deleteMany(); // Clear old claims just in case they conflict
  await prisma.bonus.deleteMany();

  console.log('Inserting new automated bonuses...');
  
  await prisma.bonus.createMany({
    data: [
      {
        title: '100% Verified Signup Bonus',
        description: 'Get a massive 100% bonus added to your very first game transfer after verifying your email. One-time only.',
        type: BonusType.welcome,
        percentage: 100,
        amount: null,
        maxBonus: 500,
        minDeposit: 1,
        requirements: 'Email verification required. Applies to your first game balance transfer.',
        terms: 'Bonus funds are added directly to your game balance. Standard playthrough requirements apply.',
        isActive: true,
      },
      {
        title: '30% Regular Recharge Bonus',
        description: 'Enjoy an automatic 30% bonus every time you transfer funds to your game balance!',
        type: BonusType.deposit,
        percentage: 30,
        amount: null,
        maxBonus: 1000,
        minDeposit: 1,
        requirements: 'Applies automatically to all game transfers (except your first verified transfer).',
        terms: 'Bonus funds are added directly to your game balance. Unlimited claims.',
        isActive: true,
      },
      {
        title: '50% Referral Bonus',
        description: 'Earn 50% of your referred friend\'s first game transfer, added directly to your wallet!',
        type: BonusType.referral,
        percentage: 50,
        amount: null,
        maxBonus: 10,
        minDeposit: 1,
        requirements: 'Your friend must sign up using your referral link and make their first game transfer.',
        terms: 'Maximum $10 bonus per referral. Funds are added to your main wallet balance.',
        isActive: true,
      }
    ]
  });

  console.log('Successfully updated the bonus catalog!');
  process.exit(0);
}

updateBonuses().catch(console.error);
