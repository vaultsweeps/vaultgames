import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderLogService } from './ProviderLogService';
import { AppError } from '../../middleware/errorHandler';
import { Provider } from '@prisma/client';

/**
 * FireKirinProviderService
 *
 * Built from "FK Game API.docx" (v1.0, 2026/8/18). Structurally near-identical to MilkyWay's API — same
 * agentLogin → agentKey session model, same signature formula, same /ws/service.ashx action-based
 * endpoint — so this adapter mirrors MilkywayProviderService.ts's structure (including its concurrency-
 * safety fix for the shared, cached-instance session state — see authenticate() below) rather than the
 * separate CashMachine-family pattern (numeric provider-assigned player IDs, different recharge/redeem
 * field constraints). Confirmed against the doc, NOT assumed identical to either sibling:
 *
 *   - Base URL: https://firekirin.xyz:8034/ws/service.ashx (from Provider.apiBaseUrl / endpoints, not
 *     hardcoded — matches every other provider's convention)
 *   - agentLogin  → agentPasswd = md5(secretKey), response: code, msg, agentKey, Balance
 *   - sign        = md5((agentName + time + agentKey).toLowerCase()) — identical formula to MilkyWay
 *   - "Time will expire after being used successfully once and needs to be replaced" (doc's own words) —
 *     same constraint MilkyWay has, same fix: sleep briefly after login so the first real call's
 *     timestamp differs from the login call's.
 *   - Players are addressed by the `account` string directly (no separate numeric ID lookup step,
 *     confirmed by registerUser/queryInfo/recharge/redeem/etc. all taking `account`) — same as MilkyWay,
 *     unlike the CashMachine family.
 *   - recharge/redeem support an OPTIONAL `transactionId` (≤20 chars, "must not be repeated within the
 *     past three days") — MilkyWay's API doesn't document an equivalent field so its adapter doesn't send
 *     one, but FireKirin's does, so this one does: extra provider-side duplicate protection on top of our
 *     own idempotency handling. NOTE: 20 chars is far tighter than CashMachine's 50-char `remark` limit
 *     (see CashMachineProviderService.sanitizeRemark, fixed after a real production rejection) — our own
 *     orderId format ("TX-<userId>-<idempotencyKey>") shares a ~28-char "TX-<userId>-" prefix across every
 *     transaction for the same user, so truncating it to 20 chars would collide instead of merely
 *     shortening. Hashed instead (see sanitizeTransactionId) so different orderIds reliably produce
 *     different, still-deterministic 20-char values.
 *   - getgamelist/entergame/getTradeRecord/getJpRecord/getGameRecord are documented but intentionally NOT
 *     implemented here: no existing provider adapter in this codebase implements a "launch game"/"list
 *     games" flow through ProviderAdapter (players use the downloaded native app with their account
 *     credentials directly, per the existing "Download Game" + shown account/password pattern throughout
 *     the app), and ProviderAdapter's interface has no methods for them. Out of scope for "integrate the
 *     provider" without a separate, explicit feature request.
 */
export class FireKirinProviderService implements ProviderAdapter {
  private readonly provider: Provider;
  private readonly http: AxiosInstance;

  // ─── Session state ────────────────────────────────────────────────────────
  private agentKey: string | null = null;
  private agentBalance: number = 0;
  private lastAuthTime: number = 0;
  private authPromise: Promise<string> | null = null;

  /**
   * 3 minutes — deliberately short, matching MilkyWay's adapter. A cached key older than this is
   * proactively discarded before any call, rather than waiting to be told it's stale by the server.
   */
  private readonly TTL_MS = 3 * 60 * 1000;

