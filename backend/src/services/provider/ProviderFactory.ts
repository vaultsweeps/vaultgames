import { ProviderService } from './ProviderService';
import { FastApiProviderService } from './FastApiProviderService';
import { OrionstarProviderService } from './OrionstarProviderService';
import { CashMachineProviderService } from './CashMachineProviderService';
import { GameRoomProviderService } from './GameRoomProviderService';
import { CashFrenzyProviderService } from './CashFrenzyProviderService';
import { VegasRollProviderService } from './VegasRollProviderService';
import { MilkywayProviderService } from './MilkywayProviderService';
import { ProviderAdapter } from './ProviderAdapter';
import prisma from '../../lib/prisma';
import { Provider } from '@prisma/client';

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
  return new ProviderService(provider);
}


interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ProviderFactory {
  private static providerCache = new Map<string, CacheEntry<ProviderAdapter>>();
  private static activeProviderCache: CacheEntry<ProviderAdapter> | null = null;
  private static gameProviderCache = new Map<string, CacheEntry<ProviderAdapter | null>>();
  private static gameProviderIdCache = new Map<string, CacheEntry<string | null>>();

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
    const cached = this.gameProviderCache.get(gameId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { provider: true },
    });
    let service: ProviderAdapter | null = null;
    if (game?.provider && game.provider.status) {
      service = createProviderService(game.provider);
      this.providerCache.set(game.provider.id, { data: service, timestamp: Date.now() });
    }
    this.gameProviderCache.set(gameId, { data: service, timestamp: Date.now() });
    return service;
  }

  /**
   * Returns the provider DB record ID assigned to a game.
   */
  static async getProviderIdForGame(gameId: string): Promise<string | null> {
    const cached = this.gameProviderIdCache.get(gameId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { providerId: true },
    });
    const pId = game?.providerId || null;
    this.gameProviderIdCache.set(gameId, { data: pId, timestamp: Date.now() });
    return pId;
  }
}
