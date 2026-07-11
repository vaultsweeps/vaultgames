import prisma from './src/lib/prisma';
async function run() {
  const ds = await prisma.deposit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(ds.map(d => ({id: d.id, amount: d.amount, notes: d.notes, status: d.status, createdAt: d.createdAt})));
}
run();
