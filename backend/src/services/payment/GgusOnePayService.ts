import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const GGUSONEPAY_MERCHANT_ID = process.env.GGUSONEPAY_MERCHANT_ID || '2026096053';
const GGUSONEPAY_API_KEY = process.env.GGUSONEPAY_API_KEY || 'Pi4DJP5l9A3bhE41265s3d5Nb9l86P1a';
const GGUSONEPAY_BASE_URL = process.env.GGUSONEPAY_BASE_URL || 'https://www.ggusonepay.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://api.vaultsweeps.com';

export class GgusOnePayService {
  /**
   * Generates the MD5 signature for GgusOnePay requests and webhooks.
   *
   * Algorithm (per API docs §02):
   *  1. Collect all non-empty params, exclude `sign` itself.
   *  2. Sort keys by ASCII/lexicographic order.
   *  3. For nested objects: sort their keys recursively (same rule).
   *  4. Concatenate as `key=value&key=value` → stringA
   *  5. Append `&key=API_KEY` → stringSignTemp
   *  6. MD5(stringSignTemp).toUpperCase() → sign
   *
   * Note: amounts are integer cents; timestamp is 13-digit ms epoch.
   */
  static generateSignature(params: Record<string, any>, signType: 'MD5' | 'SHA1' | 'SHA256' = 'MD5'): string {
    const sortedKeys = Object.keys(params).sort();
    const queryParts: string[] = [];

    for (const key of sortedKeys) {
      if (key === 'sign') continue;

      const value = params[key];
      // Exclude null, undefined, and empty strings
      if (value === null || value === undefined || value === '') {
        continue;
      }

      let stringValue: string;
      if (typeof value === 'object') {
        // Nested objects: sort keys recursively before serialising
        stringValue = GgusOnePayService.serializeObject(value);
      } else {
        stringValue = String(value);
      }
      queryParts.push(`${key}=${stringValue}`);
    }

    const stringA = queryParts.join('&');
    const stringSignTemp = `${stringA}&key=${GGUSONEPAY_API_KEY}`;

    const algo = signType === 'SHA1' ? 'sha1' : signType === 'SHA256' ? 'sha256' : 'md5';
    return crypto.createHash(algo).update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Recursively sorts object keys in ASCII order and serialises to JSON.
   * Matches the worked example in §02 of the API docs.
   */
  private static serializeObject(obj: any): string {
    if (Array.isArray(obj)) {
      return JSON.stringify(obj);
    }
    if (obj && typeof obj === 'object') {
      const sorted: any = {};
      Object.keys(obj).sort().forEach(k => {
        const v = obj[k];
        sorted[k] = (v && typeof v === 'object') ? JSON.parse(GgusOnePayService.serializeObject(v)) : v;
      });
      return JSON.stringify(sorted);
    }
    return JSON.stringify(obj);
  }

  /**
   * Verifies the signature from a GgusOnePay webhook callback.
   * The gateway POSTs application/x-www-form-urlencoded; verify sign before processing.
   */
  static verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    const signType = (payload.signType as 'MD5' | 'SHA1' | 'SHA256') || 'MD5';
    const expectedSignature = this.generateSignature(payload, signType);
    return expectedSignature === signature.toUpperCase();
  }


  /**
   * POST /api/pay/create — Initiate a payment collection for a customer.
   *
   * @param amountCents   Amount in integer cents (e.g. $10.00 → 1000)
   * @param orderSn       Unique merchant order number (cannot be reused)
   * @param userId        Merchant-side user ID (used as wayParam.clientId)
   * @param ip            IPv4 of end user
   * @param wayCode       Payment method code: ecashapp | applepay | googlepay | card | chime
   *                      NOTE: Zelle and PayPal channels are temporarily unavailable.
   * @param returnUrl     Optional redirect URL after payment
   */
  static async createPayInOrder(
    amountCents: number,
    orderSn: string,
    userId: string,
    ip: string,
    wayCode: string,
    returnUrl?: string
  ): Promise<any> {
    const timestamp = Date.now(); // 13-digit ms epoch

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo: orderSn,
      amount: Math.round(amountCents),   // integer cents, no decimals
      currency: 'usd',
      wayCode: wayCode.toLowerCase(),
      clientIp: ip || '1.1.1.1',
      notifyUrl: `${BACKEND_URL}/api/webhooks/ggusonepay`,
      timestamp,
      signType: 'MD5',
      wayParam: { clientId: userId },     // JSONObject — clientId required per docs
    };

    if (returnUrl) {
      params.returnUrl = returnUrl;
    }

    params.sign = this.generateSignature(params);

