import prisma from '../../lib/prisma';

// Field names whose values must never be written to the database log
const SENSITIVE_KEY = /pass(word|wd)?|(^|_)pwd|login_?pwd|secret|token|agentkey|appsecret|^sign$|authorization|cookie|api_?key|credential/i

/** Deep-copies a request/response, masking sensitive fields and any `sign=`/`agentKey=`-style query values. */
export function redactForLog<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 6) return value
  if (typeof value === 'string') {
    return value.replace(/([?&](?:sign|agentkey|passwd|password|agentpasswd|passwdnew|token)=)[^&]*/gi, '$1[REDACTED]') as unknown as T
  }
  if (Array.isArray(value)) return value.map(v => redactForLog(v, depth + 1)) as unknown as T
  if (typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redactForLog(v, depth + 1)
    }
    return out as T
  }
  return value
}

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
          endpoint: redactForLog(endpoint),
          request: redactForLog(request),
          response: redactForLog(response),
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
