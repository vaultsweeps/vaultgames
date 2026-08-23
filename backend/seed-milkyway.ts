/**
 * Seed script: Add MilkyWay provider to the database.
 * Usage (from backend/):  npx ts-node seed-milkyway.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.provider.findFirst({
    where: { name: { contains: 'milkyway', mode: 'insensitive' } },
  });

  if (existing) {
    console.log(`MilkyWay provider already exists (id=${existing.id}). Updating credentials...`);
    await prisma.provider.update({
      where: { id: existing.id },
      data: {
        agentId:    'Vault854',
        secretKey:  'Vault123',
        apiBaseUrl: 'https://milkywayapp.xyz:8033',
        endpoints: {
          servicePath: '/ws/service.ashx',
        },
        status:         false,
        requestTimeout: 10000,
        updatedAt:      new Date(),
      },
    });
    console.log('✅ MilkyWay provider updated.');
    return;
  }

  const provider = await prisma.provider.create({
    data: {
      name:       'MilkyWay',
      agentId:    'Vault854',
      secretKey:  'Vault123',
      apiBaseUrl: 'https://milkywayapp.xyz:8033',
      endpoints: {
        servicePath: '/ws/service.ashx',
      },
      status:         false,   // set to true when ready to go live
      requestTimeout: 10000,
    },
  });

  console.log(`✅ MilkyWay provider created (id=${provider.id})`);
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
