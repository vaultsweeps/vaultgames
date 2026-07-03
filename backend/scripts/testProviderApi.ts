import { PrismaClient } from '@prisma/client';
import { ProviderFactory } from '../src/services/provider/ProviderFactory';

const prisma = new PrismaClient();

async function testApi() {
  const providers = await prisma.provider.findMany({ where: { status: true } });
  
  for (const p of providers) {
    try {
      console.log(`\nTesting API for ${p.name}...`);
      const service = await ProviderFactory.getProviderById(p.id);
      if (service) {
        // Test getPlayerIdByUsername
        try {
          const id = await service.getPlayerIdByUsername('testuser123');
          console.log(`✅ ${p.name}: Success, user_id = ${id}`);
        } catch (e: any) {
          console.log(`❌ ${p.name} Error: ${e.message}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ ${p.name} Error:`, err.message);
    }
  }
}

testApi().finally(() => prisma.$disconnect());
