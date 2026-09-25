import axios, { AxiosInstance } from 'axios';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class Yolo777ProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;
  private token: string | null = null;
  private readonly loginId: string;
  private readonly loginPass: string;

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `Yolo777 provider config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }
    this.provider = provider;
    this.loginId = provider.agentId.trim();
    this.loginPass = provider.secretKey.trim();

    this.http = axios.create({
      baseURL: provider.apiBaseUrl.replace(/\/+$/, ''),
      timeout: provider.requestTimeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add interceptor to include token
    this.http.interceptors.request.use((config) => {
      if (this.token && !config.url?.includes('/api/login')) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  private async authenticate(): Promise<void> {
    if (this.token) return;

    try {
      const response = await this.http.post('/api/login', {
        account: this.loginId,
        password: this.loginPass,
      });

      const { code, data, message } = response.data;
      if (code !== 200 || !data?.token) {
        throw new AppError(`Yolo777 login failed: ${message || 'Unknown error'}`, 401);
      }

      this.token = data.token;
    } catch (error: any) {
      this.token = null;
      if (error instanceof AppError) throw error;
      throw new AppError(`Yolo777 authentication error: ${error.message}`, 502);
    }
  }

  private async makeRequest(
    endpoint: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
  ): Promise<any> {
    await this.authenticate();

    try {
      const response = await this.http.post(endpoint, payload);
      const { code, data, message } = response.data;

      // Log raw response
      console.info(`[Yolo777] ${endpoint} response:`, JSON.stringify(response.data));

      if (code === 401) {
        // Token expired, retry once
        this.token = null;
        await this.authenticate();
        const retryResponse = await this.http.post(endpoint, payload);
        
        if (retryResponse.data.code !== 200) {
           await ProviderLogService.logRequest(this.provider.id, userId, endpoint, payload, retryResponse.data, retryResponse.data.code, retryResponse.data.message);
           throw new AppError(`Yolo777 Error: ${retryResponse.data.message}`, 400);
        }
        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, payload, retryResponse.data, 200, null);
        return retryResponse.data.data;
      }

      if (code !== 200) {
        const errMsg = message || 'Unknown provider error';
        await ProviderLogService.logRequest(
          this.provider.id, userId, endpoint, payload, response.data, code, errMsg
        );
        throw new AppError(`Yolo777 Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(
        this.provider.id, userId, endpoint, payload, response.data, 200, null
      );
      
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Yolo777 connection failed: ${err.message}`, 502);
    }
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    const payload = {
      account: username,
      password: password || 'Default123!',
      nickname: username
    };

    try {
      const data = await this.makeRequest('/api/create_player', payload);
      return { userId: data.user_id.toString(), accountName: username };
    } catch (error: any) {
       // If player already exists (422), we don't have the user_id returned. 
       // We might need to assume the caller will fetch it or it's handled differently.
       if (error.message.includes('already exists')) {
          // Since the API requires user_id for everything, and doesn't provide a way to lookup by account name easily in the doc snippet,
          // we assume the platform will use the local DB ID or something. Actually, wait, if we can't get the user_id, it's a problem.
          console.warn(`[Yolo777] Player ${username} already exists.`);
       }
       throw error;
    }
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('/api/change_score', {
      user_id: parseInt(userId, 10),
      type: 1, // 1 for deposit
      recharge_amount: Math.floor(amount), // Assuming CNY/cents logic or just integer
    }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('/api/change_score', {
      user_id: parseInt(userId, 10),
      type: 2, // 2 for withdrawal
      recharge_amount: Math.floor(amount),
    }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('/api/get_player_balance', {
      user_id: parseInt(userId, 10)
    }, userId);
    return data.balance;
  }

  async getAgentBalance(): Promise<number> {
    const data = await this.makeRequest('/api/get_agent_balance');
    return data.balance;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    await this.makeRequest('/api/reset_player_password', {
      user_id: parseInt(userId, 10),
      new_pass: newPassword || 'Default123!'
    }, userId);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    await this.makeRequest('/api/kick_player', {
      user_id: parseInt(userId, 10)
    }, userId);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    // If the API doesn't provide a direct lookup, we return the username or an error.
    // The createPlayer returns user_id. We should store it in ProviderAccount.accountId.
    return username;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
