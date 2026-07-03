import prisma from '../src/lib/prisma'

async function main() {
  console.log('Adding new columns to Deposit table...')
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Deposit"
    ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT,
    ADD COLUMN IF NOT EXISTS "telegramChatId"    TEXT,
    ADD COLUMN IF NOT EXISTS "rejectedBy"        TEXT,
    ADD COLUMN IF NOT EXISTS "rejectedAt"        TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "rejectionReason"   TEXT;
  `)

  console.log('Done! Deposit table updated successfully.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
