import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Removing dummy dataset from database...')

  // Delete test users (role = 'user' and email 'player@nexusgaming.com')
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: 'player@nexusgaming.com' }
  })
  console.log(`✅ Deleted ${deletedUsers.count} test users`)

  // Delete all games
  const deletedGames = await prisma.game.deleteMany({})
  console.log(`✅ Deleted ${deletedGames.count} games`)

  // Delete all banners
  const deletedBanners = await prisma.banner.deleteMany({})
  console.log(`✅ Deleted ${deletedBanners.count} banners`)

  // Delete all FAQs
  const deletedFAQs = await prisma.fAQ.deleteMany({})
  console.log(`✅ Deleted ${deletedFAQs.count} FAQs`)

  console.log('🎉 Dummy dataset removed successfully!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
