import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Running migrations manually...');

    // 1. Add fields to Withdrawal table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Withdrawal"
      ADD COLUMN IF NOT EXISTS "requestId" TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS "paymentMethodStr" TEXT,
      ADD COLUMN IF NOT EXISTS "accountDetails" TEXT,
      ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT,
      ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('Added fields to Withdrawal table.');

    // 2. Create Conversation table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Conversation" (
        "id" TEXT NOT NULL,
        "conversation_id" TEXT NOT NULL,
        "user_id" TEXT,
        "telegram_user_id" TEXT,
        "telegram_thread_id" TEXT,
        "source" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
      );
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_conversation_id_key" ON "Conversation"("conversation_id");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversation_conversation_id_idx" ON "Conversation"("conversation_id");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversation_telegram_thread_id_idx" ON "Conversation"("telegram_thread_id");
    `);

    // Add foreign key if not exists (handling error safely)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error('Warning on adding FK to Conversation:', e.message);
      }
    }
    console.log('Created Conversation table.');

    // 3. Create Message table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT NOT NULL,
        "conversation_id" TEXT NOT NULL,
        "sender_type" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Message_conversation_id_idx" ON "Message"("conversation_id");
    `);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error('Warning on adding FK to Message:', e.message);
      }
    }
    console.log('Created Message table.');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
