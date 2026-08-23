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

  /**
   * 3 minutes — deliberately short.
   * The Orion server expires sessions faster than you'd expect.
   * A cached key older than this is proactively discarded before any call,
   * so we never hit the API with a stale key in the first place.
   */
  private readonly TTL_MS = 3 * 60 * 1000;

  // ─── Constructor ─────────────────────────────────────────────────────────
  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Orionstar provider config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }

    // Trim every credential field — a stray space or newline silently
    // corrupts every MD5 hash and causes permanent "Signature error."
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

  /**
   * Seconds since epoch — 10 digits.
   * The API reference says "System.currentTimeMillis()" but every example
   * URL shows a 10-digit value (e.g. time=1598452539), proving it expects
   * seconds, not milliseconds.
   */
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

  /**
   * Ensures a valid agentKey is in memory.
   *
   * Key design decisions:
   * 1. Only ONE login runs at a time (authPromise lock).  Concurrent callers
   *    await the same promise instead of each triggering a separate login —
   *    which would invalidate each other's keys because the server issues a
   *    new key on every successful agentLogin call.
   * 2. After a successful login we sleep 2 seconds inside this method.
   *    Without the sleep, the first downstream request can fire in the same
   *    clock-second as the login, and the server rejects it as a replay /
   *    "Session timeout." The sleep guarantees the request timestamp is always
   *    strictly greater than the login timestamp.
   */
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

        // The API returns the field as lowercase "agentkey" (confirmed in logs)
        // but we also check PascalCase variants defensively.
        const key = (
          d.agentkey ?? d.agentKey ?? d.AgentKey ?? d.AGENTKEY ?? ''
        ).toString().trim();

        if (!key) {
          throw new AppError(
            `Orionstar login returned no agentKey. Full response: ${JSON.stringify(d)}`,
            500,
          );
        }

        this.agentKey     = key;
        this.agentBalance = parseFloat(d.balance ?? d.Balance ?? '0') || 0;
        this.lastAuthTime = Date.now();

        console.info(`[Orionstar] Session established | key: ${key} | balance: ${this.agentBalance}`);

        // ✅ CRITICAL: sleep so the next request's timestamp is in a different
        // second from this login. Same-second timestamps = "Session timeout."
        await this.sleep(2000);

      } catch (err: any) {
        this.invalidateSession();
        if (err instanceof AppError) throw err;
        throw new AppError(`Orionstar login error: ${err.message}`, 502);
      } finally {
        // Always release the lock whether we succeeded or failed
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  // ─── Core request handler ─────────────────────────────────────────────────

  /**
   * Makes an authenticated POST to the Orion API.
   *
   * On any auth/session/signature error it:
   *   1. Wipes the cached session
   *   2. Waits 3 s (avoids hammering the rate limit)
   *   3. Re-authenticates (which includes its own 2 s post-login sleep)
   *   4. Retries the original call exactly once
   *
   * isRetry prevents infinite loops — if it fails again after a fresh login
   * that is a genuine error (wrong credentials, banned account, etc.) and we
   * surface it to the caller.
   */
  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry = false,
  ): Promise<any> {
    await this.authenticate();

    if (!this.agentKey) {
      throw new AppError('[Orionstar] No agentKey after authenticate() — this should never happen', 500);
    }

    const time      = this.nowSeconds();
    // sign = md5(agentName + time + agentKey), all lowercase before hashing
    const signInput = (this.agentName + time + this.agentKey).toLowerCase();
    const sign      = this.md5(signInput);

    const params   = { agentName: this.agentName, time, sign, ...payload };
    const endpoint = `${this.servicePath}?action=${action}`;

    console.info(`[Orionstar] → ${action} | time: ${time} | sign: ${sign} | signInput: "${signInput}"`);

    try {
      const res = await this.http.post(endpoint, null, { params });
      const { code, msg, ...data } = res.data;
      const codeStr = String(code);

      console.info(`[Orionstar] ← ${action} | code: ${codeStr} | msg: ${msg ?? 'ok'}`);

      if (codeStr !== '200') {
        const errMsg = msg || 'Unknown error';

        // Retry once on any auth/session/signature error with a fresh login
        if (!isRetry && this.isAuthError(errMsg)) {
          console.warn(`[Orionstar] Auth error on "${action}": "${errMsg}" — refreshing session and retrying...`);
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
          parseInt(codeStr, 10), // ✅ always Int for Prisma
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

  async createPlayer(username: string, password?: string) {
    // Orion requires account to be 6–32 characters
    if (username.length < 6 || username.length > 32) {
      throw new AppError(
        `Username "${username}" must be 6–32 characters (received ${username.length})`,
        400,
      );
    }

    await this.makeRequest('registerUser', {
      account: username,
      passwd:  this.md5(password || 'Test@1234'),
    });

    return { userId: username, accountName: username };
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
    // agentBalance is returned by agentLogin — no extra API call needed
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
    // Orion has no force-offline endpoint — silently succeed
    console.warn(`[Orionstar] forcePlayerOffline is not supported by this provider. userId=${userId}`);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    return username; // Orion uses the account name as the stable ID
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
