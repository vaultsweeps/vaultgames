import prisma from '../../lib/prisma';

export class ProviderLogService {
  /**
   * status is always parsed to Int — Orion returns code as a string
   * ("200" / "201") which would fail Prisma's Int validation.
   */
  static async logRequest(
    providerId: string | null,
    userId: string | null,
    endpoint: string,
    request: Record<string, any>,
    response: Record<string, any>,
    status: number | string,
    errorMessage: string | null = null,
    ipAddress: string | null = null,
  ): Promise<void> {
    try {
      await prisma.providerLog.create({
        data: {
          providerId,
          userId,
          endpoint,
          request,
          response,
          status:       parseInt(String(status), 10),  // ✅ always Int
          errorMessage: errorMessage ?? null,
          ipAddress:    ipAddress ?? null,
        },
      });
    } catch (err) {
      // Never crash the main request flow on a logging failure
      console.error('[ProviderLogService] Failed to save log:', err);
    }
  }
}
