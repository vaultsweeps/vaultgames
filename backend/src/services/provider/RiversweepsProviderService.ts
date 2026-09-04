import axios, { AxiosInstance } from 'axios';
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
        const errMsg = data.data?.message || data.message || data.MSG || 'Unknown provider error';
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
    // Riversweeps uses the 'code' itself as the login for players, so there is no password to reset.
    return true;
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
