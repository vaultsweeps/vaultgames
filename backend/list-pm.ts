import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.paymentMethod.findMany().then(data => { console.log(JSON.stringify(data, null, 2)); }).catch(console.error).finally(() => prisma.$disconnect());
