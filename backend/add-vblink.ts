import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if it already exists
  let provider = await prisma.provider.findFirst({
    where: {
      name: {
        contains: 'vblink',
        mode: 'insensitive'
      }
    }
  });

  const data = {
    name: 'Vblink',
    apiBaseUrl: 'https://www.vblink777.club',
    agentId: 'VegasV01',
    secretKey: 'VegasV01',
    status: true,
    endpoints: {
      appid: 'z85FTZJVXBztimxd39',
      appsecret: 'OafJBPedqDu1bamzcZp1nl3Bcf6',
    }
  };

  if (provider) {
    provider = await prisma.provider.update({
      where: { id: provider.id },
      data
    });
    console.log('Provider updated:', provider.id);
  } else {
    provider = await prisma.provider.create({
      data
    });
    console.log('Provider created:', provider.id);
  }

  // Also make sure there is a game associated with it or check if we need to link games
  const games = await prisma.game.findMany({
    where: {
      name: {
        contains: 'vblink',
        mode: 'insensitive'
      }
    }
  });
  
  if (games.length > 0) {
      for(const game of games) {
          await prisma.game.update({
              where: { id: game.id },
              data: { providerId: provider.id }
          });
          console.log(`Linked game ${game.name} to Vblink provider`);
      }
  } else {
      console.log('No existing vblink games found to link.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
