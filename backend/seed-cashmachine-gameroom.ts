/**
 * seed-cashmachine-gameroom.ts
 *
 * One-time script to upsert the CashMachine and GameRoom providers into the
 * Provider table. Run with:
 *
 *   npx ts-node seed-cashmachine-gameroom.ts
 *
 * Or compile and run:
 *   npx tsc --skipLibCheck seed-cashmachine-gameroom.ts && node seed-cashmachine-gameroom.js
 *
 * Safe to run multiple times — uses upsert (update-or-create by name).
 */

import prisma from './src/lib/prisma';

const providers = [
  {
    name: 'CashMachine',
    apiBaseUrl: 'https://agentserver.cashmachine777.com',
    agentId: '***REDACTED***',     // agent username
    secretKey: '***REDACTED***', // agent password
    status: true,
    requestTimeout: 10000,
    endpoints: {},           // no custom endpoint overrides needed
  },
  {
    name: 'GameRoom',
    apiBaseUrl: 'https://agentserver1.gameroom777.com',
    agentId: '***REDACTED***',     // agent username
    secretKey: '***REDACTED***',  // agent password
    status: true,
    requestTimeout: 10000,
    endpoints: {},
  },
];

async function main() {
  console.log('Seeding CashMachine and GameRoom providers...\n');

  for (const p of providers) {
    // Try to find an existing record by name (case-insensitive)
    const existing = await prisma.provider.findFirst({
      where: { name: { equals: p.name, mode: 'insensitive' } },
    });

    if (existing) {
      const updated = await prisma.provider.update({
        where: { id: existing.id },
        data: {
          apiBaseUrl: p.apiBaseUrl,
          agentId: p.agentId,
          secretKey: p.secretKey,
          status: p.status,
          endpoints: p.endpoints,
        },
      });
      console.log(`✅ Updated  ${p.name}  (id: ${updated.id})`);
    } else {
      const created = await prisma.provider.create({
        data: {
          name: p.name,
          apiBaseUrl: p.apiBaseUrl,
          agentId: p.agentId,
          secretKey: p.secretKey,
          status: p.status,
          endpoints: p.endpoints,
        },
      });
      console.log(`✅ Created  ${p.name}  (id: ${created.id})`);
    }
  }

  console.log('\nDone! You can now assign games to these providers via the admin panel.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
