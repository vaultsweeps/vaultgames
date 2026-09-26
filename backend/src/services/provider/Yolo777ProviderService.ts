import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * Yolo777 / G7S merchant API (see API_DOC_G7S).
 *  - POST /api/login {username, password} -> { code: 200, userinfo: { AgentID, AgentAccount, Score }, token }
 *  - every other call: JSON body + `Authorization: Bearer <token>`
 *  - failures come back as HTTP 422/429/500 with { code, message }
 */
export class Yolo777ProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;
  private token: string | null = null;
  private agentUserId: number | null = null;
  private agentScore: number | null = null;
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

    // Paths below already start with /api, so tolerate a base URL saved with a trailing /api.
    const baseURL = provider.apiBaseUrl.trim().replace(/\/+$/, '').replace(/\/api$/i, '');

    this.http = axios.create({
      baseURL,
      timeout: provider.requestTimeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Read the provider's own error body (422 etc.) instead of a bare "status code 4xx".
      validateStatus: () => true,
      maxRedirects: 0,
    });
  }

  /**
   * POST JSON. If the server redirects (e.g. http -> https), re-send the same body to the new
   * location — axios would otherwise turn the POST into a body-less GET.
   */
  private async send(path: string, payload: Record<string, any>, withAuth: boolean): Promise<AxiosResponse> {
    const headers: Record<string, string> = {};
    if (withAuth && this.token) headers.Authorization = `Bearer ${this.token}`;

    let target = path;
    for (let hop = 0; hop < 4; hop++) {
      const res = await this.http.post(target, payload, { headers });
      const location = res.headers?.location;
      if (res.status >= 300 && res.status < 400 && location) {
        const base = `${this.http.defaults.baseURL}${target.startsWith('/') ? '' : '/'}${target}`;
        target = new URL(location, base).toString();
        console.warn(`[Yolo777] ${res.status} redirect -> ${target}; re-sending POST body. Update the provider's API base URL to avoid this.`);
        continue;
      }
      return res;
    }
    throw new Error('Too many redirects');
  }

  /** Human-readable reason from a provider response (message, Laravel validation errors, or raw status). */
  private reason(res: AxiosResponse): string {
    const body: any = res.data;
    if (body && typeof body === 'object') {
      if (body.message) {
        const firstError = body.errors && typeof body.errors === 'object' ? (Object.values(body.errors)[0] as any) : null;
        const detail = Array.isArray(firstError) ? firstError[0] : firstError;
        return detail && detail !== body.message ? `${body.message} (${detail})` : String(body.message);
      }
      return `HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`;
    }
    return `HTTP ${res.status}${typeof body === 'string' && body ? ` ${body.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`;
  }

  private async authenticate(): Promise<void> {
    if (this.token) return;

    try {
      const res = await this.send('/api/login', { username: this.loginId, password: this.loginPass }, false);
      const body: any = res.data;
      const token = body?.token ?? body?.data?.token;

      if (res.status !== 200 || body?.code !== 200 || !token) {
        throw new AppError(`Yolo777 login failed: ${this.reason(res)}`, 401);
      }

      this.token = token;
      const info = body.userinfo ?? body.data?.userinfo ?? {};
      this.agentUserId = info.AgentID != null ? Number(info.AgentID) : null;
      this.agentScore = info.Score != null ? Number(info.Score) : null;
    } catch (error: any) {
      this.token = null;
      if (error instanceof AppError) throw error;
      throw new AppError(`Yolo777 authentication error: ${error.message}`, 502);
    }
  }

  /** Authenticated call. Returns the full response body; throws AppError on any non-success. */
  private async makeRequest(
    endpoint: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
  ): Promise<any> {
    await this.authenticate();

    try {
      let res = await this.send(endpoint, payload, true);

      // Token expired / replaced (a new login invalidates the previous token) — log in again once.
      if (res.status === 401 || res.data?.code === 401) {
        this.token = null;
        await this.authenticate();
        res = await this.send(endpoint, payload, true);
      }

      const body: any = res.data;
      console.info(`[Yolo777] ${endpoint} response (HTTP ${res.status}):`, JSON.stringify(body)?.slice(0, 500));

      if (res.status !== 200 || body?.code !== 200) {
        const errMsg = this.reason(res);
        await ProviderLogService.logRequest(this.provider.id, userId, endpoint, payload, body, res.status, errMsg);
        throw new AppError(`Yolo777 Error: ${errMsg}`, 400);
      }

      await ProviderLogService.logRequest(this.provider.id, userId, endpoint, payload, body, 200, null);
      return body;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Yolo777 connection failed: ${err.message}`, 502);
    }
  }

  async createPlayer(username: string, password?: string): Promise<{ userId: string; accountName: string }> {
    // API: account and password must each be 6–24 characters.
    let account = username.replace(/\s+/g, '');
    if (account.length < 6) account = account.padEnd(6, '0');
    account = account.substring(0, 24);

    const pass = password && password.length >= 6 && password.length <= 24 ? password : 'Default123!';

    let body: any;
    try {
      body = await this.makeRequest('/api/create_player', { account, password: pass });
    } catch (error: any) {
      // Let callers' "username taken" retry logic recognise the provider's "already exists" answer.
      if (/already exists/i.test(error.message) && !/Username already exists/i.test(error.message)) {
        console.warn(`[Yolo777] Player ${account} already exists.`);
        throw new AppError(`Username already exists on Yolo777 (${error.message})`, 400);
      }
      throw error;
    }

    // The API calls everything else by numeric user_id, so we need it from the create response.
    const info = body.userinfo ?? body.data ?? {};
    const id = info.user_id ?? info.UserID ?? info.userid ?? info.userId ?? info.id ?? body.user_id ?? body.UserID;
    if (id === undefined || id === null || id === '') {
      throw new AppError(
        `Yolo777 created the player "${account}" but its response did not include the player's UserID (keys: ${Object.keys(info).join(', ') || 'none'}). ` +
        `Ask Yolo777 which field returns the UserID.`,
        502,
      );
    }
    return { userId: String(id), accountName: String(info.account || account) };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const body = await this.makeRequest('/api/change_score', {
      user_id: parseInt(userId, 10),
      type: 1, // 1 = deposit
      recharge_amount: Math.floor(amount), // API takes an integer amount
    }, userId);
    return body.data ?? {};
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string): Promise<any> {
    const body = await this.makeRequest('/api/change_score', {
      user_id: parseInt(userId, 10),
      type: 2, // 2 = withdrawal
      recharge_amount: Math.floor(amount),
    }, userId);
    return body.data ?? {};
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const body = await this.makeRequest('/api/get_player_balance', {
      user_id: parseInt(userId, 10),
    }, userId);
    return Number(body.data?.balance ?? 0);
  }

  async getAgentBalance(): Promise<number> {
    await this.authenticate();
    try {
      const body = await this.makeRequest('/api/get_agent_balance', { agent_id: this.agentUserId });
      return Number(body.data?.balance ?? 0);
    } catch (e) {
      // The login response already carries the agent's Score — use it if the balance call fails.
      if (this.agentScore !== null) return this.agentScore;
      throw e;
    }
  }

  async resetPlayerPassword(userId: string, newPassword?: string): Promise<boolean> {
    await this.makeRequest('/api/reset_player_password', {
      user_id: parseInt(userId, 10),
      new_password: newPassword && newPassword.length >= 6 && newPassword.length <= 24 ? newPassword : 'Default123!',
    }, userId);
    return true;
  }

  async forcePlayerOffline(userId: string): Promise<boolean> {
    await this.makeRequest('/api/kick_player', {
      user_id: parseInt(userId, 10),
    }, userId);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    // The API has no lookup by account name; the numeric UserID is stored at creation time.
    return username;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
