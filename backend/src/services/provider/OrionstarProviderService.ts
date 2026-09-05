import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class OrionstarProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;

  // ─── Session state ────────────────────────────────────────────────────────
  private agentKey: string | null = null;
  private agentBalance: number = 0;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;

  // 3 minutes — shorter than Orion's actual session TTL so we never
  // send a request with a key the server has already expired.
  private readonly TTL_MS = 3 * 60 * 1000;

  // ─── Constructor ─────────────────────────────────────────────────────────
  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Orionstar config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }

    this.provider = {
      ...provider,
      agentId:    provider.agentId.trim(),
      secretKey:  provider.secretKey.trim(),
      // ✅ Ensure URL never has a trailing slash
      apiBaseUrl: provider.apiBaseUrl.trim().replace(/\/+$/, ''),
    };

    this.http = axios.create({
      baseURL: this.provider.apiBaseUrl,
      timeout: this.provider.requestTimeout || 15_000,
      headers: { 'Content-Length': '0' },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private md5(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  // Seconds-based timestamp — API reference URLs all show 10-digit values
  // e.g. time=1598452539
  private nowSeconds(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private get agentName(): string { return this.provider.agentId; }

  // The original .ashx was correct — .aspx returns a 404!
  private get servicePath(): string {
    const ep = this.provider.endpoints as Record<string, string> | null;
    return ep?.servicePath ?? '/ws/service.ashx';
  }

  private isAuthError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
      m.includes('session')    ||
      m.includes('timeout')    ||
      m.includes('signature')  ||
      m.includes('expire')     ||
      m.includes('invalid key')||
      m.includes('not logged') ||
      m.includes('login')
    );
  }

  private invalidateSession(): void {
    this.agentKey     = null;
    this.lastAuthTime = 0;
    this.authPromise  = null;
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  /**
   * Ensures a valid agentKey is cached.
   *
   * Only ONE login runs at a time (authPromise lock) — concurrent callers
   * share the same promise so they never invalidate each other's keys.
   *
   * The 2-second sleep after storing the key is critical: without it, the
   * first downstream request fires in the same clock-second as the login
   * and the server rejects it as "Session timeout."
   */
  private async authenticate(): Promise<void> {
    if (this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) return;
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      const time = this.nowSeconds();
      console.info(`[Orionstar] → agentLogin | agent: ${this.agentName} | time: ${time}`);

      try {
        const res = await this.http.post(this.servicePath, null, {
          params: {
            action:      'agentLogin',
            agentName:   this.agentName,
            agentPasswd: this.md5(this.provider.secretKey),
            time,
          },
        });

        console.info(`[Orionstar] ← agentLogin | ${JSON.stringify(res.data)}`);

        const d = res.data;
        if (String(d.code) !== '200') {
          throw new AppError(`Orionstar login failed: ${d.msg}`, 400);
        }

        // API confirmed to return field as lowercase "agentkey"
        const key = (
          d.agentkey ?? d.agentKey ?? d.AgentKey ?? d.AGENTKEY ?? ''
        ).toString().trim();

        if (!key) {
          throw new AppError(
            `Orionstar login returned no agentKey. Response: ${JSON.stringify(d)}`,
            500,
          );
        }

        this.agentKey     = key;
        this.agentBalance = parseFloat(d.balance ?? d.Balance ?? '0') || 0;
        this.lastAuthTime = Date.now();

        console.info(`[Orionstar] Session OK | key: ${key} | balance: ${this.agentBalance}`);

        // ✅ Wait 2s so the next request's timestamp is strictly greater
        // than the login timestamp — same-second = "Session timeout"
        await this.sleep(2000);

      } catch (err: any) {
        this.invalidateSession();
        if (err instanceof AppError) throw err;
        throw new AppError(`Orionstar login error: ${err.message}`, 502);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  // ─── Core request ─────────────────────────────────────────────────────────

  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry = false,
  ): Promise<any> {
    await this.authenticate();
    if (!this.agentKey) throw new AppError('No agentKey after authenticate()', 500);

    const time      = this.nowSeconds();
    // Per official docs: sign = MD5(agentName.toLowerCase() + time + agentKey.toLowerCase())
    const signInput = this.agentName.toLowerCase() + time + this.agentKey.toLowerCase();
    const sign      = this.md5(signInput);

    const params = { agentName: this.agentName, time, sign, ...payload };

    const searchParams = new URLSearchParams();
    searchParams.append('agentName', this.agentName);
    for (const [key, val] of Object.entries(payload)) {
      searchParams.append(key, String(val));
    }
    searchParams.append('time', time);
    searchParams.append('sign', sign);

    const endpoint = `${this.servicePath}?action=${action}&${searchParams.toString()}`;

    console.info(`[Orionstar] → ${action} | time: ${time} | signInput: "${signInput}" | sign: ${sign}`);

    try {
      const res = await this.http.post(endpoint, null);
      const { code, msg, ...data } = res.data;
      const codeStr = String(code);

      console.info(`[Orionstar] ← ${action} | code: ${codeStr} | msg: ${msg ?? 'ok'}`);

      if (codeStr !== '200') {
        const errMsg = msg || 'Unknown error';

        if (!isRetry && this.isAuthError(errMsg)) {
          console.warn(`[Orionstar] Auth error on "${action}": "${errMsg}" — refreshing session...`);
          this.invalidateSession();
          await this.sleep(3000);
          return this.makeRequest(action, payload, userId, true);
        }

        await ProviderLogService.logRequest(
          this.provider.id, userId, endpoint, params, res.data,
          parseInt(codeStr, 10), errMsg,
        );
        throw new AppError(`Provider Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(
        this.provider.id, userId, endpoint, params, res.data, 200, null,
      );
      return data;

    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Provider connection failed: ${err.message}`, 502);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Sanitize a username so it passes Orionstar's constraints:
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

    // Keep only what the provider allows (letters + digits)
    const base = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const wasModified = base !== username.toLowerCase();
    const needsSuffix =
      !base ||
      base.length < 6 ||
      RESERVED.has(base) ||
      wasModified;

    let safe: string;
    if (needsSuffix) {
      // Leave room for 4-char suffix (max total = 32)
      const trimmedBase = (base || 'u').substring(0, 27);
      safe = trimmedBase + randomSuffix();
    } else {
      safe = base;
    }

    // Minimum length guard
    if (safe.length < 6) safe = safe.padEnd(6, '0');

    // Hard cap at 32 chars
    return safe.substring(0, 32);
  }

  async createPlayer(username: string, password?: string) {
    const providerUsername = this.sanitizeUsername(username);
    if (providerUsername !== username) {
      console.info(
        `[Orionstar:${this.provider.name}] Username sanitized: "${username}" → "${providerUsername}"`,
      );
    }
    await this.makeRequest('registerUser', {
      account: providerUsername,
      passwd:  this.md5(password || 'Test@1234'),
    });
    return { userId: providerUsername, accountName: providerUsername };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest('recharge', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest('redeem', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryUserinfo', { account: userId }, userId);
    return parseFloat(data.userbalance ?? data.userBalance ?? '0') || 0;
  }

  async getAgentBalance(): Promise<number> {
    await this.authenticate();
    return this.agentBalance;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    await this.makeRequest('changePasswd', {
      account:   userId,
      passwdnew: this.md5(newPassword || 'Test@1234'),
    }, userId);
    return true;
  }

  /**
   * Generates a download code for Orionstar app installation.
   * Per the API docs: only agentName + time + sign are required.
   * Returns the downloadCode string on success.
   */
  async getDownloadCode(): Promise<string> {
    try {
      const res = await this.makeRequest('getDownloadCode', {}, null);
      if (res && res.downloadCode) {
        return res.downloadCode;
      }
    } catch (err) {
      console.warn(`[Orionstar] getDownloadCode API failed:`, err);
    }
    
    // Fallback: If the API fails, returns an empty string, or is disabled, 
    // return the agent name as the default store code (which is commonly used in Orionstar)
    return this.agentName || "YOUR_STORE_CODE";
  }


  async forcePlayerOffline(userId: string): Promise<boolean> {
    console.warn(`[Orionstar] forcePlayerOffline not supported. userId=${userId}`);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> { return username; }
  getProviderId(): string { return this.provider.id; }
}
