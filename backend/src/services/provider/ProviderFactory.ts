import { ProviderService } from './ProviderService';
import { FastApiProviderService } from './FastApiProviderService';
import { OrionstarProviderService } from './OrionstarProviderService';
import { CashMachineProviderService } from './CashMachineProviderService';
import { GameRoomProviderService } from './GameRoomProviderService';
import { CashFrenzyProviderService } from './CashFrenzyProviderService';
import { VegasRollProviderService } from './VegasRollProviderService';
import { MilkywayProviderService } from './MilkywayProviderService';
import { MafiaProviderService } from './MafiaProviderService';
import { PandaMasterProviderService } from './PandaMasterProviderService';
import { RiversweepsProviderService } from './RiversweepsProviderService';
import { ProviderAdapter } from './ProviderAdapter';
import { Yolo777ProviderService } from './Yolo777ProviderService';
import prisma from '../../lib/prisma';
import { Provider } from '@prisma/client';
import { resolveGameId } from '../../utils/gameResolver';
import { BoundedCache } from '../../utils/boundedCache';

export function createProviderService(provider: Provider): ProviderAdapter {
  const name = provider.name?.toLowerCase() || '';
  if (name.includes('vblink') || name.includes('ultrapanda')) {
    return new FastApiProviderService(provider);
  }
  if (name.includes('orionstar') || name.includes('orion star')) {
    return new OrionstarProviderService(provider);
  }
  if (name.includes('cashmachine') || name.includes('cash machine') || name.includes('cash777')) {
    return new CashMachineProviderService(provider);
  }
  if (name.includes('gameroom') || name.includes('game room') || name.includes('gameroom777')) {
    return new GameRoomProviderService(provider);
  }
  if (name.includes('cashfrenzy') || name.includes('cash frenzy') || name.includes('cashfrenzy777')) {
    return new CashFrenzyProviderService(provider);
  }
  if (name.includes('vegasroll') || name.includes('vegas roll') || name.includes('vegasroll777')) {
    return new VegasRollProviderService(provider);
  }
  if (name.includes('milkyway') || name.includes('milky way') || name.includes('milky_way')) {
    return new MilkywayProviderService(provider);
  }
  if (name.includes('mafia')) {
    return new MafiaProviderService(provider);
  }
  if (name.includes('pandamaster') || name.includes('panda master') || name.includes('panda_master')) {
    return new PandaMasterProviderService(provider);
  }
  if (name.includes('riversweeps') || name.includes('river sweeps') || name.includes('river_sweeps')) {
    return new RiversweepsProviderService(provider);
  }
  if (name.includes('yolo777') || name.includes('yolo 777') || name.includes('g7s')) {
    return new Yolo777ProviderService(provider);
  }
  return new ProviderService(provider);
}


interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GAME_CACHE_MISS_TTL = 30 * 1000; // an invalid/nonexistent gameId is re-checked much sooner than a hit
// 17 games and 16 providers exist today; 500 gives large headroom for real growth while keeping a hard,
// fixed cap so a stream of distinct (and possibly invalid) gameId values from a request can never grow
// these caches without bound — the oldest, least-recently-used entry is evicted once the cap is reached.
const GAME_CACHE_MAX_SIZE = 500;

export class ProviderFactory {
  // Keyed by the real Provider.id — a small, admin-managed set (today: 16 rows), not attacker-controlled, so
  // an unbounded Map here cannot grow beyond the number of providers that actually exist.
  private static providerCache = new Map<string, CacheEntry<ProviderAdapter>>();
  private static activeProviderCache: CacheEntry<ProviderAdapter> | null = null;
  // Keyed by the request-supplied gameId (a raw string or slug, not validated against the DB before the
  // lookup) — bounded LRU+TTL caches, since an attacker choosing arbitrary/invalid values is otherwise an
  // unbounded-memory-growth vector.
  private static gameProviderCache = new BoundedCache<ProviderAdapter | null>(GAME_CACHE_MAX_SIZE, CACHE_TTL, GAME_CACHE_MISS_TTL);
  private static gameProviderIdCache = new BoundedCache<string | null>(GAME_CACHE_MAX_SIZE, CACHE_TTL, GAME_CACHE_MISS_TTL);

  static async getActiveProvider(): Promise<ProviderAdapter | null> {
    if (this.activeProviderCache && Date.now() - this.activeProviderCache.timestamp < CACHE_TTL) {
      return this.activeProviderCache.data;
    }
    const provider = await prisma.provider.findFirst({
      where: { status: true },
    });
    if (!provider) return null;
    const service = createProviderService(provider);
    this.activeProviderCache = { data: service, timestamp: Date.now() };
    return service;
  }

  static async getProviderById(id: string): Promise<ProviderAdapter | null> {
    const cached = this.providerCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const provider = await prisma.provider.findUnique({ where: { id } });
    if (!provider) return null;
    const service = createProviderService(provider);
    this.providerCache.set(id, { data: service, timestamp: Date.now() });
    return service;
  }

  /**
   * Returns the provider assigned to a specific game.
   */
  static async getProviderForGame(gameId: string): Promise<ProviderAdapter | null> {
    return this.gameProviderCache.getOrCompute(gameId, async () => {
      let targetId = gameId;
      try { targetId = await resolveGameId(gameId); } catch(e) {}

      const game = await prisma.game.findUnique({
        where: { id: targetId },
        include: { provider: true },
      });
      let service: ProviderAdapter | null = null;
      if (game?.provider && game.provider.status) {
        service = createProviderService(game.provider);
        this.providerCache.set(game.provider.id, { data: service, timestamp: Date.now() });
      }
      return service;
    }, service => service === null);
  }

  /**
   * Returns the provider DB record ID assigned to a game.
   */
  static async getProviderIdForGame(gameId: string): Promise<string | null> {
    return this.gameProviderIdCache.getOrCompute(gameId, async () => {
      let targetId = gameId;
      try { targetId = await resolveGameId(gameId); } catch(e) {}

      const game = await prisma.game.findUnique({
        where: { id: targetId },
        select: { providerId: true },
      });
      return game?.providerId || null;
    }, id => id === null);
  }
}
