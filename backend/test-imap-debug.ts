import prisma from './src/lib/prisma';
import { ImapChimePayPalService } from './src/services/payment/ImapChimePayPalService';

async function checkPending() {
  const pending = await prisma.deposit.findMany({
    where: { status: 'pending' },
    include: { paymentMethod: true, user: true }
  });
  console.log("Pending Deposits:");
  pending.forEach(d => {
    console.log(`- ID: ${d.id}, Method: ${d.paymentMethod?.code}, Amount: $${d.amount}, Profile/Sender: "${d.notes}", CreatedAt: ${d.createdAt}`);
  });
  
  // We'll also temporarily override search to check all emails in the last 24h
  console.log("\nStarting IMAP Parse...");
  const approved = await ImapChimePayPalService.parseEmailsAndVerifyDeposits();
  console.log("Approved count:", approved);
  process.exit(0);
}
checkPending();
