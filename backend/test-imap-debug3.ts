import prisma from './src/lib/prisma';
async function run() {
  const d = await prisma.deposit.findUnique({ where: { id: 'cmrddlo0g000vzv5i7s3erzpc' } });
  console.log(d);
}
run();