  // ─── Constructor ─────────────────────────────────────────────────────────
  constructor(provider: Provider) {
    if (!provider.apiBaseUrl || !provider.agentId || !provider.secretKey) {
      throw new AppError(
        `FireKirin provider config incomplete for "${provider.name || provider.id}"`,
        500,
      );
    }

    this.provider = {
      ...provider,
      agentId:    provider.agentId.trim(),
      secretKey:  provider.secretKey.trim(),
      apiBaseUrl: provider.apiBaseUrl.trim().replace(/\/+$/, ''),
    };

    this.http = axios.create({
      baseURL: this.provider.apiBaseUrl,
      timeout: this.provider.requestTimeout || 10_000,
      headers: { 'Content-Length': '0' },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /** MD5 of a string, returned as lowercase hex. */
  private md5(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /** Seconds since epoch — 10 digits, matching the doc's C# System.currentTimeMillis()-derived examples. */
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
   * FireKirin's transactionId cap (20 chars) is tighter than our orderId format's shared prefix length,
   * so a plain truncation would collide across different transactions for the same user. A hash prefix
   * stays deterministic (safe to retry with the same orderId) while actually varying by input.
   */
  private sanitizeTransactionId(orderId: string): string {
    return this.md5(orderId).slice(0, 20);
  }

  /**
   * Returns true for any server response that means "your session or signature is no longer valid —
   * please re-login and retry."
   */
  private isAuthError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
      m.includes('session')    ||
      m.includes('timeout')    ||
      m.includes('signature')  ||
      m.includes('expire')     ||
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

  // Returns the key THIS call obtained (or the still-fresh cached one) rather than leaving callers to
  // re-read the shared this.agentKey field afterward. This instance is cached and reused across concurrent
  // requests (ProviderFactory.providerCache), so a different in-flight request's invalidateSession() (its
  // own auth-error retry path) can null out the shared field in the gap between this call's authenticate()
  // resolving and its next line running — confirmed as a real production bug on MilkywayProviderService,
  // which this adapter is modeled on specifically to avoid repeating it here.
  private async authenticate(): Promise<string> {
    if (this.agentKey && (Date.now() - this.lastAuthTime) < this.TTL_MS) {
      return this.agentKey;
    }

    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      const time = this.nowSeconds();
      console.info(`[FireKirin] → agentLogin | agent: ${this.agentName} | time: ${time}`);

      try {
        const res = await this.http.post(this.servicePath, null, {
          params: {
            action:      'agentLogin',
            agentName:   this.agentName,
            agentPasswd: this.md5(this.provider.secretKey),
            time,
          },
        });

        console.info(`[FireKirin] ← agentLogin | code: ${res.data?.code} | msg: ${res.data?.msg ?? 'ok'}`);

        const d = res.data;
        if (String(d.code) !== '200') {
          throw new AppError(`FireKirin login failed: ${d.msg}`, 400);
        }

        const key = (
          d.agentkey ?? d.agentKey ?? d.AgentKey ?? d.AGENTKEY ?? ''
        ).toString().trim();

        if (!key) {
          throw new AppError(
            `FireKirin login returned no agentKey. Full response: ${JSON.stringify(d)}`,
            500,
          );
        }

        this.agentKey     = key;
        this.agentBalance = parseFloat(d.balance ?? d.Balance ?? '0') || 0;
        this.lastAuthTime = Date.now();

        console.info(`[FireKirin] Session established | balance: ${this.agentBalance}`);
        // TEMP DIAGNOSTIC (remove once the signature error is root-caused)
        console.info(`[FireKirin][DEBUG] raw login response keys=${JSON.stringify(Object.keys(d))} extractedKey="${key}" (len=${key.length})`);

        // Doc: "Time will expire after being used successfully once and needs to be replaced" — sleep so
        // the next request's timestamp (1-second resolution) lands in a different second than this login.
        await this.sleep(2000);

        return key;

      } catch (err: any) {
        this.invalidateSession();
        if (err instanceof AppError) throw err;
        throw new AppError(`FireKirin login error: ${err.message}`, 502);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  // ─── Core request handler ─────────────────────────────────────────────────

  private async makeRequest(
    action: string,
    payload: Record<string, any> = {},
    userId: string | null = null,
    isRetry = false,
  ): Promise<any> {
    const agentKey = await this.authenticate();

    if (!agentKey) {
      throw new AppError('[FireKirin] No agentKey after authenticate() — this should never happen', 500);
    }

    const time = this.nowSeconds();
    // Doc says sign = md5((agentName + time + agentKey).toLowerCase()) — but the doc's own worked example
    // uses a lowercase agentKey ("cb71121e..."), so that instruction was never actually exercised against
    // a mixed-case key in the example itself. The live server returns UPPERCASE keys (confirmed via
    // debug logging: "0CDDF6CAD17146A5B1B98984061C722D"), and every call using a lowercased version of it
    // got "Signature error." — consistent with the real server not actually lowercasing the key
    // server-side when it recomputes the signature to compare, despite what the doc claims. agentName
    // ("vault675") is naturally already lowercase for us either way, so that part is moot; the key is kept
    // exactly as returned instead of forced to lowercase.
    const signInput = this.agentName.toLowerCase() + time + agentKey;
    const sign      = this.md5(signInput);

    // TEMP DIAGNOSTIC (remove once the signature error is root-caused) — agentKey is a session token that
    // rotates on every login, not a long-term secret, so logging it short-term while actively debugging a
    // live signature failure is safe. Quoted so any invisible leading/trailing whitespace is visible.
    if (action !== 'agentLogin') {
      console.info(`[FireKirin][DEBUG] action=${action} agentKey="${agentKey}" (len=${agentKey.length}) signInput="${signInput}" sign=${sign}`);
    }

    const params   = { agentName: this.agentName, time, sign, ...payload };
    const endpoint = `${this.servicePath}?action=${action}`;

    console.info(`[FireKirin] → ${action} | time: ${time}`);

    try {
      const res = await this.http.post(endpoint, null, { params });
      const { code, msg, ...data } = res.data;
      const codeStr = String(code);

      console.info(`[FireKirin] ← ${action} | code: ${codeStr} | msg: ${msg ?? 'ok'}`);

      if (codeStr !== '200') {
        const errMsg = msg || 'Unknown error';

        if (!isRetry && this.isAuthError(errMsg)) {
          console.warn(`[FireKirin] Auth error on "${action}": "${errMsg}" — refreshing session and retrying...`);
          this.invalidateSession();
          await this.sleep(3000);
          return this.makeRequest(action, payload, userId, true);
        }

        await ProviderLogService.logRequest(
          this.provider.id,
          userId,
          endpoint,
          params,
          res.data,
          parseInt(codeStr, 10),
          errMsg,
        );
        throw new AppError(`Provider Error: ${errMsg}`, 400);
      }

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

  /**
   * Doc: "Account of players, The length should be between 6 to 32 chars." — no explicit character-set
   * restriction is documented (unlike CashMachine's strict letters+digits-only), but sanitizing to
   * alphanumeric anyway is a safe default that works with virtually any such backend, and matches the
   * established pattern used for every other provider in this codebase (MilkywayProviderService,
   * CashMachineProviderService) rather than trusting an undocumented character set.
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
      const trimmedBase = (base || 'u').substring(0, 27);
      safe = trimmedBase + randomSuffix();
    } else {
      safe = base;
    }

    if (safe.length < 6) safe = safe.padEnd(6, '0');
    return safe.substring(0, 32);
  }

  async createPlayer(username: string, password?: string) {
    const providerUsername = this.sanitizeUsername(username);
    if (providerUsername !== username) {
      console.info(
        `[FireKirin:${this.provider.name}] Username sanitized: "${username}" → "${providerUsername}"`,
      );
    }

    await this.makeRequest('registerUser', {
      account: providerUsername,
      passwd:  this.md5(password || 'Test@1234'),
    });

    return { userId: providerUsername, accountName: providerUsername };
  }

  async rechargePlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest(
      'recharge',
      {
        account: userId,
        amount: Number(amount.toFixed(2)),
        transactionId: this.sanitizeTransactionId(orderId),
      },
      userId,
    );
  }

  async withdrawPlayer(userId: string, amount: number, orderId: string) {
    return this.makeRequest(
      'redeem',
      {
        account: userId,
        amount: Number(amount.toFixed(2)),
        transactionId: this.sanitizeTransactionId(orderId),
      },
      userId,
    );
  }

  async getPlayerBalance(userId: string): Promise<number> {
    const data = await this.makeRequest('queryInfo', { account: userId }, userId);
    return parseFloat(data.userbalance ?? data.userBalance ?? '0') || 0;
  }

  async getAgentBalance(): Promise<number> {
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

  /** Doc: "Kick Player Out" (action: kickPlayerOut) — FireKirin supports this for real, unlike some
   *  sibling providers whose adapters stub it out because their own APIs have no equivalent. */
  async forcePlayerOffline(userId: string): Promise<boolean> {
    await this.makeRequest('kickPlayerOut', { account: userId }, userId);
    return true;
  }

  async getPlayerIdByUsername(username: string): Promise<string> {
    return username;
  }

  getProviderId(): string {
    return this.provider.id;
  }
}
