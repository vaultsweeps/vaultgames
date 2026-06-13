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

  // Create test user
  const userPassword = await bcrypt.hash('User@123456', 12)
  const testUser = await prisma.user.upsert({
    where: { email: 'player@nexusgaming.com' },
    update: {},
    create: {
      username: 'testplayer',
      email: 'player@nexusgaming.com',
      password: userPassword,
      role: 'user',
      isVerified: true,
      isActive: true,
      profile: { create: { fullName: 'Test Player', country: 'US' } }
    }
  })
  console.log('✅ Test user created:', testUser.email)

  // Payment methods
  await prisma.paymentMethod.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Bitcoin', code: 'BTC', type: 'crypto', minAmount: 10, maxAmount: 100000, instructions: 'Send BTC to the provided wallet address. Minimum 1 confirmation required.', fields: JSON.stringify([{ name: 'address', label: 'BTC Wallet Address', type: 'text', required: true }]) },
      { name: 'USDT (TRC20)', code: 'USDT_TRC20', type: 'crypto', minAmount: 10, maxAmount: 500000, instructions: 'Send USDT on TRON network to the provided address.', fields: JSON.stringify([{ name: 'address', label: 'USDT Address (TRC20)', type: 'text', required: true }]) },
      { name: 'Ethereum', code: 'ETH', type: 'crypto', minAmount: 20, maxAmount: 200000, instructions: 'Send ETH to the provided wallet address.', fields: JSON.stringify([{ name: 'address', label: 'ETH Wallet Address', type: 'text', required: true }]) },
      { name: 'Bank Transfer', code: 'BANK', type: 'bank', minAmount: 50, maxAmount: 1000000, instructions: 'Transfer to our bank account. Include your username as reference.', fields: JSON.stringify([{ name: 'bank_name', label: 'Bank Name', type: 'text', required: true }, { name: 'account_number', label: 'Account Number', type: 'text', required: true }, { name: 'account_name', label: 'Account Name', type: 'text', required: true }]) },
      { name: 'Credit / Debit Card', code: 'CARD', type: 'card', minAmount: 20, maxAmount: 50000, feePercent: 2.5, instructions: 'Pay securely via card payment gateway.', fields: JSON.stringify([]) },
      { name: 'E-Wallet', code: 'EWALLET', type: 'wallet', minAmount: 10, maxAmount: 20000, instructions: 'Pay via e-wallet. Send to our account below.', fields: JSON.stringify([{ name: 'wallet_id', label: 'Your Wallet ID/Email', type: 'text', required: true }]) },
    ]
  })
  console.log('✅ Payment methods created')

  // Sample games
  await prisma.game.createMany({
    skipDuplicates: true,
    data: [
      { name: 'CyberStrike Elite', description: 'Ultimate cyber warfare FPS with stunning 4K graphics, 50+ weapons, and global multiplayer.', category: 'Action', version: '3.2.1', downloadCount: 125000, rating: 4.8, isFeatured: true, requirements: 'Windows 10/11, 8GB RAM, GTX 1060', instructions: 'Download ZIP, extract, run Setup.exe as Administrator.', downloadUrl: 'https://example.com/games/cyberstrike-elite.zip' },
      { name: 'Galaxy Raiders', description: 'Command star fleets across the galaxy in epic real-time strategy battles with 200+ missions.', category: 'Strategy', version: '2.1.0', downloadCount: 89000, rating: 4.6, isFeatured: true, requirements: 'Windows 10, 4GB RAM, GTX 960', instructions: 'Run installer, follow setup wizard.', downloadUrl: 'https://example.com/games/galaxy-raiders.zip' },
      { name: 'NeonRacer X', description: 'Hyper-speed neon racing through 60+ futuristic tracks with customizable vehicles.', category: 'Racing', version: '1.5.3', downloadCount: 203000, rating: 4.9, isFeatured: false, requirements: 'Windows 10/11, 8GB RAM, GTX 1070', instructions: 'Download and run installer.', downloadUrl: 'https://example.com/games/neonracer-x.zip' },
      { name: 'Shadow Protocol', description: 'Tactical stealth game with 30+ missions across enemy territories.', category: 'Stealth', version: '4.0.0', downloadCount: 67000, rating: 4.7, isFeatured: true, requirements: 'Windows 10, 6GB RAM, GTX 1060', instructions: 'Extract ZIP, run Launcher.exe.', downloadUrl: 'https://example.com/games/shadow-protocol.zip' },
      { name: 'Dragon Quest Online', description: 'Massive online RPG with 1000+ quests, 50+ dungeons, and a thriving global community.', category: 'RPG', version: '5.1.2', downloadCount: 312000, rating: 4.9, isFeatured: true, requirements: 'Windows 10/11, 16GB RAM, RTX 2060', instructions: 'Download launcher, it will auto-install the game client.', downloadUrl: 'https://example.com/games/dqo-launcher.exe' },
    ]
  })
  console.log('✅ Sample games created')

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

  // Hero banners
  await prisma.banner.createMany({
    skipDuplicates: true,
    data: [
      { title: 'ENTER THE NEXUS', subtitle: 'The Ultimate Gaming Universe', imageUrl: '/banners/banner1.jpg', ctaText: 'PLAY NOW', ctaLink: '/games', order: 1, isActive: true },
      { title: 'CLAIM YOUR 500% BONUS', subtitle: 'Welcome Offer for New Players', imageUrl: '/banners/banner2.jpg', ctaText: 'CLAIM BONUS', ctaLink: '/register', order: 2, isActive: true },
      { title: 'INSTANT CASHOUT', subtitle: 'Fast & Secure Withdrawals', imageUrl: '/banners/banner3.jpg', ctaText: 'START EARNING', ctaLink: '/register', order: 3, isActive: true },
    ]
  })
  console.log('✅ Banners created')

  // FAQs
  await prisma.fAQ.createMany({
    skipDuplicates: true,
    data: [
      { question: 'How do I create an account?', answer: 'Click "Join Now", fill in your details, verify your email, and you\'re ready to play. Registration takes less than 2 minutes.', category: 'Account', order: 1 },
      { question: 'How do I make a deposit?', answer: 'Go to Dashboard > Deposits, select your payment method, enter the amount, and follow the payment instructions. Most deposits are processed instantly.', category: 'Deposits', order: 1 },
      { question: 'How long do withdrawals take?', answer: 'Withdrawals are reviewed within 1-24 hours. Crypto withdrawals are typically faster. Once approved, funds arrive based on your payment method.', category: 'Withdrawals', order: 1 },
      { question: 'How do I claim bonuses?', answer: 'Navigate to Dashboard > Bonuses to see all available promotions. Each bonus has clear terms and requirements. Click "Claim Bonus" to activate.', category: 'Bonuses', order: 1 },
      { question: 'Are my funds safe?', answer: 'Yes. We use bank-grade SSL encryption, secure payment gateways, and multi-layer security to protect your account and funds at all times.', category: 'Security', order: 1 },
      { question: 'What payment methods are supported?', answer: 'We accept Bitcoin, USDT, Ethereum, credit/debit cards, bank transfers, and e-wallets. Available methods may vary by region.', category: 'Payments', order: 1 },
    ]
  })
  console.log('✅ FAQs created')

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
