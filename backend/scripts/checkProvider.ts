import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const providers = await prisma.provider.findMany();
  console.log(JSON.stringify(providers, null, 2));
}

check().finally(() => prisma.$disconnect());
