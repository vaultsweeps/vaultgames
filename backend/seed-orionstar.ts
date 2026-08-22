import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.provider.findFirst({
    where: { name: 'orionstar', agentId: 'VegasO01' }
  });

  let provider;
  if (existing) {
    provider = await prisma.provider.update({
      where: { id: existing.id },
      data: {
        secretKey: '***REDACTED***',
        apiBaseUrl: 'https://orionstars.vip:8033',
        endpoints: {
          servicePath: '/ws/service.ashx'
        },
        status: true,
      }
    });
    console.log('Successfully updated Orionstar provider:', provider);
  } else {
    provider = await prisma.provider.create({
      data: {
        name: 'orionstar',
        agentId: 'VegasO01',
        secretKey: '***REDACTED***',
        apiBaseUrl: 'https://orionstars.vip:8033',
        endpoints: {
          servicePath: '/ws/service.ashx'
        },
        status: true,
      }
    });
    console.log('Successfully created Orionstar provider:', provider);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding provider:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
