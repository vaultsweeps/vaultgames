import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class OrionstarProviderService implements ProviderAdapter {
  private provider: Provider;
  private agentKey: string | null = null;
  private agentBalance: number = 0;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;
  private readonly TTL_MS = 45 * 1000; // 45s — safely under 50s before stale
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

    // Shared axios instance — always sends Content-Length: 0 for empty POSTs (IIS requires it)
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
    const ep = this.provider.endpoints as Record<string, string>;
    return ep?.servicePath || '/ws/service.ashx';
  }

  // ONE login shared across all concurrent callers — no force re-login anywhere
  private async authenticate(): Promise<void> {
    if (this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) return;
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      const time = Math.floor(Date.now() / 1000).toString();
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
        if (String(code) !== '200') throw new AppError(`Orionstar login failed: ${msg}`, 400);

        const key = (agentkey || agentKeyAlt || '').trim();
        if (!key) throw new AppError('Orionstar login returned no agentKey', 500);

        this.agentKey     = key;
        this.agentBalance = parseFloat(balance || '0');
        this.lastAuthTime = Date.now();
        console.info(`[Orionstar] Authenticated | Agent: ${this.agentName} | Key: ${key}`);
      } catch (e: any) {
        this.agentKey = null;
        if (e instanceof AppError) throw e;
        throw new AppError(`Orionstar login failed: ${e.message}`, 502);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry: boolean = false,
  ): Promise<any> {
    await this.authenticate();
    if (!this.agentKey) throw new AppError('No agentKey available', 500);

    const time      = Math.floor(Date.now() / 1000).toString();
    const signInput = (this.agentName + time + this.agentKey).toLowerCase();
    const sign      = this.md5(signInput);

    const params = { agentName: this.agentName, time, sign, ...payload };
    const endpoint = `${this.servicePath}?action=${action}`;

    console.info(`[Orionstar] ${action} | signInput: ${signInput} | sign: ${sign}`);

    try {
      const res = await this.http.post(endpoint, null, { params });
      const { code, msg, ...data } = res.data;

      if (String(code) !== '200') {
        const errMsg = msg || 'Unknown error';

        // Only retry ONCE on signature errors — never on timeout (that's rate limiting)
        if (!isRetry && errMsg.toLowerCase().includes('signature')) {
          console.warn(`[Orionstar] Signature error on ${action} — refreshing session and retrying`);
          this.agentKey     = null;
          this.lastAuthTime = 0;
          await new Promise(r => setTimeout(r, 2000)); // avoid immediate rate-limit
          return this.makeRequest(action, payload, userId, true);
        }

        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, params, res.data, code, errMsg);
        throw new AppError(`Provider Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, params, res.data, 200, null);
      return data;

    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(`Provider connection failed: ${e.message}`, 502);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async createPlayer(username: string, password?: string) {
    await this.makeRequest('registerUser', {
      account: username,
      passwd:  this.md5(password || 'Test@123'),
    });
    return { userId: username, accountName: username };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest('recharge', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest('redeem', { account: userId, amount: Math.floor(amount) }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryInfo', { account: userId }, userId);
    return parseFloat(data.userbalance || '0');
  }

  async getAgentBalance(): Promise<number> {
    // Agent balance is returned by agentLogin — no extra API call needed
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

  async getPlayerIdByUsername(username: string): Promise<string> { return username; }

  getProviderId(): string { return this.provider.id; }
}
