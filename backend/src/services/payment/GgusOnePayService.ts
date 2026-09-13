import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const GGUSONEPAY_MERCHANT_ID = process.env.GGUSONEPAY_MERCHANT_ID || 'nicks1911';
const GGUSONEPAY_API_KEY = process.env.GGUSONEPAY_API_KEY || 'Pi4DJP5l9A3bhE41265s3d5Nb9l86P1a';
const GGUSONEPAY_BASE_URL = process.env.GGUSONEPAY_BASE_URL || 'https://www.ggusonepay.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://api.vaultsweeps.com'; // Adjust to env

export class GgusOnePayService {
  /**
   * Generates the signature for GgusOnePay requests and webhooks.
   * Collect all non-empty parameters (exclude `sign`). Sort by parameter name in ASCII order.
   * Concatenate as URL key=value pairs separated by `&` to form `stringA`.
   * Append `&key=API_KEY`, MD5, and convert to uppercase.
   */
  static generateSignature(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const queryParts: string[] = [];

    for (const key of sortedKeys) {
      if (key === 'sign') continue;
      
      const value = params[key];
      // Exclude null or empty strings
      if (value === null || value === undefined || value === '') {
        continue;
      }
      
      // If it's an object, stringify it
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      queryParts.push(`${key}=${stringValue}`);
    }
    
    const stringA = queryParts.join('&');
    const stringSignTemp = `${stringA}&key=${GGUSONEPAY_API_KEY}`;
    
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }

  /**
   * Verifies the signature from a GgusOnePay webhook notification.
   */
  static verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    const expectedSignature = this.generateSignature(payload);
    return expectedSignature === signature;
  }

  /**
   * Create a Pay-in Order (Deposit)
   */
  static async createPayInOrder(
    amountCents: number,
    orderSn: string,
    userId: string,
    ip: string,
    paymentMethodCode: string, // e.g., cashapp, zelle, paypal, applepay, googlepay, card, chime
    returnUrl?: string
  ): Promise<any> {
    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo: orderSn,
      amount: amountCents, // Amount in cents
      currency: 'usd',
      wayCode: paymentMethodCode.toLowerCase(),
      clientIp: ip || '1.1.1.1',
      notifyUrl: `${BACKEND_URL}/api/webhooks/ggusonepay`,
      timestamp: Date.now(),
      signType: 'MD5',
      wayParam: { clientId: userId } // Required as a JSON object per docs
    };

    if (returnUrl) {
      params.returnUrl = returnUrl;
    }

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/pay/create`, params, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      logger.info(`[GgusOnePay] Pay-in order created: ${orderSn}, response: ${JSON.stringify(response.data)}`);
      
      if (response.data.code !== 0 && response.data.code !== 200) {
        throw new Error(`Gateway Error: ${response.data.msg || JSON.stringify(response.data)}`);
      }
      
      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error creating pay-in order: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }

  /**
   * Create a Transfer Order (Payout)
   */
  static async createPayoutOrder(
    amountCents: number,
    orderSn: string,
    paymentMethodCode: string, // e.g., ecashapp, paypal, card, ach, chime, zelle
    wayParam: Record<string, any>, // Method-specific params (e.g., cashtag, email, routingNumber)
    ip: string
  ): Promise<any> {
    const params: Record<string, any> = {
      mchNo: GGUSONEPAY_MERCHANT_ID,
      mchOrderNo: orderSn,
      amount: amountCents,
      currency: 'usd',
      wayCode: paymentMethodCode.toLowerCase(),
      wayParam,
      notifyUrl: `${BACKEND_URL}/api/webhooks/ggusonepay/transfer`,
      timestamp: Date.now(),
      signType: 'MD5'
    };

    if (ip) {
      params.clientIp = ip;
    }

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${GGUSONEPAY_BASE_URL}/api/transfer/create`, params, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      logger.info(`[GgusOnePay] Payout order created: ${orderSn}`);

      if (response.data.code !== 0 && response.data.code !== 200) {
        throw new Error(`Gateway Error: ${response.data.msg || JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error(`[GgusOnePay] Error creating payout order: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }
}
