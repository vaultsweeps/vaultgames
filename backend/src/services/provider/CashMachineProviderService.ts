import axios from 'axios';
import https from 'https';
import { generateShortPassword, generateShortPasswordWithSymbol } from '../../utils/password';
import { createHash } from 'crypto';
import { getProviderLoginBlock, setProviderLoginBlock, clearProviderLoginBlockKey } from '../../lib/redis';
import FormData from 'form-data';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService, redactForLog } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * CashMachineProviderService
 *
 * Implements the ProviderAdapter for CashMachine (cashmachine777.com) and
 * GameRoom (gameroom777.com) game providers. Both share an identical API shape:
 *   - POST /api/agent/login          → returns JWT Bearer token
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
  readonly supportsUsernameLookup = true;
  protected provider: Provider;

  /** Cached JWT Bearer token */
  /**
   * Login state is shared by every instance of the same provider account (the factory keeps more than one cached copy
   * per provider, and each used to log in separately), so there is one token, one login at a time, and one cooldown.
   */
  private static readonly authStates = new Map<string, { token: string | null; expiresAt: number; inflight: Promise<void> | null; blockedUntil: number }>();
  /** One key per provider AND saved agent login: changing the agent username/password in the admin panel starts clean */
  private static stateKey(p: { id: string; agentId: string; secretKey: string }): string {
    return `${p.id}:${createHash('sha256').update(`${String(p.agentId).trim()}\u0000${String(p.secretKey).trim()}`).digest('hex').slice(0, 12)}`;
  }

  /** Called when an admin saves the provider: forget any login pause so the next request tries again straight away */
  static async clearLoginBlock(p: { id: string; agentId: string; secretKey: string }): Promise<void> {
    const key = CashMachineProviderService.stateKey(p);
    const st = CashMachineProviderService.authStates.get(key);
    if (st) st.blockedUntil = 0;
    await clearProviderLoginBlockKey(key);
  }

  private get authState() {
    const key = CashMachineProviderService.stateKey(this.provider);
    let st = CashMachineProviderService.authStates.get(key);
    if (!st) { st = { token: null, expiresAt: 0, inflight: null, blockedUntil: 0 }; CashMachineProviderService.authStates.set(key, st); }
    return st;
  }
  private get token(): string | null { return this.authState.token; }
  private set token(v: string | null) { this.authState.token = v; }
  /** Unix seconds — when this token expires (from provider) */
  private get tokenExpiresAt(): number { return this.authState.expiresAt; }
  private set tokenExpiresAt(v: number) { this.authState.expiresAt = v; }
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

    const st = this.authState;
    // After a restart the in-memory pause is gone: pick it up again from Redis before logging in
    if (Date.now() >= st.blockedUntil) {
      const stored = await getProviderLoginBlock(CashMachineProviderService.stateKey(this.provider));
      if (stored) st.blockedUntil = stored;
    }
    // The provider told us to stay away (too many failed logins): don't touch its login again until the cooldown ends —
    // every extra attempt only prolongs the lock.
    if (Date.now() < st.blockedUntil) {
      throw new AppError(CashMachineProviderService.UNAVAILABLE_MESSAGE, 503);
    }
    // Simultaneous requests share one login instead of each logging in
    if (st.inflight) return st.inflight;
    st.inflight = this.login().finally(() => { st.inflight = null; });
    return st.inflight;
  }

  /** What players are told while the provider's login is unavailable. The real reason goes to the server log. */
  private static readonly UNAVAILABLE_MESSAGE = 'This game is temporarily unavailable. Please try again in a little while.';

  /** Stop logging in for a while, so a locked / rejected agent account is not hammered further */
  private blockLogin(minutes: number, why: string) {
    this.authState.blockedUntil = Date.now() + minutes * 60_000;
    setProviderLoginBlock(CashMachineProviderService.stateKey(this.provider), this.authState.blockedUntil).catch(() => {});
    console.error(`[CashMachineProvider:${this.provider.name}] Login paused for ${minutes} min — ${why}`);
  }

  private async login(): Promise<void> {

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

        const detail = isCredentialError
          ? `${logPrefix} Invalid agent credentials — check agentId/secretKey in provider config. (${message})`
          : `${logPrefix} Agent login failed: ${message || 'Unknown error'} (status_code: ${status_code})`;

        // The provider locks the agent account after repeated failed logins ("Too many login errors, please try again in an hour")
        if (/too many|try again in|too frequent|locked|frozen/i.test(String(message))) {
          this.blockLogin(60, detail);
          throw new AppError(CashMachineProviderService.UNAVAILABLE_MESSAGE, 503);
        }
        // Wrong agent username/password: every retry counts as another failed login and can restart the provider's own lock,
        // so wait a full hour (saving the provider again in the admin panel clears this pause at once). Other refusals: 5 min.
        this.blockLogin(isCredentialError ? 60 : 5, detail);
        // Never 401 here — that status means "your login expired" to the website and signs the player out
        throw new AppError(isCredentialError ? `${logPrefix} Invalid agent credentials — check agentId/secretKey in provider config.` : CashMachineProviderService.UNAVAILABLE_MESSAGE, isCredentialError ? 502 : 503);
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
      payload: redactForLog(fields), // the console log must never hold passwords either
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
      try {
        const numericId = await this.getPlayerIdByUsername(providerUsername);
        return { userId: numericId, accountName: providerUsername };
      } catch (lookupErr: any) {
        // The provider says the name exists, but it is not in this agent's player list: it belongs to someone else's agent.
        // For us it is simply a taken name — report it that way so a different game username is chosen.
        if (lookupErr?.statusCode === 404) {
          throw new AppError(`Username "${providerUsername}" already exists on the provider (not one of this agent's players)`, 400);
        }
        throw lookupErr;
      }
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
   * The provider's `remark` field requires letters/digits only, max 50 chars — but our own orderId
   * (ProviderTransaction.orderId, e.g. "TX-<userId>-<idempotencyKey>") is a much longer, hyphenated,
   * internal identifier with no such constraint, since it only ever needs to satisfy OUR OWN uniqueness
   * requirements. Sending it as-is made every recharge/withdraw on this provider fail with
   * "Remarks can only be letters and numbers, and cannot exceed 50 characters" the moment orderId grew
   * past a bare short code (confirmed in production on both CashMachine and GameRoom, which share this
   * class). Stripping non-alphanumeric characters keeps the value still traceable back to the real
   * orderId (a cuid/UUID's hex characters survive; only separators are removed) without violating the
   * provider's constraint — this is a display/reference field on their side, not something either system
   * uses for matching, so this is safe.
   */
  private sanitizeRemark(orderId: string): string {
    return orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50);
  }

  /**
   * Add credits to a player.
   * userId here is the provider's numeric player ID (stored in ProviderUser).
   */
  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerRecharge', {
      id: userId,
      balance: Number(amount.toFixed(2)).toString(),
      remark: this.sanitizeRemark(orderId),
    }, userId);
  }

  /**
   * Remove credits from a player.
   */
  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.postRequest('/api/player/playerWithdraw', {
      id: userId,
      balance: Number(amount.toFixed(2)).toString(),
      remark: this.sanitizeRemark(orderId),
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
    const limit = 100;
    const wanted = username.toLowerCase();
    const rowsOf = (body: any): any[] => (Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []);
    const find = (rows: any[]) =>
      rows.find((p: any) =>
        (p.Account || '').toLowerCase() === wanted ||
        (p.account || '').toLowerCase() === wanted ||
        (p.nickname || '').toLowerCase() === wanted ||
        (p.username || '').toLowerCase() === wanted,
      );

    // 0. Fast path: ask the server to filter by name. Servers that don't support the filter simply ignore it (and we fall
    //    through to the full search below), so this can only help.
    try {
      const filtered = await this.getRequest('/api/player/playerList', { limit, page: 1, account: username, username });
      const hit = find(rowsOf(filtered));
      if (hit) return String(hit.id);
    } catch { /* fall through to the full search */ }

    // 1. Page 1 of the full list
    const body1 = await this.getRequest('/api/player/playerList', { limit, page: 1 });
    const rows1 = rowsOf(body1);
    const first = find(rows1);
    if (first) return String(first.id);

    // 2. How many pages are there really? The server may return fewer rows per page than we asked for, so size the pages
    //    from what it actually returned, and use its own page count when it reports one.
    const meta: any = body1 && typeof body1 === 'object' && !Array.isArray(body1) ? body1 : {};
    const count = Number(meta.count ?? meta.total ?? meta.total_count ?? 0) || 0;
    const reportedPages = Number(meta.last_page ?? meta.lastPage ?? meta.pages ?? meta.total_pages ?? 0) || 0;
    const pageSize = rows1.length > 0 ? Math.min(limit, rows1.length) : limit;
    const fromCount = count > 0 ? Math.ceil(count / pageSize) : 0;
    const totalPages = Math.max(reportedPages, fromCount) || 20;

    const searchPage = async (page: number): Promise<string | null> => {
      try {
        const hit = find(rowsOf(await this.getRequest('/api/player/playerList', { limit, page })));
        return hit ? String(hit.id) : null;
      } catch {
        return null;
      }
    };

    let searched = 1;
    if (totalPages > 1) {
      // newest players are normally on the last page
      const last = await searchPage(totalPages); searched++;
      if (last) return last;
      const pages: number[] = [];
      for (let pg = totalPages - 1; pg >= 2; pg--) pages.push(pg);
      for (let i = 0; i < pages.length; i += 5) {
        const batch = pages.slice(i, i + 5);
        const results = await Promise.all(batch.map(searchPage));
        searched += batch.length;
        const found = results.find(r => r !== null);
        if (found) return found;
      }
    }

    // Leave a trail in the server log of what the provider's list looked like, so a failure can be diagnosed without a probe
    console.error(`[CashMachineProvider:${this.provider.name}] Player list search failed for "${username}": rows on page 1 = ${rows1.length}, ` +
      `reported count = ${count || 'none'}, reported pages = ${reportedPages || 'none'}, pages searched = ${searched}/${totalPages}, ` +
      `response keys = [${Object.keys(meta).join(',')}]`);
    throw new AppError(`Player "${username}" not found in provider player list`, 404);
  }

  /**
   * Password reset is NOT supported by the CashMachine/GameRoom/CashFrenzy API.
   * Returns false to signal to the caller that the DB password should be preserved
   * (not replaced with a new one the provider doesn't know about).
   */
  /** Subclasses that share this API but must not get the real reset set this to false */
  protected readonly supportsPlayerReset: boolean = true;
  /** true: if the provider's server turns out not to have the reset call at all, answer "not supported" instead of failing */
  protected readonly resetMayBeMissing: boolean = false;

  /**
   * Cash Machine's own rule (its API answers: "must contain uppercase and lowercase letters and special symbols, and
   * must be between 6 and 12 characters long"). Subclasses with a different rule override these two.
   */
  protected readonly passwordRule: RegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\s])\S{6,12}$/;
  protected readonly passwordRuleHint: string = '6 to 12 characters with upper and lower case letters and a special symbol';

  /**
   * A short random password that meets passwordRule: 7 characters — 2 upper-case, 1 digit, 3 lower-case and the
   * special symbol "@" — shuffled (look-alike characters are left out so it is easy to read out), e.g. "kA@m7Xe".
   */
  generateResetPassword(): string {
    return generateShortPasswordWithSymbol(7);
  }

  /**
   * If the provider refused a generated password because of ITS rule ("letters and numbers only" / "needs a special
   * symbol"), returns a new password in the style it asks for; null when the message isn't about the password's style.
   */
  generateAlternateResetPassword(providerMessage: string): string | null {
    const m = String(providerMessage || '');
    if (/special|symbol|upper ?case/i.test(m)) return generateShortPasswordWithSymbol(7);
    if (/letters and numbers|letters or numbers|alphanumeric|only.*(letters|numbers)/i.test(m)) return generateShortPassword(7);
    return null;
  }

  async resetPlayerPassword(userId: string, newPassword?: string, opts?: { interactive?: boolean }): Promise<boolean> {
    const logPrefix = `[CashMachineProvider:${this.provider.name}]`;

    // Only the player pressing "Reset password" resets the game password. The background sync that runs after a
    // site password change has never touched these providers' game passwords, and still doesn't — it would change
    // the game login without updating the password stored for the credentials card.
    if (!this.supportsPlayerReset || !opts?.interactive || !newPassword) {
      console.info(`${logPrefix} resetPlayerPassword skipped (not an interactive reset, or not enabled for this provider) — keeping existing game password`);
      return false;
    }

    // The provider's own password rule, checked here so a bad password never reaches the provider
    if (!this.passwordRule.test(newPassword)) {
      throw new AppError(`Provider Error: the new password must be ${this.passwordRuleHint}`, 400);
    }

    // providerUserId is the provider's numeric player id (stored at creation). Older rows may hold the account
    // name instead, so look the id up when it isn't numeric.
    let playerId = String(userId ?? '').trim();
    if (!/^\d+$/.test(playerId)) playerId = await this.getPlayerIdByUsername(playerId);

    // Same call the provider's agent panel makes for "reset player password": POST /api/player/reset
    // (fields: id, password, password_confirmation). Uses the shared request helper, so it gets the same login,
    // token-refresh retry, "player is in a game" message and error handling as every other call here.
    try {
      await this.postRequest(
        '/api/player/reset',
        { id: playerId, password: newPassword, password_confirmation: newPassword },
        playerId,
      );
    } catch (err: any) {
      // The server has no such address (HTTP 404/405, or a web page instead of JSON): this provider can't reset from here
      if (this.resetMayBeMissing && /status code (404|405)|non-JSON response/i.test(String(err?.message))) {
        console.warn(`${logPrefix} Reset password is not available on this provider's server — keeping the existing game password`);
        return false;
      }
      throw err;
    }
    console.info(`${logPrefix} Game password reset for player ${playerId}`);
    return true; // caller stores the new password
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