    logger.info(`[GgusOnePay] Creating pay-in order: mchNo=${GGUSONEPAY_MERCHANT_ID} orderSn=${orderSn} amount=${amountCents} wayCode=${wayCode}`);
    logger.info(`[GgusOnePay] Request Parameters (Pay-In): ${JSON.stringify(params)}`);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/pay/create`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      logger.info(`[GgusOnePay] Pay-in response for ${orderSn}: ${JSON.stringify(response.data)}`);

      // API returns code=0 for success (see Response Codes §01)
      if (response.data.code !== 0) {
        logger.error(`[GgusOnePay] Gateway error code=${response.data.code}: ${response.data.msg || JSON.stringify(response.data)}\n[GgusOnePay] FAILED REQUEST PARAMS: ${JSON.stringify(params)}`);
        throw new Error(`[GgusOnePay] Gateway error code=${response.data.code}: ${response.data.msg || JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error: any) {
      const detail = error?.response?.data ? JSON.stringify(error.response.data) : error.message;
      logger.error(`[GgusOnePay] Error creating pay-in order ${orderSn}: ${detail}`);
      throw error;
    }
  }

  /**
   * POST /api/pay/query — Retrieve the latest status of a payment order.
   * Either payOrderNo (gateway) or mchOrderNo (merchant) is required.
   *
   * Order state codes:
   *  0 = Created, 1 = In Payment, 2 = Successful, 3 = Failed, 4 = Revoked, 5 = Refunded, 6 = Closed
   */
  static async queryPayInOrder(mchOrderNo: string): Promise<any> {
    const timestamp = Date.now();

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo,
      timestamp,
      signType: 'MD5',
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/pay/query`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      if (response.data.code !== 0) {
        throw new Error(`[GgusOnePay] Query error code=${response.data.code}: ${response.data.msg}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error querying pay-in order ${mchOrderNo}: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw error;
    }
  }

  /**
   * POST /api/transfer/create — Send a payout to a customer.
   *
   * @param amountCents         Amount in integer cents
   * @param orderSn             Unique merchant order number
   * @param wayCode             Transfer method: ecashapp | venmo | card | ach | chime
   *                            NOTE: Zelle and PayPal channels are temporarily unavailable.
   * @param wayParam            Method-specific params:
   *                              ecashapp: { cashtag: '$tag' }
   *                              venmo: { email: '...' }
   *                              card: { cardNumber: '...', cardValid: 'MM/YYYY' }
   *                              ach: { accountNumber: '...', routingNumber: '...' }
   *                              chime: { chimeSign: '$...' }
   * @param ip                  IPv4 of requester
   */
  static async createPayoutOrder(
    amountCents: number,
    orderSn: string,
    wayCode: string,
    wayParam: Record<string, any>,
    ip?: string
  ): Promise<any> {
    const timestamp = Date.now();

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo: orderSn,
      amount: Math.round(amountCents),
      currency: 'usd',
      wayCode: wayCode.toLowerCase(),
      wayParam,                            // JSONObject per docs
      notifyUrl: `${BACKEND_URL}/api/webhooks/ggusonepay/transfer`,
      timestamp,
      signType: 'MD5',
    };

    if (ip) {
      params.clientIp = ip;
    }

    params.sign = this.generateSignature(params);

    logger.info(`[GgusOnePay] Creating payout order: mchNo=${GGUSONEPAY_MERCHANT_ID} orderSn=${orderSn} amount=${amountCents} wayCode=${wayCode}`);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/transfer/create`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      logger.info(`[GgusOnePay] Payout response for ${orderSn}: ${JSON.stringify(response.data)}`);

      if (response.data.code !== 0) {
        throw new Error(`[GgusOnePay] Payout gateway error code=${response.data.code}: ${response.data.msg || JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error creating payout order ${orderSn}: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw error;
    }
  }

  /**
   * POST /api/transfer/query — Retrieve the status of a transfer (payout) order.
   * Either transferOrderNo or mchOrderNo required.
   *
   * Transfer state: 0=Created 1=Transferring 2=Successful 3=Failed 4=Cancelled 5=Refunded 6=Closed
   */
  static async queryPayoutOrder(mchOrderNo: string): Promise<any> {
    const timestamp = Date.now();

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo,
      timestamp,
      signType: 'MD5',
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/transfer/query`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      if (response.data.code !== 0) {
        throw new Error(`[GgusOnePay] Transfer query error code=${response.data.code}: ${response.data.msg}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error querying payout order ${mchOrderNo}: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw error;
    }
  }

  /**
   * POST /api/transfer/close — Cancel a pending transfer order.
   * Applicable to Standard Merchants. On success, state becomes 4 (Cancelled).
   */
  static async closePayoutOrder(mchOrderNo: string): Promise<any> {
    const timestamp = Date.now();

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo,
      timestamp,
      signType: 'MD5',
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/transfer/close`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      if (response.data.code !== 0) {
        throw new Error(`[GgusOnePay] Close transfer error code=${response.data.code}: ${response.data.msg}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error closing payout order ${mchOrderNo}: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw error;
    }
  }

  /**
   * POST /api/balance/query — Check merchant balance.
   * Rate limited: once every 5 seconds.
   */
  static async queryBalance(): Promise<{ currency: string; balance: number; availableBalance: number; transferPendingAmount: number; delayAmount: number }> {
    const timestamp = Date.now();

    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      timestamp,
      signType: 'MD5',
    };

    params.sign = this.generateSignature(params);

    const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/balance/query`, params, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.code !== 0) {
      throw new Error(`[GgusOnePay] Balance query error code=${response.data.code}: ${response.data.msg}`);
    }

    return response.data.data;
  }

  /**
   * GET /api/health — Platform health check. No authentication required.
   * Returns code=0 if the service is running normally.
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${GGUSONEPAY_BASE_URL}/api/health`, { timeout: 5000 });
      return response.data?.code === 0;
    } catch {
      return false;
    }
  }
}
