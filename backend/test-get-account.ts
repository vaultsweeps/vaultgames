import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { ProviderFactory } from './src/services/provider/ProviderFactory';

async function main() {
  const userId = 'cmr7cl0hc000fozy9nbyyy76r';
  const gameId = 'cmr7b0mow000nconqc8w4g5cm'; // Game Vault ID
  
  const providerId = await ProviderFactory.getProviderIdForGame(gameId);
  console.log("Provider ID for game:", providerId);
  
  if (providerId) {
    const providerUser = await prisma.providerUser.findFirst({ where: { userId, providerId }, include: { provider: true } });
    console.log("Found provider user:", providerUser);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
