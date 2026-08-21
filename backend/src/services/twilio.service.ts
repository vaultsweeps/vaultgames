import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

const client = twilio(accountSid, authToken);

export class TwilioService {
  /**
   * Sends an OTP to the given phone number.
   * @param phoneNumber The phone number in E.164 format (e.g. +1234567890)
   */
  static async sendOTP(phoneNumber: string): Promise<boolean> {
    try {
      const verification = await client.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: phoneNumber, channel: 'sms' });
      return verification.status === 'pending';
    } catch (error) {
      console.error('Error sending OTP via Twilio:', error);
      throw error;
    }
  }

  /**
   * Verifies the OTP for a given phone number.
   * @param phoneNumber The phone number in E.164 format
   * @param code The code sent to the user
   */
  static async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    try {
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({ to: phoneNumber, code });
      return verificationCheck.status === 'approved';
    } catch (error) {
      console.error('Error verifying OTP via Twilio:', error);
      throw error;
    }
  }
}
