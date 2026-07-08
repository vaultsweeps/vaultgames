import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update Chime for deposits
  await prisma.paymentMethod.upsert({
    where: { code: 'chime' },
    update: {
      name: 'Chime',
      type: 'bank',
      instructions: 'Send money to $Luis-Feliciano-114 via Chime. Please enter your Chime name so we can verify your payment.',
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png',
      fields: [
        {
          name: "accountInfo",
          label: "Your Chime Name / Handle",
          type: "text",
          required: true,
          placeholder: "e.g. Susan Grady Baranich or $susan-lucksy"
        }
      ],
      isActive: true,
      cashoutEnabled: true,
    },
    create: {
      name: 'Chime',
      code: 'chime',
      type: 'bank',
      instructions: 'Send money to $Luis-Feliciano-114 via Chime. Please enter your Chime name so we can verify your payment.',
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png',
      fields: [
        {
          name: "accountInfo",
          label: "Your Chime Name / Handle",
          type: "text",
          required: true,
          placeholder: "e.g. Susan Grady Baranich or $susan-lucksy"
        }
      ],
      isActive: true,
      cashoutEnabled: true,
      minAmount: 10,
      maxAmount: 10000,
    }
  });

  // Add PayPal
  await prisma.paymentMethod.upsert({
    where: { code: 'paypal' },
    update: {
      name: 'PayPal',
      type: 'bank',
      instructions: 'Scan the QR code and send money to Luis Feliciano via PayPal. Please enter your exact PayPal sender name to verify your payment.',
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
      fields: [
        {
          name: "accountInfo",
          label: "Your PayPal Name",
          type: "text",
          required: true,
          placeholder: "e.g. Chad M."
        }
      ],
      isActive: true,
      cashoutEnabled: true,
    },
    create: {
      name: 'PayPal',
      code: 'paypal',
      type: 'bank',
      instructions: 'Scan the QR code and send money to Luis Feliciano via PayPal. Please enter your exact PayPal sender name to verify your payment.',
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
      fields: [
        {
          name: "accountInfo",
          label: "Your PayPal Name",
          type: "text",
          required: true,
          placeholder: "e.g. Chad M."
        }
      ],
      isActive: true,
      cashoutEnabled: true,
      minAmount: 10,
      maxAmount: 10000,
    }
  });

  console.log("Payment methods updated successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
