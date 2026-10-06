import { depositApi } from '@/lib/api'

// Shared, in-memory copy of the public payment-method list (tags, links, flags).
// Lets the Wallet popup and the deposit popup render instantly from the last fetch while a fresh copy loads in the
// background — the screen is corrected as soon as the fresh copy arrives, so an admin edit still shows up right away.

let cache: { data: any[]; at: number } | null = null
let inflight: Promise<any[]> | null = null

export const getCachedPaymentMethods = (): any[] | null => cache?.data ?? null

/** Age of the cached list in ms (Infinity when there is none) */
export const paymentMethodsAge = (): number => (cache ? Date.now() - cache.at : Infinity)

/** Fetch a fresh list (de-duplicated: simultaneous callers share one request) and update the cache */
export function fetchPaymentMethods(): Promise<any[]> {
  if (inflight) return inflight
  inflight = depositApi.getPaymentMethods()
    .then(res => {
      const data: any[] = res.data.data || []
      cache = { data, at: Date.now() }
      return data
    })
    .finally(() => { inflight = null })
  return inflight
}

/** Forget the cached list (e.g. on logout) */
export const clearPaymentMethodsCache = () => { cache = null }
