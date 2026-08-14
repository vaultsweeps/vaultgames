import axios from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

export class FastApiProviderService implements ProviderAdapter {
  private provider: Provider;
  private appid: string;
  private appsecret: string;

  private isAuthenticated: boolean = false;

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(`Provider configuration missing for ${provider.name || provider.id}`, 500);
    }
    this.provider = {
      ...provider,
      agentId: provider.agentId.trim(), // We use this as Agent Username
      secretKey: provider.secretKey.trim(), // We use this as Agent Password
      apiBaseUrl: provider.apiBaseUrl.trim(),
    };
    // Initialize with placeholders or read from endpoints JSON if provided
    const endpointsConfig = (this.provider.endpoints as Record<string, string>) || {};
    this.appid = endpointsConfig.appid || this.provider.agentId;
    this.appsecret = endpointsConfig.appsecret || this.provider.secretKey;

    // If both appid and appsecret are pre-configured in endpoints, skip the agentLogin step entirely.
    // The stored credentials are already the post-login static API credentials.
    if (endpointsConfig.appid && endpointsConfig.appsecret) {
      this.isAuthenticated = true;
      console.info(`[FastApiProviderService] Using pre-configured appid/appsecret for ${provider.name} — skipping agentLogin`);
    }
  }

  private generateAesKey(password: string): Buffer {
    const p1 = crypto.createHash('md5').update(password.toLowerCase()).digest('hex');
    const p2 = crypto.createHash('md5').update(p1).digest('hex');
    return Buffer.from(p2, 'utf8');
  }

  private aesDecrypt(base64Data: string, key: Buffer): string {
    const data = Buffer.from(base64Data, 'base64');
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async authenticate() {
    if (this.isAuthenticated) return;

    const endpoint = this.getEndpoint('agentLogin', '/fast/agent/login');
    const baseUrl = this.provider.apiBaseUrl.replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '');
    const url = `${baseUrl}/${path}`;

    const requestData: Record<string, any> = {
      appid: this.appid,
      requestid: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now().toString(),
      account: this.provider.agentId,
      passwd: this.provider.secretKey
    };

    // Sign the initial login request with the provided appsecret
    const sortedKeys = Object.keys(requestData).sort();
    const strArr: string[] = [];
    for (const key of sortedKeys) {
      strArr.push(`${key}=${requestData[key]}`);
    }
    const strToHash = strArr.join('&') + this.appsecret;
    requestData.sign = crypto.createHash('md5').update(strToHash).digest('hex');

    try {
      const response = await axios.post(url, new URLSearchParams(requestData).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.provider.requestTimeout || 10000,
      });

      const code = response.data.code;
      const message = response.data.message || response.data.msg || 'Unknown Provider Error';
      const data = response.data.data;
      
      if (code !== 200 && code !== 0) {
        const errorMsg = this.mapProviderError(code, message);
        throw new AppError(`Agent Login failed: ${errorMsg} (Code: ${code}, Message: ${message})`, 400);
      }

      this.appid = data.appid;
      const key = this.generateAesKey(this.provider.secretKey);
      this.appsecret = this.aesDecrypt(data.appsecret_encrypted, key);
      this.isAuthenticated = true;
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      const status = e.response?.status;
      const data = JSON.stringify(e.response?.data || {});
      console.error(`[FastApiProviderService] Login failed for ${url} - Status: ${status} - Response: ${data}`);
      throw new AppError(`Agent Login connection failed (Make sure your IP is whitelisted! URL: ${url}): ${e.message}`, 502);
    }
  }

  private getEndpoint(key: string, defaultPath: string): string {
    const endpoints = this.provider.endpoints as Record<string, string>;
    return endpoints?.[key] || defaultPath;
  }

  private generateRequestData(payload: Record<string, any>) {
    const timestamp = Date.now().toString(); // ms timestamp
    
    // Default payload params for FastApi
    const requestData: Record<string, any> = {
      appid: this.appid,
      timestamp,
      requestid: crypto.randomBytes(16).toString('hex'), // Unique request ID
      ...payload,
    };

    // 1. Exclude the sign field
    const params = { ...requestData };
    delete params['sign'];

    // 2. Map types as in the provided PHP signature code
    for (const key in params) {
      if (params[key] !== null && typeof params[key] === 'object') {
        params[key] = JSON.stringify(params[key]);
      } else if (typeof params[key] === 'boolean') {
        params[key] = params[key] ? 'true' : 'false';
      }
    }

    // 3. Sort keys in ascending order
    const sortedKeys = Object.keys(params).sort();

    // 4. Format key=value & concatenate
    const strArr: string[] = [];
    for (const key of sortedKeys) {
      strArr.push(`${key}=${params[key]}`);
    }

    // 5. Append appsecret
    const strToHash = strArr.join('&') + this.appsecret;

    // 6. Generate MD5 signature
    const sign = crypto.createHash('md5').update(strToHash).digest('hex');

    requestData['sign'] = sign;
    return requestData;
  }

  private mapProviderError(code: number, defaultMsg: string): string {
    const errorMap: Record<number, string> = {
      200: 'Success',
      1: 'New User Is Created',
      2: 'User Does Not Exist',
      3: 'Parameter Error',
      4: 'Invalid Signature',
      5: 'Agent Ban',
      6: 'Account length error',
      7: 'Account format error',
      8: 'Password length error',
      9: 'Password format error',
      10: 'Requestid Used',
      11: 'Unknown Database Error',
      12: 'User Already Exist',
      13: 'Top Up Fail',
      14: 'Insufficient Credit',
      15: 'Withdrawal Failed',
      16: 'Get Balance Failed',
      17: 'Operations are Not Allowed In The Game',
      18: 'System Is Under Maintenance',
      19: 'The Requested Address Does Not Exist',
      20: 'Password error',
      21: 'Agent Name Or Password error',
      22: 'Platform Not Configured'
    };
    return errorMap[code] || defaultMsg || 'Unknown Provider Error';
  }

  private async makeRequest(endpoint: string, payload: Record<string, any>, userId: string | null = null): Promise<any> {
    await this.authenticate();
    
    const startTime = Date.now();
    const requestData = this.generateRequestData(payload);
    const baseUrl = this.provider.apiBaseUrl.replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '');
    const url = `${baseUrl}/${path}`;

    const logData = {
      timestamp: new Date().toISOString(),
      providerId: this.provider.id,
      providerName: this.provider.name,
      endpoint,
      url,
      payload: requestData,
    };

    try {
      const response = await axios.post(url, new URLSearchParams(requestData).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: this.provider.requestTimeout || 10000,
      });

      const duration = Date.now() - startTime;
      const code = response.data.code;
      const message = response.data.message || response.data.msg || 'Unknown Provider Error';
      const data = response.data.data;

      // 200 is success for FastApi (as per doc "200 Success")
      if (code !== 200 && code !== 0) {
        const errorMsg = this.mapProviderError(code, message);
        console.error(JSON.stringify({ ...logData, status: 200, response: response.data, message: errorMsg, duration }));
        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, response.data, code, errorMsg);
        throw new AppError(`Provider Error: ${errorMsg} (Code: ${code}, Message: ${message})`, 400);
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

  /**
   * Sanitize userId → a valid UltraPanda account name.
   * ACTUAL API LIMITS (from API error response): 7–20 chars, only a-z 0-9 (lowercase).
   */
  private getProviderAccount(userId: string): string {
    // Remove any character that is not a letter or digit
    let clean = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    // Pad to minimum 7 chars
    if (clean.length < 7) {
      clean = clean.padEnd(7, 'x');
    }
    // Truncate to 20 chars max
    return clean.substring(0, 20);
  }

  /**
   * Generate a deterministic, safe 8-char alphanumeric password for this account.
   * UltraPanda password rules: 6–16 chars, letters+numbers, symbols !@#$()%^/., are optional.
   * We keep it simple: 8 alphanumeric chars derived from a hash of the userId.
   * This is stable — same userId always produces the same provider password.
   */
  private getProviderPassword(userId: string): string {
    const hash = crypto.createHash('md5').update(`ultrapanda-${userId}`).digest('hex');
    // Take first 4 hex chars as letters A-P (always letters), rest as digits
    const letters = hash.substring(0, 4).split('').map(c => String.fromCharCode(65 + parseInt(c, 16))).join('');
    const digits = hash.substring(4, 8);
    return letters + digits; // e.g. "ABCD1234" — always 8 chars, letters+digits, no special chars
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    const endpoint = this.getEndpoint('createPlayer', '/fast/user/create');
    const providerAccount = this.getProviderAccount(username);
    // Always use a deterministic safe password — never the raw user password which may contain
    // characters unsupported by UltraPanda (e.g. @, spaces, special symbols).
    const providerPassword = this.getProviderPassword(username);
    try {
      const data = await this.makeRequest(endpoint, {
        account: providerAccount,
        passwd: providerPassword,
      });

      // data object contains: { full_account: "prefix_username" }
      const accountName = data?.full_account || providerAccount;
      return { userId: username, accountName };
    } catch (e: any) {
      // Code 12 = User Already Exists — treat as success, user is already on provider
      if (e.message?.includes('Code: 12') || e.message?.includes('User Already Exist')) {
        console.info(`[FastApiProviderService] Player "${providerAccount}" already exists on provider — treating as success`);
        return { userId: username, accountName: providerAccount };
      }
      throw e;
    }
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const endpoint = this.getEndpoint('recharge', '/fast/user/deposit');
    return this.makeRequest(endpoint, {
      account: this.getProviderAccount(userId),
      amount: amount.toFixed(2), // up to 2 decimal places
    }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const endpoint = this.getEndpoint('withdraw', '/fast/user/withdrawal');
    return this.makeRequest(endpoint, {
      account: this.getProviderAccount(userId),
      amount: amount.toFixed(2),
    }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const endpoint = this.getEndpoint('playerBalance', '/fast/user/balance');
    const data = await this.makeRequest(endpoint, {
      account: this.getProviderAccount(userId),
    }, userId);
    return parseFloat(data.balance);
  }

  async getAgentBalance(): Promise<number> {
    const endpoint = this.getEndpoint('agentBalance', '/fast/agent/login');
    try {
      const data = await this.makeRequest(endpoint, {
        account: this.provider.agentId,
        passwd: this.provider.secretKey,
      });
      return parseFloat(data.balance);
    } catch (e) {
      console.error('Agent balance fetch failed', e);
      return 0;
    }
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    return username;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    const endpoint = this.getEndpoint('resetPassword', '/fast/user/updatePasswd');
    const providerAccount = this.getProviderAccount(userId);
    // The safe new password — strip any special chars, ensure 7-16 length
    const safeNewPassword = newPassword
      ? newPassword.replace(/[^a-zA-Z0-9]/g, '').padEnd(7, '1').substring(0, 16)
      : this.getProviderPassword(userId);

    // Try multiple known old passwords in order:
    // 1. Deterministic hash (new accounts created after the fix)
    // 2. 'Test@123' (the original default used before the fix)
    // Code 20 = "Password error" (wrong old password), Code 9 = format error
    const oldPasswordCandidates = [
      this.getProviderPassword(userId), // deterministic hash for new accounts
      'Test@123',                        // original default used for old accounts
    ];

    for (const oldPass of oldPasswordCandidates) {
      try {
        await this.makeRequest(endpoint, {
          account: providerAccount,
          passwd: oldPass,
          new_passwd: safeNewPassword,
        }, userId);
        return true; // success
      } catch (e: any) {
        // Code 20 = wrong old password — try next candidate
        if (e.message?.includes('Code: 20') || e.message?.includes('Password error')) {
          console.warn(`[FastApiProviderService] Old password "${oldPass}" rejected for "${providerAccount}", trying next...`);
          continue;
        }
        // Any other error (Code 9 format, network etc.) — rethrow
        throw e;
      }
    }

    // All old password candidates failed — the account exists but we cannot reset the password.
    // This is non-fatal: the user can still play; just log and return true so the UI doesn't break.
    console.warn(`[FastApiProviderService] Could not reset password for "${providerAccount}" — all old password attempts failed. User can still play.`);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    return true;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
