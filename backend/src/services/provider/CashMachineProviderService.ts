import axios from 'axios';
import https from 'https';
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
 *   agentId    → agent username  (stored in DB, set via seed or admin)
 *   secretKey  → agent password  (stored in DB, set via seed or admin)
 *   apiBaseUrl → base URL        (stored in DB)
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

  /** Reusable https agent that ignores SSL errors, since providers often have broken certs */
  private httpsAgent = new https.Agent({ rejectUnauthorized: false });

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
        timeout: this.provider.requestTimeout || 20000,
        httpsAgent: this.httpsAgent,
      });

      const { status_code, message, data } = response.data;

      // Handle cases where the URL is wrong and the server returns HTML instead of JSON
      if (typeof response.data === 'string' || status_code === undefined) {
        throw new AppError(
          `${logPrefix} Agent login failed: Received non-JSON response. Check if the apiBaseUrl in the database is correct (currently: ${this.provider.apiBaseUrl}).`,
          400,
        );
      }

      if (status_code !== 200 || !data?.token) {
        // Distinguish wrong credentials vs other API errors
        const isCredentialError =
          status_code === 401 ||
          (message || '').toLowerCase().includes('password') ||
          (message || '').toLowerCase().includes('username') ||
          (message || '').toLowerCase().includes('invalid') ||
          (message || '').toLowerCase().includes('incorrect');

        throw new AppError(
          isCredentialError
            ? `${logPrefix} Invalid agent credentials — check agentId/secretKey in provider config. (${message})`
            : `${logPrefix} Agent login failed: ${message || 'Unknown error'} (status_code: ${status_code})`,
          isCredentialError ? 401 : 400,
        );
      }

      this.token = data.token;
      this.tokenExpiresAt = data.expires_time || Math.floor(Date.now() / 1000) + 6 * 3600;

      console.info(
        `${logPrefix} Authenticated successfully. Token expires at ${new Date(this.tokenExpiresAt * 1000).toISOString()}`,
      );
    } catch (e: any) {
      if (e instanceof AppError) throw e;

      // Give actionable error messages based on the type of network failure
      const code: string = e.code || '';
      let hint = e.message;
      if (code === 'ECONNREFUSED') {
        hint = `Connection refused to ${url} — the provider server may be down or this server's IP is not whitelisted`;
      } else if (code === 'ECONNRESET' || e.message?.includes('socket hang up')) {
        hint = `Connection reset by ${this.provider.name} server — IP may not be whitelisted. Contact ${this.provider.name} support to whitelist your server IP`;
      } else if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
        hint = `Connection timed out to ${url} — provider server unreachable from this IP`;
      } else if (code === 'ENOTFOUND') {
        hint = `DNS resolution failed for ${url} — check apiBaseUrl in provider config`;
      }

      throw new AppError(
        `${logPrefix} Agent login connection failed: ${hint}`,
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
        timeout: this.provider.requestTimeout || 20000,
        httpsAgent: this.httpsAgent,
      });

      const duration = Date.now() - startTime;
      const body = response.data;

      if (typeof body === 'string' || body.status_code === undefined) {
        throw new AppError(`Provider Error: Received non-JSON response from ${path}. Check apiBaseUrl in database (currently: ${this.provider.apiBaseUrl}).`, 400);
      }

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
      // Translate low-level network errors into actionable messages
      const code: string = (e.code || '');
      let networkHint = e.message || 'Unknown network error';
      if (code === 'ECONNRESET' || networkHint.includes('socket hang up')) {
        networkHint = `${this.provider.name} server reset the connection — your server IP may not be whitelisted by ${this.provider.name}`;
      } else if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
        networkHint = `Request to ${this.provider.name} timed out — provider server unreachable`;
      } else if (code === 'ECONNREFUSED') {
        networkHint = `${this.provider.name} server refused the connection`;
      }
      throw new AppError(`Provider connection failed: ${networkHint}`, 502);
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
        timeout: this.provider.requestTimeout || 20000,
        httpsAgent: this.httpsAgent,
      });

      const duration = Date.now() - startTime;
      const body = response.data;

      if (typeof body === 'string' || body.status_code === undefined) {
        throw new AppError(`Provider Error: Received non-JSON response from ${path}. Check apiBaseUrl in database (currently: ${this.provider.apiBaseUrl}).`, 400);
      }

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
  /**
   * Sanitize a platform username before sending to the provider.
   *
   * CashMachine / VegasRoll / CashFrenzy / GameRoom rules:
   *   - Only letters and digits ([a-zA-Z0-9])  — NO underscore, NO special chars
   *   - 3–20 characters
   *
   * Strategy: strip invalid chars from the user's username to form a "base",
   * then ALWAYS append a short random alphanumeric suffix whenever:
   *   (a) the original username contained any invalid character (modified by
   *       stripping) so the generated name is unique and doesn't clash, OR
   *   (b) the base is too short (< 3 chars), OR
   *   (c) the base is a reserved word that the provider blocks.
   *
   * This guarantees a valid unique account is always created regardless of
   * what username the player chose on our platform.
   */
  private sanitizeUsername(username: string): string {
    const RESERVED = new Set([
      'admin', 'root', 'test', 'user', 'guest', 'system', 'support',
      'superadmin', 'administrator', 'mod', 'moderator', 'staff',
    ]);

    /** 4-char random lowercase alphanumeric suffix — 36^4 = 1.6M combinations */
    const randomSuffix = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };

    // Keep only what the provider allows (letters + digits)
    const base = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Determine if the username needed any fixing
    const wasModified = base !== username.toLowerCase();
    const needsSuffix =
      !base ||
      base.length < 6 ||
      RESERVED.has(base) ||
      wasModified;   // had spaces, special chars, or other invalid characters

    let safe: string;
    if (needsSuffix) {
      // Trim base to leave room for the 4-char suffix (max total = 20)
      const trimmedBase = (base || 'u').substring(0, 15);
      safe = trimmedBase + randomSuffix();
    } else {
      safe = base;
    }

    // Minimum length guard (edge case)
    if (safe.length < 6) safe = safe.padEnd(6, '0');

    // Hard cap at 20 chars (provider limit)
    return safe.substring(0, 20);
  }

  async createPlayer(
    username: string,
    password?: string,
  ): Promise<{ userId: string; accountName: string }> {
    const endpoint = '/api/player/insertPlayer';
    const safePassword = password || 'Test@123';

    // Sanitize username before sending to provider (blocks reserved words like "admin")
    const providerUsername = this.sanitizeUsername(username);
    if (providerUsername !== username) {
      console.info(
        `[CashMachineProvider:${this.provider.name}] Username sanitized: "${username}" → "${providerUsername}"`,
      );
    }

    let insertError: any = null;
    let createdAccount: string | null = null;

    try {
      const data = await this.postRequest(endpoint, {
        username: providerUsername,
        nickname: providerUsername,
        password: safePassword,
        money: '0',
      });

      createdAccount = data?.account || providerUsername;
    } catch (e: any) {
      // Only catch "already exists" errors from insertPlayer itself.
      // All other errors (network, auth, etc.) are re-thrown immediately.
      if (
        e.message?.toLowerCase().includes('already') ||
        e.message?.toLowerCase().includes('exist')
      ) {
        insertError = e; // player exists — fall through to lookup below
      } else {
        throw e;
      }
    }

    if (insertError) {
      // Player already exists on provider — look up their numeric ID
      console.info(
        `[CashMachineProvider:${this.provider.name}] Player "${providerUsername}" already exists — looking up numeric ID`,
      );
      const numericId = await this.getPlayerIdByUsername(providerUsername);
      return { userId: numericId, accountName: providerUsername };
    }

    // Response: { account, password, balance, time }
    // The provider doesn't return the numeric ID from insertPlayer —
    // we must look it up via playerList right after creation.
    const numericId = await this.getPlayerIdByUsername(createdAccount!);
    console.info(
      `[CashMachineProvider:${this.provider.name}] Created player "${providerUsername}" → numericId: ${numericId}`,
    );
    return { userId: numericId, accountName: createdAccount! };
  }

  /**
   * Add credits to a player.
   * userId here is the provider's numeric player ID (stored in ProviderUser).
   */
  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerRecharge', {
      id: userId,
      balance: Math.floor(amount).toString(),
      remark: orderId,
    }, userId);
  }

  /**
   * Remove credits from a player.
   */
  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerWithdraw', {
      id: userId,
      balance: Math.floor(amount).toString(),
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
    const url = this.buildUrl('/api/agent/login');
    const form = new FormData();
    form.append('username', this.provider.agentId);
    form.append('password', this.provider.secretKey);

    // Only do a fresh login if the cached token is expired/missing.
    // Do NOT force-invalidate the token here — doing so on every balance
    // check causes repeated logins and triggers provider-side rate limits
    // ("Too many login errors").
    if (this.isTokenValid() && this.token) {
      // Reuse cached token — fetch agent balance via a dedicated login only
      // when necessary. Fall through to fresh login if token has expired.
      try {
        const response = await axios.post(url, form, {
          headers: form.getHeaders(),
          timeout: this.provider.requestTimeout || 10000,
          httpsAgent: this.httpsAgent,
        });
        const { data } = response.data;
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

    try {
      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: this.provider.requestTimeout || 10000,
        httpsAgent: this.httpsAgent,
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
    
    // Helper to fetch and search a specific page
    const searchPage = async (page: number): Promise<string | null> => {
      try {
        const body = await this.getRequest('/api/player/playerList', { limit, page });
        const players: any[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : [];
            
        const match = players.find(
          (p: any) =>
            (p.Account || '').toLowerCase() === username.toLowerCase() ||
            (p.account || '').toLowerCase() === username.toLowerCase() ||
            (p.nickname || '').toLowerCase() === username.toLowerCase() ||
            (p.username || '').toLowerCase() === username.toLowerCase(),
        );
        return match ? String(match.id) : null;
      } catch (e) {
        return null;
      }
    };

    // 1. Fetch page 1
    const body1 = await this.getRequest('/api/player/playerList', { limit, page: 1 });
    const players1: any[] = Array.isArray(body1) ? body1 : Array.isArray(body1?.data) ? body1.data : [];
    
    let match = players1.find(
      (p: any) =>
        (p.Account || '').toLowerCase() === username.toLowerCase() ||
        (p.account || '').toLowerCase() === username.toLowerCase() ||
        (p.nickname || '').toLowerCase() === username.toLowerCase() ||
        (p.username || '').toLowerCase() === username.toLowerCase(),
    );
    if (match) return String(match.id);

    // 2. If not on page 1, they are likely on the very last page (if sorted oldest->newest)
    const count = typeof body1 === 'object' && body1 !== null && typeof body1.count === 'number' ? body1.count : 0;
    const totalPages = count > 0 ? Math.ceil(count / limit) : 20;
    
    if (totalPages > 1) {
      const lastPageId = await searchPage(totalPages);
      if (lastPageId) return lastPageId;
      
      // 3. If still not found, search remaining pages in parallel batches
      const pagesToSearch = [];
      for (let p = totalPages - 1; p >= 2; p--) {
        pagesToSearch.push(p); // Search backwards from end
      }
      
      // Search in batches of 5 to avoid rate limits while being fast
      for (let i = 0; i < pagesToSearch.length; i += 5) {
        const batch = pagesToSearch.slice(i, i + 5);
        const results = await Promise.all(batch.map(p => searchPage(p)));
        const found = results.find(r => r !== null);
        if (found) return found;
      }
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
