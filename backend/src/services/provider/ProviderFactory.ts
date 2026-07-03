import { ProviderService } from './ProviderService';
import { ProviderAdapter } from './ProviderAdapter';
import prisma from '../../lib/prisma';

export class ProviderFactory {
  static async getActiveProvider(): Promise<ProviderAdapter | null> {
    const provider = await prisma.provider.findFirst({
      where: { status: true },
    });
    if (!provider) return null;
    return new ProviderService(provider);
  }

  static async getProviderById(id: string): Promise<ProviderAdapter | null> {
    const provider = await prisma.provider.findUnique({ where: { id } });
    if (!provider) return null;
    return new ProviderService(provider);
  }

  /**
   * Returns the provider assigned to a specific game.
   * Falls back to the default active provider if the game has no assignment.
   */
  static async getProviderForGame(gameId: string): Promise<ProviderAdapter | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { provider: true },
    });
    if (game?.provider && game.provider.status) {
      return new ProviderService(game.provider);
    }
    return null;
  }

  /**
   * Returns the provider DB record ID assigned to a game (used for ProviderUser lookups).
   */
  static async getProviderIdForGame(gameId: string): Promise<string | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { providerId: true },
    });
    if (game?.providerId) return game.providerId;
    return null;
  }
}
