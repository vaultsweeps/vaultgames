import { ProviderFactory } from './provider/ProviderFactory';
import prisma from '../lib/prisma';

export class SyncService {
  static async getUserBalance(userId: string): Promise<{ balance: number } | null> {
    const providerUser = await prisma.providerUser.findFirst({
      where: { userId }
    });

    if (!providerUser) return null;

    const providerService = await ProviderFactory.getProviderById(providerUser.providerId);
    if (!providerService) return null;

    try {
      const balance = await providerService.getPlayerBalance(providerUser.providerUserId);
      return { balance };
    } catch (e) {
      console.error('Failed to sync user balance:', e);
      return null;
    }
  }
}
