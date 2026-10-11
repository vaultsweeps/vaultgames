import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * RiversweepsProviderService
 *
 * Implements Riversweeps API based on official documentation.
 * Base URL: http://river-pay.com/api/
 * 
 * Authentication uses query parameters: `login` (Agent ID) and `password` (Secret Key).
 */
export class RiversweepsProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;
  private readonly login: string;
  private readonly password: string;

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Riversweeps provider config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }
    this.provider = provider;
    this.login = provider.agentId.trim();
    this.password = provider.secretKey.trim();

    this.http = axios.create({
      baseURL: provider.apiBaseUrl.replace(/\/+$/, ''),
      timeout: provider.requestTimeout || 10000,
      // River-Pay only accepts calls from allow-listed (IPv4) addresses. On a host with IPv6 Node can
      // pick an IPv6 route, which shows up to River-Pay as an address that was never whitelisted.
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({ family: 4 }),
    });
  }

  private async makeRequest(
    action: string,
    params: Record<string, any> = {},
    userId: string | null = null,
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    searchParams.append('login', this.login);
    searchParams.append('password', this.password);
    
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }

    const endpoint = `/api/${action}?${searchParams.toString()}`;
    const startTime = Date.now();
    const logEndpoint = `/api/${action}`; // Mask secrets in DB endpoint path

    try {
      const response = await this.http.get(endpoint);
      const data = response.data;

      // Log raw response for debugging
      console.info(`[Riversweeps] ${action} raw response:`, JSON.stringify(data));

      // STATUS: 0 = success, 1 = error. Handle both string and numeric.
      const status = Number(data?.STATUS);
      if (data !== undefined && status !== 0) {
        // River-Pay's messages can carry HTML tags (e.g. "<b>00-00…</b>"): show plain text
        const errMsg = String(data.data?.message || data.message || data.MSG || 'Unknown provider error').replace(/<[^>]*>/g, '');
        await ProviderLogService.logRequest(
          this.provider.id, userId, logEndpoint, params, data, 400, errMsg
        );
        throw new AppError(`Riversweeps Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(
        this.provider.id, userId, logEndpoint, params, data, 200, null
      );
      
      // Return data.data if it exists, otherwise the whole response
      return data?.data ?? data;

    } catch (err: any) {
      if (err instanceof AppError) throw err;
      const httpStatus = err?.response?.status;
      if (httpStatus === 401 || httpStatus === 403) {
        // Record what the refusal really looks like, so "IP not whitelisted" can be told apart from a firewall / wrong login /
        // blocked client. The request URL (which carries the login) is never logged, and the body snippet is scrubbed.
        const h: Record<string, any> = err?.response?.headers || {};
        const raw = typeof err?.response?.data === 'string' ? err.response.data : JSON.stringify(err?.response?.data ?? '');
        const snippet = String(raw).replace(/\s+/g, ' ').replace(/(login|password)=[^&"'\s<]*/gi, '$1=[hidden]').slice(0, 200);
        console.error(`[Riversweeps] HTTP ${httpStatus} on ${action}: server="${h['server'] || ''}" via="${h['via'] || ''}" cloudflare=${h['cf-ray'] ? 'yes' : 'no'} content-type="${h['content-type'] || ''}" body="${snippet}"`);
        const msg = `Access denied by River-Pay (HTTP ${httpStatus}). Their server refused the request — usually this server's IPv4 address is not on River-Pay's allowed-IP list (or a firewall in front of them blocks it).`;
        await ProviderLogService.logRequest(this.provider.id, userId, logEndpoint, params, null, httpStatus, msg).catch(() => {});
        // Players get a plain message; the detail above is for the server log and the admin provider log
        throw new AppError('This game is temporarily unavailable. Please try again in a little while.', 502);
      }
      throw new AppError(`Riversweeps connection failed: ${err.message}`, 502);
    }
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    // Riversweeps auto-generates a unique code (e.g. "28-18-06-62-19-99") for each player.
    // The user provides this code to log into the Riversweeps app.
    const res = await this.makeRequest('create', { amount: 0, bounceback: 0 });
    
    // Handle different possible field names in the response
    const code = res?.code || res?.CODE || res?.playerCode || res?.player_code || res?.id;
    
    if (!code) {
      console.error('[Riversweeps] createPlayer: no code in response:', JSON.stringify(res));
      throw new AppError('Riversweeps account created but no code returned', 500);
    }
    
    const codeStr = String(code);
    return { userId: codeStr, accountName: codeStr };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    // bounceback=0 for deposit
    return this.makeRequest('deposit', { code: userId, amount, bounceback: 0 }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('withdrawal', { code: userId, amount }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const res = await this.makeRequest('balance', { code: userId }, userId);
    return parseFloat(res.balance || '0');
  }

  async getAgentBalance(): Promise<number> {
    // Riversweeps does not provide an explicit agent balance endpoint in standard API docs.
    // Returning 0 so the dashboard doesn't crash.
    return 0; 
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    // Riversweeps uses the 'code' itself as the login for players, so there is no password to reset. Say so (false) rather
    // than "success", otherwise the site would store and show a made-up password that does not exist in the game.
    return false;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    // Not explicitly supported in the standard API (close account is supported, but we shouldn't delete users)
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    // For Riversweeps, the user is given a code, so they just input the code which acts as their username/id.
    // If we need to look it up, they should use the exact code.
    return username;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
