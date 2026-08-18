import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const DOLLARPAY_MERCHANT_ID = process.env.DOLLARPAY_MERCHANT_ID || '1092982471';
const DOLLARPAY_APP_KEY = process.env.DOLLARPAY_APP_KEY || 'fa580aabd822907890dd785dae5bf6a2';
const DOLLARPAY_BASE_URL = process.env.DOLLARPAY_BASE_URL || 'https://h5.dollarpaywallet.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://api.vaultsweeps.com'; // Adjust to env

export class DollarPayService {
  /**
   * Generates the signature for DollarPay requests and webhooks.
   * Sort parameters by name in ascending order, join with &, append key, MD5 and uppercase.
   */
  static generateSignature(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params).sort();
    const queryParts = sortedKeys
      .filter((key) => params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== '')
      .map((key) => `${key}=${params[key]}`);
    
    queryParts.push(`key=${DOLLARPAY_APP_KEY}`);
    const signingString = queryParts.join('&');
    
    return crypto.createHash('md5').update(signingString).digest('hex').toUpperCase();
  }

  /**
   * Verifies the signature from a DollarPay webhook notification.
   */
  static verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    const params = { ...payload };
    delete params.sign; // Remove sign parameter for verification
    const expectedSignature = this.generateSignature(params);
    return expectedSignature === signature;
  }

  /**
   * Create a Pay-in Order (Deposit)
   */
  static async createPayInOrder(
    amount: number,
    orderSn: string,
    userName: string,
    ip: string,
    deviceId: string,
    paymentMethodCode: string,
    returnUrl?: string
  ): Promise<any> {
    const isPayMapping: Record<string, string> = {
      'cashapp': '1',
      'applepay': '2',
      'googlepay': '3',
      'creditcard': '4'
    };
    
    const isPay = isPayMapping[paymentMethodCode.toLowerCase()] || '1'; // Default to CashApp

    const params: Record<string, string | number> = {
      merchant_id: DOLLARPAY_MERCHANT_ID,
      order_sn: orderSn,
      user_name: userName,
      is_cash: '1', // Institutional account
      is_pay: isPay,
      amount: amount.toFixed(2),
      notify_url: `${BACKEND_URL}/api/webhooks/dollarpay`,
      ip: ip,
      device_id: deviceId,
    };

    if (returnUrl) {
      params.return_url = returnUrl;
    }

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${DOLLARPAY_BASE_URL}/api/payment/pay`, new URLSearchParams(params as Record<string, string>), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      logger.info(`[DollarPay] Pay-in order created: ${orderSn}, response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[DollarPay] Error creating pay-in order: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }

  /**
   * Create a Cash Payout Order (Withdrawal to Cash App)
   */
  static async createCashPayout(
    amount: number,
    orderSn: string,
    accountNo: string
  ): Promise<any> {
    const params: Record<string, string | number> = {
      merchant_id: DOLLARPAY_MERCHANT_ID,
      order_sn: orderSn,
      account_no: accountNo,
      amount: amount.toFixed(2),
      notify_url: `${BACKEND_URL}/api/webhooks/dollarpay`
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${DOLLARPAY_BASE_URL}/api/pay/pay`, new URLSearchParams(params as Record<string, string>), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      logger.info(`[DollarPay] Cash payout order created: ${orderSn}, response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[DollarPay] Error creating cash payout: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }

  /**
   * Create a Chime Payout Order (Withdrawal to Chime)
   */
  static async createChimePayout(
    amount: number,
    orderSn: string,
    accountNo: string
  ): Promise<any> {
    const params: Record<string, string | number> = {
      merchant_id: DOLLARPAY_MERCHANT_ID,
      order_sn: orderSn,
      account_no: accountNo,
      amount: amount.toFixed(2),
      notify_url: `${BACKEND_URL}/api/webhooks/dollarpay`
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${DOLLARPAY_BASE_URL}/api/pay/chimepay`, new URLSearchParams(params as Record<string, string>), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      logger.info(`[DollarPay] Chime payout order created: ${orderSn}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[DollarPay] Error creating chime payout: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }

  /**
   * Create a PayPal Payout Order (Withdrawal to PayPal)
   */
  static async createPayPalPayout(
    amount: number,
    orderSn: string,
    accountNo: string
  ): Promise<any> {
    const params: Record<string, string | number> = {
      merchant_id: DOLLARPAY_MERCHANT_ID,
      order_sn: orderSn,
      account_no: accountNo,
      amount: amount.toFixed(2),
      notify_url: `${BACKEND_URL}/api/webhooks/dollarpay`
    };

    params.sign = this.generateSignature(params);

    try {
      const response = await axios.post(`${DOLLARPAY_BASE_URL}/api/pay/palpalpay`, new URLSearchParams(params as Record<string, string>), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      logger.info(`[DollarPay] PayPal payout order created: ${orderSn}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[DollarPay] Error creating paypal payout: ${JSON.stringify(error?.response?.data) || error.message}`);
      throw error;
    }
  }
}
