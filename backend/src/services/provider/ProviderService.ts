import axios from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

type TimestampFormat = 'ms' | 's';

export class ProviderService implements ProviderAdapter {
  private provider: Provider;

  // Remembers which timestamp format (ms vs seconds) actually worked for a
  // given provider, so we don't have to retry on every single call once
  // we've figured it out once. In-memory only (resets on process restart) —
  // once you confirm which format works, hardcode it via getTimestampFormat()
  // below instead of relying on this cache.
  private static timestampFormatCache = new Map<string, TimestampFormat>();

  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(`Provider configuration missing for ${provider.name || provider.id}`, 500);
    }

    // Defensive trim: a stray trailing newline/space on agentId or secretKey
    // (very common when these come from .env files or copy-pasted into a DB)
    // silently changes the MD5 hash and produces "Invalid Token" every time.
    this.provider = {
      ...provider,
      agentId: provider.agentId.trim(),
      secretKey: provider.secretKey.trim(),
      apiBaseUrl: provider.apiBaseUrl.trim(),
    };
  }

  private getEndpoint(key: string, defaultPath: string): string {
    const endpoints = this.provider.endpoints as Record<string, string>;
    return endpoints?.[key] || defaultPath;
  }

  /**
   * If you've confirmed (via logs, or the auto-retry below) which format
   * the provider actually wants, hardcode it here and you can remove the
   * retry logic entirely. Until then, defaults to 'ms' per the doc's prose
   * ("13-digit timestamp"), even though the doc's own example value
   * (1709867667) is only 10 digits / seconds-based — hence the fallback.
   */
  private getDefaultTimestampFormat(): TimestampFormat {
    return ProviderService.timestampFormatCache.get(this.provider.id) || 'ms';
  }

  private generateAuthParams(format: TimestampFormat) {
    const timestamp =
      format === 's'
        ? Math.floor(Date.now() / 1000).toString() // 10-digit seconds
        : Date.now().toString(); // 13-digit milliseconds

    const strToHash = `${this.provider.agentId}:${timestamp}:${this.provider.secretKey}`;
    const token = crypto.createHash('md5').update(strToHash).digest('hex').toLowerCase();

    console.info('=== PROVIDER AUTHENTICATION DEBUG ===');
    console.info(`Agent ID: ${this.provider.agentId}`);
    console.info(`Timestamp format: ${format}`);
    console.info(`Timestamp: ${timestamp}`);
    console.info(`String before hashing: ${strToHash}`);
    console.info(`Generated Token: ${token}`);
    console.info('=====================================');

    return {
      agent_id: this.provider.agentId,
      timestamp,
      token,
    };
  }

  private mapProviderError(code: number): string {
    const errorMap: Record<number, string> = {
      1: 'Invalid Agent ID',
      2: 'Invalid Request Parameters',
      3: 'Invalid Token',
      4: 'Token Expired',
      5: 'Access IP Not Whitelisted',
      6: 'Insufficient Agent Balance',
      7: 'Insufficient User Balance',
      8: 'Invalid User ID',
      9: 'User Account Frozen',
      10: 'User In Game',
      11: 'Invalid Amount',
      12: 'Recharge Failed',
      13: 'Recharge Permission Denied',
      14: 'Withdrawal Failed',
      15: 'Withdrawal Daily Limit Exceeded',
      16: 'Withdrawal Under Review',
      17: 'Withdrawal Permission Denied',
      18: 'Invalid Username Format',
      19: 'Agent Has No Registration Permission',
      20: 'Username Already Exists',
      21: 'System Failure',
      22: 'Registration IP Limit Exceeded',
      23: 'Password Must Be 6-32 Characters',
      400: 'Parameter Error',
    };
    return errorMap[code] || 'Unknown Provider Error';
  }

  /**
   * Performs a single raw attempt against the provider with a specific
   * timestamp format. Does not throw on a provider-level error code (3/4/etc) —
   * it returns the code so the caller can decide whether to retry with the
   * other timestamp format. Still throws on actual network/transport failure.
   */
  private async attemptRequest(
    endpoint: string,
    payload: any,
    format: TimestampFormat,
    userId: string | null,
    startTime: number,
  ): Promise<{ code: number; msg: string; data: any; raw: any; requestData: any }> {
    const authParams = this.generateAuthParams(format);
    const requestData = { ...authParams, ...payload };
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

    const response = await axios.postForm(url, requestData, {
      timeout: this.provider.requestTimeout || 5000,
    });

    const duration = Date.now() - startTime;
    const { code, msg, data, ...rest } = response.data;

    if (code !== undefined && code !== 0) {
      const errorMsg = this.mapProviderError(code);
      console.error(JSON.stringify({ ...logData, status: 200, response: response.data, message: errorMsg, duration }));
      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, response.data, code, errorMsg);
      return { code, msg: errorMsg, data: data || rest, raw: response.data, requestData };
    }

    console.info(JSON.stringify({ ...logData, status: 200, response: 'Success', duration }));
    await ProviderLogService.logRequest(this.provider.id, userId, endpoint, requestData, response.data, 200, null);
    return { code: 0, msg, data: data || rest || response.data, raw: response.data, requestData };
  }

  private async makeRequest(endpoint: string, payload: any, userId: string | null = null): Promise<any> {
    const startTime = Date.now();
    const primaryFormat = this.getDefaultTimestampFormat();

    try {
      let result = await this.attemptRequest(endpoint, payload, primaryFormat, userId, startTime);

      // Codes 3 (Invalid Token) and 4 (Token Expired) are exactly the two
      // symptoms of sending the timestamp in the wrong unit. Auto-retry once
      // with the other format before giving up.
      if (result.code === 3 || result.code === 4) {
        const altFormat: TimestampFormat = primaryFormat === 'ms' ? 's' : 'ms';
        console.warn(
          `[ProviderService] "${result.msg}" with '${primaryFormat}' timestamp on ${endpoint}. Retrying once with '${altFormat}'...`,
        );

        const retryResult = await this.attemptRequest(endpoint, payload, altFormat, userId, startTime);

        if (retryResult.code === 0) {
          console.warn(
            `[ProviderService] Retry succeeded with '${altFormat}' timestamp format for provider ${this.provider.id}. ` +
            `Caching this for future requests — consider hardcoding it in getDefaultTimestampFormat().`,
          );
          ProviderService.timestampFormatCache.set(this.provider.id, altFormat);
          return retryResult.data;
        }

        // Both formats failed — it's a genuine token/credential problem,
        // not a units problem. Surface the original error.
        result = retryResult;
      }

      if (result.code !== 0) {
        throw new AppError(`Provider Error: ${result.msg}`, 400);
      }

      return result.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      const duration = Date.now() - startTime;
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;

      console.error(JSON.stringify({ providerId: this.provider.id, endpoint, status, response: errorData, message: error.message, duration }));
      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, payload, errorData, status, error.message);
      throw new AppError(`Provider connection failed: ${error.message || 'Unknown network error'}`, 502);
    }
  }

  /**
   * Sanitize a username so it passes provider constraints:
   *   - Only letters, digits, and underscores  ([a-zA-Z0-9_])
   *   - 3–20 characters
   *
   * Always appends a 4-char random suffix when the username needed modification,
   * guaranteeing a valid unique account name regardless of player input.
   */
  private sanitizeUsername(username: string): string {
    const RESERVED = new Set([
      'admin', 'root', 'test', 'user', 'guest', 'system', 'support',
      'superadmin', 'administrator', 'mod', 'moderator', 'staff',
    ]);

    const randomSuffix = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };

    const base = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const wasModified = base !== username.toLowerCase();
    const needsSuffix =
      !base ||
      base.length < 6 ||
      RESERVED.has(base) ||
      wasModified;

    let safe: string;
    if (needsSuffix) {
      const trimmedBase = (base || 'u').substring(0, 15);
      safe = trimmedBase + randomSuffix();
    } else {
      safe = base;
    }

    if (safe.length < 6) safe = safe.padEnd(6, '0');
    return safe.substring(0, 20);
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    const endpoint = this.getEndpoint('createPlayer', '/api/external/addUser');
    const safeUsername = this.sanitizeUsername(username);
    if (safeUsername !== username) {
      console.info(`[ProviderService:${this.provider.name}] Username sanitized: "${username}" → "${safeUsername}"`);
    }
    const data = await this.makeRequest(endpoint, {
      account: safeUsername,
      login_pwd: password || 'Default123!',
    });

    const userId = data?.user_id || `usr_${safeUsername}`;
    const accountName = data?.account_name || safeUsername;

    if (!userId) {
      throw new AppError('Provider failed to return a valid player ID', 502);
    }

    return { userId, accountName };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const endpoint = this.getEndpoint('recharge', '/api/external/recharge');
    return this.makeRequest(endpoint, {
      user_id: userId,
      amount: amount.toString(),
      order_id: orderId,
    }, userId);
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const endpoint = this.getEndpoint('withdraw', '/api/external/withdraw');
    return this.makeRequest(endpoint, {
      user_id: userId,
      amount: amount.toString(),
      order_id: orderId,
    }, userId);
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const endpoint = this.getEndpoint('playerBalance', '/api/external/userBalance');
    const data = await this.makeRequest(endpoint, {
      user_id: userId,
    }, userId);
    return parseFloat(data.user_balance);
  }

  async getAgentBalance(): Promise<number> {
    const endpoint = this.getEndpoint('agentBalance', '/api/external/agentBalance');
    const data = await this.makeRequest(endpoint, {});
    return parseFloat(data.agent_balance);
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    const endpoint = this.getEndpoint('getPlayerId', '/api/external/getUserID');
    const data = await this.makeRequest(endpoint, {
      account_name: username,
    });
    return data.user_id;
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    const endpoint = this.getEndpoint('resetPassword', '/api/external/resetPassword');
    await this.makeRequest(endpoint, {
      user_id: userId,
      login_pwd: newPassword || 'Default123!',
    }, userId);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    const endpoint = this.getEndpoint('forceOffline', '/api/external/playerOffline');
    await this.makeRequest(endpoint, {
      user_id: userId,
    }, userId);
    return true;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}