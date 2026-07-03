import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."ProviderUser" ADD COLUMN "accountPassword" text;');
    console.log("Successfully added accountPassword column.");
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
}

main().finally(() => prisma.$disconnect());
