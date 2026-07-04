import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS public.users CASCADE;`);
  console.log('Table dropped successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
