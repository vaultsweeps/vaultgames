import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexusgaming.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@nexusgaming.com',
      password: adminPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
      profile: { create: { fullName: 'Platform Administrator' } }
    }
  })
  console.log('✅ Admin user created:', admin.email)

  // Bonuses
  await prisma.bonus.createMany({
    skipDuplicates: true,
    data: [
      { title: 'Welcome Bonus', description: 'Get 500% on your very first deposit. Maximum bonus up to $5,000.', type: 'welcome', percentage: 500, minDeposit: 10, maxBonus: 5000, requirements: 'Make your first deposit of minimum $10 to activate this bonus.', terms: 'Wagering requirement: 30x. Valid for first deposit only. Cannot be combined with other offers. Maximum withdrawal from bonus funds: $10,000.', isActive: true },
      { title: 'Weekly Reload Bonus', description: 'Reload every week and get 100% bonus up to $1,000 to keep the fun going!', type: 'deposit', percentage: 100, minDeposit: 20, maxBonus: 1000, requirements: 'Available every Monday for active players. Deposit minimum $20.', terms: 'Wagering requirement: 25x. Expires 7 days after activation.', isActive: true },
      { title: 'Referral Bonus', description: 'Earn $50 cash for every friend you refer who makes their first deposit.', type: 'referral', amount: 50, requirements: 'Share your referral link. Bonus credited when referred friend makes first deposit of $20+.', terms: 'No wagering requirement on referral bonuses. Credited within 24 hours. No limit on referrals.', isActive: true },
      { title: 'VIP Program', description: 'Exclusive personalized bonuses, dedicated account manager, and priority withdrawals.', type: 'vip', requirements: 'VIP status is by invitation only. Contact support to learn more.', terms: 'VIP bonuses are personalized per player. Contact your dedicated VIP manager for details.', isActive: true },
    ]
  })
  console.log('✅ Bonuses created')

  // Default settings
  await prisma.setting.createMany({
    skipDuplicates: true,
    data: [
      { key: 'site_name', value: 'NexusGaming', type: 'string', group: 'general' },
      { key: 'site_description', value: 'The Ultimate Gaming Platform', type: 'string', group: 'general' },
      { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'general' },
      { key: 'min_deposit', value: '10', type: 'number', group: 'payments' },
      { key: 'min_withdrawal', value: '20', type: 'number', group: 'payments' },
      { key: 'telegram_url', value: 'https://t.me/nexusgaming', type: 'string', group: 'social' },
      { key: 'facebook_url', value: 'https://m.me/nexusgaming', type: 'string', group: 'social' },
    ]
  })
  console.log('✅ Default settings created')

  console.log('\n🎮 Database seeded successfully!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Admin:  admin@nexusgaming.com / Admin@123456')
  console.log('Player: player@nexusgaming.com / User@123456')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
