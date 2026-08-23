import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * MilkyWay Terminal API v1.2.3
 * Base URL: https://milkywayapp.xyz:8033
 * Auth: agentLogin → agentKey (changes on every login; cached for TTL_MS)
 * Sign: md5(agentName + time + agentKey)  — all lowercase, millisecond timestamp
 * Rate limit: < 30 req/min for most endpoints, < 10 req/min for record queries
 */
export class MilkywayProviderService implements ProviderAdapter {
  private provider: Provider;
  private agentKey: string | null = null;
  private agentBalance: number = 0;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly http: AxiosInstance;

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(`Provider config missing for ${provider.name || provider.id}`, 500);
    }
    this.provider = {
      ...provider,
      agentId:    provider.agentId.trim(),
      secretKey:  provider.secretKey.trim(),
      apiBaseUrl: provider.apiBaseUrl.replace(/\/+$/, ''),
    };

    // IIS-backed .ashx endpoint requires Content-Length: 0 on empty POSTs
    this.http = axios.create({
      baseURL: this.provider.apiBaseUrl,
      timeout: this.provider.requestTimeout || 10000,
      headers: { 'Content-Length': '0' },
    });
  }

  private md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private get agentName(): string { return this.provider.agentId; }

  private get servicePath(): string {
    const ep = this.provider.endpoints as Record<string, string> | null;
    return ep?.servicePath || '/ws/service.ashx';
  }

  // Use milliseconds timestamp (Java System.currentTimeMillis() equivalent)
  private getTimestamp(): string {
    return Date.now().toString();
  }

  private isSessionError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes('session') ||
      lower.includes('timeout') ||
      lower.includes('expire') ||
      lower.includes('signature') ||
      lower.includes('invalid key') ||
      lower.includes('not logged')
    );
  }

  // ── Session Management ─────────────────────────────────────────────────────
  // ONE shared login per instance. Concurrent callers wait on the same Promise.

  private async authenticate(): Promise<void> {
    if (this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) return;
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      const time = this.getTimestamp();
      try {
        const res = await this.http.post(this.servicePath, null, {
          params: {
            action:      'agentLogin',
            agentName:   this.agentName,
            agentPasswd: this.md5(this.provider.secretKey),
            time,
          },
        });

        const { code, msg, agentkey, agentKey: agentKeyAlt, balance } = res.data;
        if (String(code) !== '200') throw new AppError(`MilkyWay login failed: ${msg}`, 400);

        const key = (agentkey || agentKeyAlt || '').trim();
        if (!key) throw new AppError('MilkyWay login returned no agentKey', 500);

        this.agentKey     = key;
        this.agentBalance = parseFloat(balance || '0');
        this.lastAuthTime = Date.now();
        console.info(`[MilkyWay] Authenticated | Agent: ${this.agentName} | Timestamp used: ${time}`);
      } catch (e: any) {
        this.agentKey     = null;
        this.lastAuthTime = 0;
        if (e instanceof AppError) throw e;
        throw new AppError(`MilkyWay login failed: ${e.message}`, 502);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  private forceReauth(): void {
    this.agentKey     = null;
    this.lastAuthTime = 0;
    this.authPromise  = null;
  }

  // ── Core Request ───────────────────────────────────────────────────────────

  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry: boolean = false,
  ): Promise<any> {
    await this.authenticate();
    if (!this.agentKey) throw new AppError('No agentKey available', 500);

    const time      = this.getTimestamp();
    // sign = md5(agentName + time + agentKey) — all converted to lowercase per docs
    const signInput = (this.agentName + time + this.agentKey).toLowerCase();
    const sign      = this.md5(signInput);

    const params   = { agentName: this.agentName, time, sign, ...payload };
    const endpoint = `${this.servicePath}?action=${action}`;

    console.info(`[MilkyWay] ${action} | time: ${time} | signInput: ${signInput}`);

    try {
      const res = await this.http.post(endpoint, null, { params });
      const { code, msg, ...data } = res.data;

      if (String(code) !== '200') {
        const errMsg = msg || 'Unknown MilkyWay error';

        // Retry ONCE on any session/auth error with a fresh session
        if (!isRetry && this.isSessionError(errMsg)) {
          console.warn(`[MilkyWay] Session/auth error on ${action} — re-authenticating...`);
          this.forceReauth();
          await new Promise(r => setTimeout(r, 1000));
          return this.makeRequest(action, payload, userId, true);
        }

        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, params, res.data, code, errMsg);
        throw new AppError(`Provider Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, params, res.data, 200, null);
      return data;

    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(`MilkyWay connection failed: ${e.message}`, 502);
    }
  }

  // ── Public API (ProviderAdapter) ───────────────────────────────────────────

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    await this.makeRequest('registerUser', {
      account: username,
      passwd:  this.md5(password || 'Test@123'),
    });
    return { userId: username, accountName: username };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('recharge', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('redeem', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryInfo', { account: userId }, userId);
    return parseFloat(data.userbalance || '0');
  }

  async getAgentBalance(): Promise<number> {
    await this.authenticate();
    return this.agentBalance;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    await this.makeRequest('changePasswd', {
      account:   userId,
      passwdNew: this.md5(newPassword || 'Test@123'),
    }, userId);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    console.warn(`[MilkyWay] forcePlayerOffline not supported. userId=${userId}`);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> { return username; }

  getProviderId(): string { return this.provider.id; }
}
