import crypto from 'crypto';

export class ZappayService {
  static createPaymentRequest(amount: number, orderId: string, returnUrl: string) {
    const merchantId = process.env.ZAPPAY_MERCHANT_ID || 'TEST_MERCHANT';
    const secret = process.env.ZAPPAY_SECRET || 'TEST_SECRET';
    const baseUrl = process.env.ZAPPAY_BASE_URL || 'https://sandbox.zappay.com/pay';

    const timestamp = Date.now().toString();
    // Example signature generation
    const strToSign = `${merchantId}:${orderId}:${amount}:${timestamp}:${secret}`;
    const signature = crypto.createHash('sha256').update(strToSign).digest('hex');

    const paymentUrl = `${baseUrl}?merchant_id=${merchantId}&order_id=${orderId}&amount=${amount}&timestamp=${timestamp}&signature=${signature}&return_url=${encodeURIComponent(returnUrl)}`;
    
    return paymentUrl;
  }

  static verifyWebhookSignature(payload: any, signature: string): boolean {
    const secret = process.env.ZAPPAY_SECRET || 'TEST_SECRET';
    // Example validation
    const { order_id, amount, status, timestamp } = payload;
    const strToSign = `${order_id}:${amount}:${status}:${timestamp}:${secret}`;
    const expected = crypto.createHash('sha256').update(strToSign).digest('hex');
    
    return expected === signature;
  }
}
