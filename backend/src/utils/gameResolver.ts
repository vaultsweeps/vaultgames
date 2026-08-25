import prisma from '../../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Resolves a game ID from either a Prisma CUID or a URL-friendly slug.
 * Slugs are generated from the game name (lowercase, no spaces/special chars).
 * e.g. "GameVault" -> "gamevault", "Cash Frenzy" -> "cashfrenzy"
 */
export async function resolveGameId(idOrSlug: string): Promise<string> {
  // Rough check for Prisma CUID (starts with c, length 25 or 30)
  if (idOrSlug.startsWith('c') && idOrSlug.length >= 25) {
    const game = await prisma.game.findUnique({ where: { id: idOrSlug } });
    if (game) return game.id;
  }

  // Not a valid CUID, or CUID not found. Search by slug/name.
  const targetSlug = idOrSlug.toLowerCase().replace(/[\s_.-]+/g, '');
  const allGames = await prisma.game.findMany({ select: { id: true, name: true } });
  
  const game = allGames.find(g => g.name.toLowerCase().replace(/[\s_.-]+/g, '') === targetSlug);
  
  if (!game) {
    throw new AppError('Game not found', 404);
  }
  
  return game.id;
}
