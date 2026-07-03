import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running withdrawal system migration...');

  // 1. Create atomic sequence for request IDs (starts at 1001)
  await prisma.$executeRawUnsafe(`
    CREATE SEQUENCE IF NOT EXISTS withdrawal_request_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
  `);
  console.log('✅ Created sequence: withdrawal_request_seq');

  // 2. Add telegramMessageId column
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Withdrawal"
    ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT,
    ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
  `);
  console.log('✅ Added telegramMessageId and telegramChatId columns to Withdrawal');

  // 3. Create index on requestId (already exists but ensure it)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Withdrawal_requestId_idx" ON "Withdrawal"("requestId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Withdrawal_status_idx" ON "Withdrawal"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");
  `);
  console.log('✅ Created indexes on Withdrawal table');

  console.log('\n✅ Withdrawal migration completed successfully!');
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
