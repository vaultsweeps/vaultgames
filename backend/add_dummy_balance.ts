import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' }
  })

  if (!user) {
    console.log('No user found to add balance to.')
    return
  }

  // Create a dummy approved deposit
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      amount: 500,
      status: 'approved',
      paymentReference: `DUMMY_DEP_${Date.now()}`,
      notes: 'Added for testing cashout flow'
    }
  })

  console.log(`✅ Successfully added $500 dummy balance to user: ${user.username} (${user.email})`)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
