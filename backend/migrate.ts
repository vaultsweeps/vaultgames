import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "UserProfile" ADD COLUMN "messengerUsername" text;`);
    console.log('Column added successfully.');
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log('Column already exists.');
    } else {
      throw e;
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
