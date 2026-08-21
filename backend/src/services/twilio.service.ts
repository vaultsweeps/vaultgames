import twilio from 'twilio';

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
  }

  return twilio(accountSid, authToken);
}

function getVerifyServiceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID is not configured in .env');
  }
  return sid;
}

export class TwilioService {
  /**
   * Sends an OTP to the given phone number.
   * @param phoneNumber The phone number in E.164 format (e.g. +1234567890)
   */
  static async sendOTP(phoneNumber: string): Promise<boolean> {
    try {
      const client = getClient();
      const verifyServiceSid = getVerifyServiceSid();
      const verification = await client.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: phoneNumber, channel: 'sms' });
      return verification.status === 'pending';
    } catch (error: any) {
      console.error('[Twilio] Error sending OTP:', error?.message || error);
      throw new Error(error?.message || 'Failed to send verification code');
    }
  }

  /**
   * Verifies the OTP for a given phone number.
   * @param phoneNumber The phone number in E.164 format
   * @param code The code sent to the user
   */
  static async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    try {
      const client = getClient();
      const verifyServiceSid = getVerifyServiceSid();
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({ to: phoneNumber, code });
      return verificationCheck.status === 'approved';
    } catch (error: any) {
      console.error('[Twilio] Error verifying OTP:', error?.message || error);
      throw new Error(error?.message || 'Failed to verify code');
    }
  }
}
