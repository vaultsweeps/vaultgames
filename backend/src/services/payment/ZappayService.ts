import crypto from 'crypto';

export class ZappayService {
  static createPaymentRequest(amount: number, orderId: string, returnUrl: string) {
    const merchantId = process.env.ZAPPAY_MERCHANT_ID || 'TEST_MERCHANT';
    // No hardcoded fallback: an unconfigured secret should produce a URL that
    // simply won't validate upstream, not a well-known guessable signature.
    const secret = process.env.ZAPPAY_SECRET || '';
    const baseUrl = process.env.ZAPPAY_BASE_URL || 'https://sandbox.zappay.com/pay';

    const timestamp = Date.now().toString();
    // Example signature generation
    const strToSign = `${merchantId}:${orderId}:${amount}:${timestamp}:${secret}`;
    const signature = crypto.createHash('sha256').update(strToSign).digest('hex');

    const paymentUrl = `${baseUrl}?merchant_id=${merchantId}&order_id=${orderId}&amount=${amount}&timestamp=${timestamp}&signature=${signature}&return_url=${encodeURIComponent(returnUrl)}`;

    return paymentUrl;
  }

  static verifyWebhookSignature(payload: any, signature: string): boolean {
    const secret = process.env.ZAPPAY_SECRET;
    // Fail closed: without a configured secret, no signature can be trusted.
    if (!secret || !signature) return false;

    const { order_id, amount, status, timestamp } = payload;
    const strToSign = `${order_id}:${amount}:${status}:${timestamp}:${secret}`;
    const expected = crypto.createHash('sha256').update(strToSign).digest('hex');

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    return expectedBuf.length === signatureBuf.length && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }
}
