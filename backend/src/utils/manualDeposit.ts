// Manual (send-to-our-tag) deposit methods: Chime, CashApp, PayPal, Venmo and anything added in the admin panel
// with a payment app. They all share one minimum deposit, enforced here on the server.

export const MANUAL_MIN_DEPOSIT_USD = 5

const BUILT_IN_MANUAL_CODES = ['chime', 'chime2', 'cashapp', 'cashapp2', 'paypal', 'venmo']

export function isManualDepositMethod(m: { code?: string | null; brand?: string | null }): boolean {
  return !!m.brand || BUILT_IN_MANUAL_CODES.includes(String(m.code ?? '').toLowerCase())
}
