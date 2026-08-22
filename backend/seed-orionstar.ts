import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const provider = await prisma.provider.upsert({
    where: { name: 'orionstar' },
    update: {
      name: 'orionstar',
      agentId: 'VegasO01',
      secretKey: '***REDACTED***',
      apiBaseUrl: 'https://orionstars.vip:8033',
      endpoints: {
        servicePath: '/ws/service.aspx'
      },
      isActive: true,
    },
    create: {
      name: 'orionstar',
      agentId: 'VegasO01',
      secretKey: '***REDACTED***',
      apiBaseUrl: 'https://orionstars.vip:8033',
      endpoints: {
        servicePath: '/ws/service.aspx'
      },
      isActive: true,
    }
  });
  console.log('Successfully seeded Orionstar provider:', provider);
}

main()
  .catch((e) => {
    console.error('Error seeding provider:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
