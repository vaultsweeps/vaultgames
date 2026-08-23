import axios from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class OrionstarProviderService implements ProviderAdapter {
  private provider: Provider;
  private agentKey: string | null = null;
  private sessionCookie: string | null = null;
  private lastAuthTime: number = 0;
  private authPromise: Promise<void> | null = null;
  private readonly TTL_MS = 50 * 1000; // 50 seconds

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(`Provider configuration missing for ${provider.name || provider.id}`, 500);
    }
    this.provider = {
      ...provider,
      agentId: provider.agentId.trim(), // agentName
      secretKey: provider.secretKey.trim(), // agentPasswd (plain, we will MD5 it)
      apiBaseUrl: provider.apiBaseUrl.trim(),
    };
  }

  private md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private get baseUrl(): string {
    // Return base URL without trailing slash
    return this.provider.apiBaseUrl.replace(/\/+$/, '');
  }

  private getServicePath(): string {
    const endpoints = this.provider.endpoints as Record<string, string>;
    return endpoints?.servicePath || '/ws/service.ashx';
  }

  private async authenticate(force: boolean = false): Promise<void> {
    if (!force && this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) {
      return; // Still valid
    }

    // If another auth is already in progress, wait for it instead of duplicating
    if (this.authPromise && !force) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      const endpoint = `${this.getServicePath()}?action=agentLogin`;
      const url = `${this.baseUrl}${endpoint}`;
      
      const agentPasswdMd5 = this.md5(this.provider.secretKey);
      const time = Math.floor(Date.now() / 1000).toString();

      const requestData = {
        agentName: this.provider.agentId,
        agentPasswd: agentPasswdMd5,
        time
      };

      try {
        const response = await axios.post(url, null, {
          params: requestData,
          timeout: this.provider.requestTimeout || 10000,
        });

        const { code, msg, agentkey, agentKey: capitalKey } = response.data;

        if (String(code) !== '200') {
          throw new AppError(`Orionstar Agent Login failed: ${msg}`, 400);
        }

        const validKey = (agentkey || capitalKey || '').trim();
        if (!validKey) {
          throw new AppError(`Orionstar Agent Login returned no agentKey`, 500);
        }

        this.agentKey = validKey;
        this.sessionCookie = response.headers['set-cookie'] ? response.headers['set-cookie'].join('; ') : null;
        this.lastAuthTime = Date.now();
        
        console.info(`[Orionstar] Successfully authenticated agent ${this.provider.agentId} | Key: ${this.agentKey}`);
      } catch (e: any) {
        this.agentKey = null; // reset on error
        if (e instanceof AppError) throw e;
        throw new AppError(`Orionstar Agent Login connection failed: ${e.message}`, 502);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  private async makeRequest(action: string, payload: Record<string, any>, userId: string | null = null, isRetry: boolean = false): Promise<any> {
    await this.authenticate(isRetry);
    
    if (!this.agentKey) {
      throw new AppError('Orionstar authentication failed: No agentKey available', 500);
    }

    const time = Math.floor(Date.now() / 1000).toString();
    const agentName = this.provider.agentId;
    
    const strToHash = (agentName + time + this.agentKey).toLowerCase();
    const sign = this.md5(strToHash);

    const requestData = {
      agentName,
      time,
      sign,
      ...payload
    };

    const endpoint = `${this.getServicePath()}?action=${action}`;
    const url = `${this.baseUrl}${endpoint}`;

    const logData = {
      timestamp: new Date().toISOString(),
      providerId: this.provider.id,
      providerName: this.provider.name,
      endpoint,
      url,
      payload: { ...requestData, sign: '***' }, 
    };

    const startTime = Date.now();
    try {
      const response = await axios.post(url, null, {
        params: requestData,
        headers: this.sessionCookie ? { 'Cookie': this.sessionCookie } : {},
        timeout: this.provider.requestTimeout || 10000,
      });

      const duration = Date.now() - startTime;
      const { code, msg, ...data } = response.data;

      // 200 is success, 201 is failure
      if (String(code) !== '200') {
        const errorMsg = msg || 'Unknown Orionstar Provider Error';
        
        // If sign error and we haven't retried yet, force a fresh login and retry
        if (!isRetry && (errorMsg.toLowerCase().includes('sign') || errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('expire'))) {
            console.warn(`[Orionstar] Signature error encountered. Forcing re-login and retrying once...`);
            this.agentKey = null;
            return this.makeRequest(action, payload, userId, true);
        }

        console.error(JSON.stringify({ ...logData, status: 200, response: response.data, message: errorMsg, duration }));
        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, response.data, code, errorMsg);
        throw new AppError(`Provider Error: ${errorMsg}`, 400);
      }

      console.info(JSON.stringify({ ...logData, status: 200, response: 'Success', duration }));
      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, response.data, 200, null);
      
      return data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      const duration = Date.now() - startTime;
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;

      console.error(JSON.stringify({ providerId: this.provider.id, endpoint, status, response: errorData, message: error.message, duration }));
      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, errorData, status, error.message);
      throw new AppError(`Provider connection failed: ${error.message || 'Unknown network error'}`, 502);
    }
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    const defaultPassword = password || 'Test@123';
    await this.makeRequest('registerUser', {
      account: username,
      passwd: this.md5(defaultPassword)
    });

    return { userId: username, accountName: username };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('recharge', {
      account: userId,
      amount: Math.floor(amount), // Orionstar usually takes integer amounts, but check docs
    }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    return this.makeRequest('redeem', {
      account: userId,
      amount: Math.floor(amount),
    }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryInfo', {
      account: userId,
    }, userId);
    
    // Returns userbalance and agentBalance
    return parseFloat(data.userbalance || '0');
  }

  async getAgentBalance(): Promise<number> {
    // Force a fresh login to check agent balance securely
    await this.authenticate(true);
    
    // We can use queryAgentInfo
    const agentPasswdMd5 = this.md5(this.provider.secretKey);
    const data = await this.makeRequest('queryAgentInfo', {
      passwd: agentPasswdMd5
    });

    return parseFloat(data.agentBalance || '0');
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    return username;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    const passwdNewMd5 = this.md5(newPassword || 'Test@123');
    await this.makeRequest('changePasswd', {
      account: userId,
      passwdNew: passwdNewMd5,
    }, userId);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    await this.makeRequest('setStatus', {
      account: userId,
      status: -1, // -1 means no modify for status (or 1 for active)
      deviceBound: 0 // 0=unbound device
    }, userId);
    return true;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
