import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const bonuses = await prisma.bonus.findMany();
  console.log('Bonuses:', bonuses);
  
  const welcome = await prisma.bonus.findFirst({ where: { type: 'welcome' } });
  console.log('Welcome:', welcome);
}
main().finally(() => prisma.$disconnect());
