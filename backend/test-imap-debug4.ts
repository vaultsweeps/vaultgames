import prisma from './src/lib/prisma';
async function run() {
  const ds = await prisma.deposit.findMany({
    where: { status: 'pending' }
  });
  console.log("Pending:", ds.map(d => ({id: d.id, amount: d.amount, notes: d.notes, createdAt: d.createdAt})));
}
run();
