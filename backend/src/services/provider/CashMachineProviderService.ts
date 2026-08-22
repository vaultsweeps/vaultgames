import axios from 'axios';
import FormData from 'form-data';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * CashMachineProviderService
 *
 * Implements the ProviderAdapter for CashMachine (cashmachine777.com) and
 * GameRoom (gameroom777.com) game providers. Both share an identical API shape:
 *   - POST /api/agent/login       → returns JWT Bearer token
 *   - POST /api/player/insertPlayer
 *   - GET  /api/player/playerList
 *   - GET  /api/player/getScore?id=...
 *   - POST /api/player/playerRecharge
 *   - POST /api/player/playerWithdraw
 *
 * Provider DB config:
 *   agentId    → agent username  (e.g. "VegasC01")
 *   secretKey  → agent password  (e.g. "AbcD1122@@")
 *   apiBaseUrl → base URL        (e.g. "https://agentserver.cashmachine777.com")
 *
 * The numeric player ID returned by the provider is stored as userId in ProviderUser.
 */
export class CashMachineProviderService implements ProviderAdapter {
  protected provider: Provider;

  /** Cached JWT Bearer token */
  private token: string | null = null;
  /** Unix seconds — when this token expires (from provider) */
  private tokenExpiresAt: number = 0;
  /** 5-minute buffer before declared expiry, to avoid edge-case 401s */
  private static readonly TOKEN_BUFFER_SECS = 300;

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Provider configuration missing for ${provider.name || provider.id}`,
        500,
      );
    }
    this.provider = {
      ...provider,
      agentId: provider.agentId.trim(),       // agent username
      secretKey: provider.secretKey.trim(),    // agent password
      apiBaseUrl: provider.apiBaseUrl.trim(),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  protected get baseUrl(): string {
    return this.provider.apiBaseUrl.replace(/\/+$/, '');
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  /**
   * Returns true when the cached token is still valid (with buffer).
   */
  private isTokenValid(): boolean {
    if (!this.token) return false;
    return Math.floor(Date.now() / 1000) < this.tokenExpiresAt - CashMachineProviderService.TOKEN_BUFFER_SECS;
  }

  /**
   * Authenticate against /api/agent/login and cache the JWT.
   * Called automatically before every request that needs auth.
   */
  private async authenticate(): Promise<void> {
    if (this.isTokenValid()) return;

    const url = this.buildUrl('/api/agent/login');
    const form = new FormData();
    form.append('username', this.provider.agentId);
    form.append('password', this.provider.secretKey);

    const logPrefix = `[CashMachineProvider:${this.provider.name}]`;
    try {
      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: this.provider.requestTimeout || 10000,
      });

      const { status_code, message, data } = response.data;

      if (status_code !== 200 || !data?.token) {
        throw new AppError(
          `${logPrefix} Agent login failed: ${message || 'Unknown error'} (status_code: ${status_code})`,
          400,
        );
      }

      this.token = data.token;
      this.tokenExpiresAt = data.expires_time || Math.floor(Date.now() / 1000) + 6 * 3600;

      console.info(
        `${logPrefix} Authenticated successfully. Token expires at ${new Date(this.tokenExpiresAt * 1000).toISOString()}`,
      );
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(
        `${logPrefix} Agent login connection failed: ${e.message}`,
        502,
      );
    }
  }

  /**
   * Make an authenticated POST request using form-data.
   */
  private async postRequest(
    path: string,
    fields: Record<string, string>,
    userId: string | null = null,
    isRetry = false
  ): Promise<any> {
    await this.authenticate();

    const url = this.buildUrl(path);
    const form = new FormData();
    for (const [key, val] of Object.entries(fields)) {
      form.append(key, val);
    }

    const startTime = Date.now();
    const logData = {
      providerId: this.provider.id,
      providerName: this.provider.name,
      endpoint: path,
      url,
      payload: fields,
    };

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.token}`,
        },
        timeout: this.provider.requestTimeout || 10000,
      });

      const duration = Date.now() - startTime;
      const body = response.data;

      if (body.status_code !== 200) {
        const msg = body.message || 'Unknown provider error';
        
        if (!isRetry && (body.status_code === 401 || msg.toLowerCase().includes('login again') || msg.toLowerCase().includes('token'))) {
          console.warn(`[CashMachineProvider:${this.provider.name}] Token invalid/expired ("${msg}"). Clearing token and retrying once...`);
          this.token = null;
          this.tokenExpiresAt = 0;
          return this.postRequest(path, fields, userId, true);
        }

        console.error(JSON.stringify({ ...logData, status: body.status_code, response: body, duration }));
        await ProviderLogService.logRequest(
          this.provider.id, userId, path, fields, body, body.status_code, msg,
        );
        // Surface "player in game" as a friendly error
        if (msg.toLowerCase().includes('in the game') || msg.toLowerCase().includes('lobby')) {
          throw new AppError('Player is currently in a game. Please return to the lobby first.', 400);
        }
        throw new AppError(`Provider Error: ${msg}`, 400);
      }

      console.info(JSON.stringify({ ...logData, status: 200, response: 'Success', duration }));
      await ProviderLogService.logRequest(
        this.provider.id, userId, path, fields, body, 200, null,
      );
      return body.data ?? body;
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      const duration = Date.now() - startTime;
      const status = e.response?.status || 500;
      const errorData = e.response?.data || e.message;
      console.error(JSON.stringify({ ...logData, status, response: errorData, message: e.message, duration }));
      await ProviderLogService.logRequest(
        this.provider.id, userId, path, fields, errorData, status, e.message,
      );
      // If we get a 401, force token refresh next time
      if (status === 401) {
        this.token = null;
        this.tokenExpiresAt = 0;
      }
      throw new AppError(`Provider connection failed: ${e.message || 'Unknown network error'}`, 502);
    }
  }

  /**
   * Make an authenticated GET request with query params.
   */
  private async getRequest(
    path: string,
    params: Record<string, string | number> = {},
    userId: string | null = null,
    isRetry = false
  ): Promise<any> {
    await this.authenticate();

    const url = this.buildUrl(path);
    const startTime = Date.now();
    const logData = {
      providerId: this.provider.id,
      providerName: this.provider.name,
      endpoint: path,
      url,
      payload: params,
    };

    try {
      const response = await axios.get(url, {
        params,
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: this.provider.requestTimeout || 10000,
      });

      const duration = Date.now() - startTime;
      const body = response.data;

      if (body.status_code !== 200) {
        const msg = body.message || 'Unknown provider error';

        if (!isRetry && (body.status_code === 401 || msg.toLowerCase().includes('login again') || msg.toLowerCase().includes('token'))) {
          console.warn(`[CashMachineProvider:${this.provider.name}] Token invalid/expired ("${msg}"). Clearing token and retrying once...`);
          this.token = null;
          this.tokenExpiresAt = 0;
          return this.getRequest(path, params, userId, true);
        }

        console.error(JSON.stringify({ ...logData, status: body.status_code, response: body, duration }));
        await ProviderLogService.logRequest(
          this.provider.id, userId, path, params as any, body, body.status_code, msg,
        );
        throw new AppError(`Provider Error: ${msg}`, 400);
      }

      console.info(JSON.stringify({ ...logData, status: 200, response: 'Success', duration }));
      await ProviderLogService.logRequest(
        this.provider.id, userId, path, params as any, body, 200, null,
      );
      return body.data ?? body;
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      const duration = Date.now() - startTime;
      const status = e.response?.status || 500;
      const errorData = e.response?.data || e.message;
      console.error(JSON.stringify({ ...logData, status, response: errorData, message: e.message, duration }));
      await ProviderLogService.logRequest(
        this.provider.id, userId, path, params as any, errorData, status, e.message,
      );
      if (status === 401) {
        this.token = null;
        this.tokenExpiresAt = 0;
      }
      throw new AppError(`Provider connection failed: ${e.message || 'Unknown network error'}`, 502);
    }
  }

  // ---------------------------------------------------------------------------
  // ProviderAdapter interface implementation
  // ---------------------------------------------------------------------------

  /**
   * Create a new player account on the provider.
   * Returns { userId: numericId, accountName: username }.
   * The numeric ID is what is used for recharge/withdraw/balance operations.
   *
   * NOTE: If the username already exists, we look up the player list to find
   * the existing numeric ID and return that as userId.
   */
  async createPlayer(
    username: string,
    password?: string,
  ): Promise<{ userId: string; accountName: string }> {
    const endpoint = '/api/player/insertPlayer';
    const safePassword = password || 'Test@123';

    try {
      const data = await this.postRequest(endpoint, {
        username,
        nickname: username,
        password: safePassword,
        money: '0',
      });

      // Response: { account, password, balance, time }
      // The provider doesn't return the numeric ID from insertPlayer —
      // we must look it up via playerList right after creation.
      const numericId = await this.getPlayerIdByUsername(data?.account || username);
      console.info(
        `[CashMachineProvider:${this.provider.name}] Created player "${username}" → numericId: ${numericId}`,
      );
      return { userId: numericId, accountName: data?.account || username };
    } catch (e: any) {
      // "Username Already Exists" — look up numeric ID and return it
      if (
        e.message?.toLowerCase().includes('already') ||
        e.message?.toLowerCase().includes('exist')
      ) {
        console.info(
          `[CashMachineProvider:${this.provider.name}] Player "${username}" already exists — looking up numeric ID`,
        );
        const numericId = await this.getPlayerIdByUsername(username);
        return { userId: numericId, accountName: username };
      }
      throw e;
    }
  }

  /**
   * Add credits to a player.
   * userId here is the provider's numeric player ID (stored in ProviderUser).
   */
  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerRecharge', {
      id: userId,
      balance: amount.toFixed(2),
      remark: orderId,
    }, userId);
  }

  /**
   * Remove credits from a player.
   */
  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerWithdraw', {
      id: userId,
      balance: amount.toFixed(2),
      remark: orderId,
    }, userId);
  }

  /**
   * Get player balance from /api/player/getScore
   * Response: { username, balance, is_game }
   */
  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.getRequest('/api/player/getScore', { id: userId }, userId);
    return parseFloat(data.balance ?? data.score ?? '0');
  }

  /**
   * Get the agent's own balance (points) — returned by agentLogin response.
   * Force a fresh login to get the current value.
   */
  async getAgentBalance(): Promise<number> {
    // Invalidate cached token to force a fresh login (money field is in login response)
    this.token = null;
    this.tokenExpiresAt = 0;

    const url = this.buildUrl('/api/agent/login');
    const form = new FormData();
    form.append('username', this.provider.agentId);
    form.append('password', this.provider.secretKey);

    try {
      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: this.provider.requestTimeout || 10000,
      });
      const { data } = response.data;
      // Re-cache token from this fresh login
      if (data?.token) {
        this.token = data.token;
        this.tokenExpiresAt = data.expires_time || Math.floor(Date.now() / 1000) + 6 * 3600;
      }
      return parseFloat(data?.money ?? '0');
    } catch (e: any) {
      console.error(`[CashMachineProvider:${this.provider.name}] getAgentBalance failed:`, e.message);
      return 0;
    }
  }

  /**
   * Find the provider's numeric player ID for a given username.
   * Searches player list page by page until the account is found.
   * Returns the numeric id as a string.
   */
  async getPlayerIdByUsername(username: string): Promise<string> {
    // Paginate until we find the player (max 20 pages × 100 per page = 2000 players)
    const limit = 100;
    for (let page = 1; page <= 20; page++) {
      const body = await this.getRequest(
        `/api/player/playerList?limit=${limit}&page=${page}`,
        {},
      );

      // body is the full response object since we return body.data ?? body
      // playerList returns { status_code, count, data: [ { Account, id, ... } ] }
      const players: any[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const match = players.find(
        (p: any) =>
          (p.Account || '').toLowerCase() === username.toLowerCase() ||
          (p.nickname || '').toLowerCase() === username.toLowerCase(),
      );

      if (match) {
        return String(match.id);
      }

      // If fewer records than limit were returned, we've hit the last page
      if (players.length < limit) break;
    }

    throw new AppError(
      `Player "${username}" not found in provider player list`,
      404,
    );
  }

  /**
   * Password reset is not supported by the CashMachine/GameRoom API.
   * Return true silently so the rest of the flow continues.
   */
  async resetPlayerPassword(_userId: string, _newPassword?: string): Promise<boolean> {
    console.info(
      `[CashMachineProvider:${this.provider.name}] resetPlayerPassword not supported — skipping`,
    );
    return true;
  }

  /**
   * Force offline is not supported by the CashMachine/GameRoom API.
   * Return true silently.
   */
  async forcePlayerOffline(_userId: string): Promise<boolean> {
    console.info(
      `[CashMachineProvider:${this.provider.name}] forcePlayerOffline not supported — skipping`,
    );
    return true;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
