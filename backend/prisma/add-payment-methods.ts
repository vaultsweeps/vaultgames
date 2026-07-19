import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Apple Pay and Debit Card payment methods...')

  // Upsert Apple Pay
  await prisma.paymentMethod.upsert({
    where: { code: 'apple' },
    update: {
      name: 'Apple Pay',
      isActive: true,
      cashoutEnabled: false,
    },
    create: {
      name: 'Apple Pay',
      code: 'apple',
      type: 'wallet',
      minAmount: 10,
      maxAmount: 10000,
      feePercent: 0,
      instructions: 'Send payment via the Zappay link below. After completing the transfer, enter your Apple Pay profile name.',
      isActive: true,
      cashoutEnabled: false,
    }
  })
  console.log('✅ Apple Pay upserted')

  // Upsert Debit Card
  await prisma.paymentMethod.upsert({
    where: { code: 'card' },
    update: {
      name: 'Debit Card',
      isActive: true,
      cashoutEnabled: false,
    },
    create: {
      name: 'Debit Card',
      code: 'card',
      type: 'card',
      minAmount: 10,
      maxAmount: 10000,
      feePercent: 0,
      instructions: 'Pay securely using your Debit Card via the Zappay link below.',
      isActive: true,
      cashoutEnabled: false,
    }
  })
  console.log('✅ Debit Card upserted')

  console.log('\n🎉 Done! Apple Pay and Debit Card are now active.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
