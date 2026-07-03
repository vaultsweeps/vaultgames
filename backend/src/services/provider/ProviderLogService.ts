import prisma from '../../lib/prisma';

export class ProviderLogService {
  static async logRequest(
    providerId: string | null,
    userId: string | null,
    endpoint: string,
    request: any,
    response: any,
    status: number,
    errorMessage: string | null = null,
    ipAddress: string | null = null
  ) {
    try {
      await prisma.providerLog.create({
        data: {
          providerId,
          userId,
          endpoint,
          request,
          response,
          status,
          errorMessage,
          ipAddress,
        },
      });
    } catch (error) {
      console.error('Failed to save provider log:', error);
    }
  }
}
