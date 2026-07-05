import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const w = await prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 2 })
  console.log(JSON.stringify(w, null, 2))
}
main().finally(() => prisma.$disconnect())
