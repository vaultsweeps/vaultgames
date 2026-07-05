import prisma from '../src/lib/prisma'

async function main() {
  // Update all bonuses to have minDeposit = 5
  const result = await prisma.bonus.updateMany({
    where: {},
    data: { minDeposit: 5 }
  })
  console.log(`Updated ${result.count} bonus(es) - minDeposit set to $5`)

  // List them for verification
  const bonuses = await prisma.bonus.findMany({ select: { id: true, title: true, minDeposit: true, percentage: true } })
  console.table(bonuses)
  
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
