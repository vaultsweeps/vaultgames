import axios from 'axios'
import { logger } from '../../utils/logger'

const NOWPAYMENTS_BASE_URL = 'https://api.nowpayments.io/v1'

export interface NowPaymentsInvoice {
  id: string
  token_id: string
  order_id: string
  order_description: string
  price_amount: number
  price_currency: string
  pay_currency: string | null
  ipn_callback_url: string
  invoice_url: string
  success_url: string
  cancel_url: string
  created_at: string
  updated_at: string
}

export interface NowPaymentsPaymentStatus {
  payment_id: string
  payment_status: string
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  actually_paid: number
  pay_currency: string
  order_id: string
  order_description: string
  created_at: string
  updated_at: string
}

export class NowPaymentsService {
  private static readonly apiKey = process.env.NOWPAYMENTS_API_KEY || ''

  private static get headers() {
    return {
      'x-api-key': NowPaymentsService.apiKey,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Creates a payment invoice on NOWPayments.
   * Returns the invoice URL to redirect the user to for payment.
   */
  static async createInvoice(
    amountUsd: number,
    orderId: string,
    description: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<NowPaymentsInvoice> {
    if (!NowPaymentsService.apiKey) {
      throw new Error('NOWPAYMENTS_API_KEY is not configured')
    }

    const ipnCallbackUrl = `${process.env.BACKEND_URL || 'https://api.vaultsweeps.com'}/api/webhooks/crypto`

    const payload = {
      price_amount: amountUsd,
      price_currency: 'usd',
      pay_currency: 'usdttrc20', // default to USDT TRC20; user can change on payment page
      order_id: orderId,
      order_description: description,
      ipn_callback_url: ipnCallbackUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
      is_fixed_rate: false,
      is_fee_paid_by_user: false,
    }

    logger.info(`[NOWPayments] Creating invoice for order ${orderId}, amount $${amountUsd}`)

    const response = await axios.post<NowPaymentsInvoice>(
      `${NOWPAYMENTS_BASE_URL}/invoice`,
      payload,
      { headers: NowPaymentsService.headers }
    )

    logger.info(`[NOWPayments] Invoice created: ${response.data.id} — URL: ${response.data.invoice_url}`)
    return response.data
  }

  /**
   * Fetch the status of a specific payment by payment_id.
   */
  static async getPaymentStatus(paymentId: string): Promise<NowPaymentsPaymentStatus> {
    const response = await axios.get<NowPaymentsPaymentStatus>(
      `${NOWPAYMENTS_BASE_URL}/payment/${paymentId}`,
      { headers: NowPaymentsService.headers }
    )
    return response.data
  }

  /**
   * Check if the NOWPayments API is reachable and the API key is valid.
   */
  static async checkStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${NOWPAYMENTS_BASE_URL}/status`, {
        headers: NowPaymentsService.headers,
        timeout: 5000,
      })
      return response.data?.message === 'OK'
    } catch {
      return false
    }
  }
}
