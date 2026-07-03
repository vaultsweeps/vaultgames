import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing old payment methods...')
  await prisma.paymentMethod.deleteMany({})

  console.log('Adding Cash App, Chime, and Crypto...')

  await prisma.paymentMethod.create({
    data: {
      name: 'Cash App',
      code: 'cashapp',
      type: 'bank',
      isActive: true,
      minAmount: 10,
      maxAmount: 10000,
      feePercent: 0,
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Square_Cash_app_logo.svg/1200px-Square_Cash_app_logo.svg.png',
      instructions: 'Send to our $Cashtag. Include your username in the note.',
      fields: JSON.stringify([
        { name: 'accountInfo', label: '$Cashtag', type: 'text', required: true, placeholder: '$yourcashtag' }
      ])
    }
  })

  await prisma.paymentMethod.create({
    data: {
      name: 'Chime',
      code: 'chime',
      type: 'bank',
      isActive: true,
      minAmount: 10,
      maxAmount: 10000,
      feePercent: 0,
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png',
      instructions: 'Enter your Chime email or phone number for receiving funds.',
      fields: JSON.stringify([
        { name: 'accountInfo', label: 'Chime Email or Phone', type: 'text', required: true, placeholder: 'email@example.com or +1...' }
      ])
    }
  })

  await prisma.paymentMethod.create({
    data: {
      name: 'Crypto (USDT / BTC)',
      code: 'crypto',
      type: 'crypto',
      isActive: true,
      minAmount: 10,
      maxAmount: 50000,
      feePercent: 0,
      iconUrl: '',
      instructions: 'Provide your crypto wallet address. We support USDT (TRC20) and Bitcoin (BTC).',
      fields: JSON.stringify([
        { name: 'coin', label: 'Select Coin', type: 'select', required: true, options: ['USDT (TRC20)', 'Bitcoin (BTC)'] },
        { name: 'accountInfo', label: 'Wallet Address', type: 'text', required: true, placeholder: 'Your wallet address...' }
      ])
    }
  })

  await prisma.paymentMethod.create({
    data: {
      name: 'Zappay',
      code: 'zappay',
      type: 'bank',
      isActive: true,
      minAmount: 1,
      maxAmount: 10000,
      feePercent: 0,
      iconUrl: '',
      instructions: 'Deposit via Zappay',
      fields: JSON.stringify([
        { name: 'accountInfo', label: 'Zappay Profile Name', type: 'text', required: true, placeholder: 'Your Profile Name' }
      ])
    }
  })

  console.log('Payment methods updated successfully!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
