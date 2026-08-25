import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class MilkywayProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;

  // ─── Session state ────────────────────────────────────────────────────────
  private agentKey: string | null = null;
  private agentBalance: number = 0;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;

  /**
   * 3 minutes — deliberately short.
   * A cached key older than this is proactively discarded before any call,
   * so we never hit the API with a stale key in the first place.
   */
  private readonly TTL_MS = 3 * 60 * 1000;

  // ─── Constructor ─────────────────────────────────────────────────────────
  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Milkyway provider config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }

    // Trim every credential field
    this.provider = {
      ...provider,
      agentId:    provider.agentId.trim(),
      secretKey:  provider.secretKey.trim(),
      apiBaseUrl: provider.apiBaseUrl.trim().replace(/\/+$/, ''),
    };

    this.http = axios.create({
      baseURL: this.provider.apiBaseUrl,
      timeout: this.provider.requestTimeout || 10_000,
      // IIS-backed endpoints expect Content-Length even on empty bodies
      headers: { 'Content-Length': '0' },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /** MD5 of a string, returned as lowercase hex. */
  private md5(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /** Seconds since epoch — 10 digits. */
  private nowSeconds(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private get agentName(): string {
    return this.provider.agentId;
  }

  private get servicePath(): string {
    const ep = this.provider.endpoints as Record<string, string> | null;
    return ep?.servicePath ?? '/ws/service.ashx';
  }

  /**
   * Returns true for any server response that means "your session or
   * signature is no longer valid — please re-login and retry."
   */
  private isAuthError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
      m.includes('session')   ||
      m.includes('timeout')   ||
      m.includes('signature') ||
      m.includes('expire')    ||
      m.includes('invalid key') ||
      m.includes('not logged') ||
      m.includes('login')
    );
  }

  /** Wipe all session state so the next call triggers a fresh login. */
  private invalidateSession(): void {
    this.agentKey     = null;
    this.lastAuthTime = 0;
    this.authPromise  = null;
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  private async authenticate(): Promise<void> {
    // Key is still fresh — nothing to do
    if (this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) {
      return;
    }

    // Another concurrent call is already logging in — share its result
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      const time = this.nowSeconds();
      console.info(`[MilkyWay] → agentLogin | agent: ${this.agentName} | time: ${time}`);

      try {
        const res = await this.http.post(this.servicePath, null, {
          params: {
            action:      'agentLogin',
            agentName:   this.agentName,
            agentPasswd: this.md5(this.provider.secretKey),
            time,
          },
        });

        console.info(`[MilkyWay] ← agentLogin | ${JSON.stringify(res.data)}`);

        const d = res.data;
        if (String(d.code) !== '200') {
          throw new AppError(`MilkyWay login failed: ${d.msg}`, 400);
        }

        const key = (
          d.agentkey ?? d.agentKey ?? d.AgentKey ?? d.AGENTKEY ?? ''
        ).toString().trim();

        if (!key) {
          throw new AppError(
            `MilkyWay login returned no agentKey. Full response: ${JSON.stringify(d)}`,
            500,
          );
        }

        this.agentKey     = key;
        this.agentBalance = parseFloat(d.balance ?? d.Balance ?? '0') || 0;
        this.lastAuthTime = Date.now();

        console.info(`[MilkyWay] Session established | key: ${key} | balance: ${this.agentBalance}`);

        // Sleep so the next request's timestamp is in a different second from this login.
        await this.sleep(2000);

      } catch (err: any) {
        this.invalidateSession();
        if (err instanceof AppError) throw err;
        throw new AppError(`MilkyWay login error: ${err.message}`, 502);
      } finally {
        // Always release the lock whether we succeeded or failed
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  // ─── Core request handler ─────────────────────────────────────────────────

  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry = false,
  ): Promise<any> {
    await this.authenticate();

    if (!this.agentKey) {
      throw new AppError('[MilkyWay] No agentKey after authenticate() — this should never happen', 500);
    }

    const time      = this.nowSeconds();
    // Per official docs: sign = MD5(agentName.toLowerCase() + time + agentKey.toLowerCase())
    const signInput = this.agentName.toLowerCase() + time + this.agentKey.toLowerCase();
    const sign      = this.md5(signInput);

    const params   = { agentName: this.agentName, time, sign, ...payload };
    const endpoint = `${this.servicePath}?action=${action}`;

    console.info(`[MilkyWay] → ${action} | time: ${time} | sign: ${sign} | signInput: "${signInput}"`);

    try {
      const res = await this.http.post(endpoint, null, { params });
      const { code, msg, ...data } = res.data;
      const codeStr = String(code);

      console.info(`[MilkyWay] ← ${action} | code: ${codeStr} | msg: ${msg ?? 'ok'}`);

      if (codeStr !== '200') {
        const errMsg = msg || 'Unknown error';

        // Retry once on any auth/session/signature error with a fresh login
        if (!isRetry && this.isAuthError(errMsg)) {
          console.warn(`[MilkyWay] Auth error on "${action}": "${errMsg}" — refreshing session and retrying...`);
          this.invalidateSession();
          await this.sleep(3000); // wait before re-login to avoid rate-limit
          return this.makeRequest(action, payload, userId, true);
        }

        // Log the failure then surface it
        await ProviderLogService.logRequest(
          this.provider.id,
          userId,
          endpoint,
          params,
          res.data,
          parseInt(codeStr, 10), // always Int for Prisma
          errMsg,
        );
        throw new AppError(`Provider Error: ${errMsg}`, 400);
      }

      // Success
      await ProviderLogService.logRequest(
        this.provider.id,
        userId,
        endpoint,
        params,
        res.data,
        200,
        null,
      );

      return data;

    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Provider connection failed: ${err.message}`, 502);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Sanitize a username so it passes MilkyWay's constraints:
   *   - Only letters, digits, and underscores  ([a-zA-Z0-9_])
   *   - 6–32 characters
   *
   * Strategy: strip invalid chars to form a base, then ALWAYS append a
   * 4-char random alphanumeric suffix when the original username needed any
   * modification (had spaces/special chars), was too short, or was reserved.
   * This guarantees a valid unique provider account every time.
   */
  private sanitizeUsername(username: string): string {
    const RESERVED = new Set([
      'admin', 'root', 'test', 'user', 'guest', 'system', 'support',
      'superadmin', 'administrator', 'mod', 'moderator', 'staff',
    ]);

    /** 4-char random lowercase alphanumeric suffix */
    const randomSuffix = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };

    // Keep only what the provider allows (letters + digits + underscore)
    const base = username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    const wasModified = base !== username.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    const needsSuffix =
      !base ||
      base.length < 6 ||
      RESERVED.has(base) ||
      wasModified;

    let safe: string;
    if (needsSuffix) {
      const trimmedBase = (base || 'u').substring(0, 27);
      safe = trimmedBase + randomSuffix();
    } else {
      safe = base;
    }

    if (safe.length < 6) safe = safe.padEnd(6, '0');
    return safe.substring(0, 32);
  }

  async createPlayer(username: string, password?: string) {
    const providerUsername = this.sanitizeUsername(username);
    if (providerUsername !== username) {
      console.info(
        `[MilkyWay:${this.provider.name}] Username sanitized: "${username}" → "${providerUsername}"`,
      );
    }

    await this.makeRequest('registerUser', {
      account: providerUsername,
      passwd:  this.md5(password || 'Test@1234'),
    });

    return { userId: providerUsername, accountName: providerUsername };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest(
      'recharge',
      { account: userId, amount: Math.floor(amount) },
      userId,
    );
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest(
      'redeem',
      { account: userId, amount: Math.floor(amount) },
      userId,
    );
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryInfo', { account: userId }, userId);
    return parseFloat(data.userbalance ?? data.userBalance ?? '0') || 0;
  }

  async getAgentBalance(): Promise<number> {
    await this.authenticate();
    return this.agentBalance;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    await this.makeRequest(
      'changePasswd',
      {
        account:   userId,
        passwdNew: this.md5(newPassword || 'Test@1234'),
      },
      userId,
    );
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    console.warn(`[MilkyWay] forcePlayerOffline is not supported by this provider. userId=${userId}`);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    return username;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
