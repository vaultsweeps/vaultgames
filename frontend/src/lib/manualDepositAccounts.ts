// Manual (send-to-our-tag) deposit accounts.
// Source of truth is the PaymentMethod table, managed in Admin → Payment methods → Deposit methods
// (brand + tag + link). LEGACY_ACCOUNTS below are the built-in details of the original six methods and are used
// ONLY for a method whose tag has never been set in the admin panel. Once an admin saves a tag, every detail
// comes from the database — an old tag, link or QR can never show again (not even while the list is loading).

export type ManualBrand = 'chime' | 'cashapp' | 'paypal' | 'venmo' | 'zelle' | 'other'

export type ManualDepositAccount = {
  id: string            // PaymentMethod.code — what ChimePayPalDepositModal and createDeposit look the method up by
  brand: ManualBrand
  name: string          // internal label, e.g. "Chime 1" (deposit modal header)
  color: string         // Tailwind bg class used by the deposit modal
  text: string          // Tailwind text class used by the deposit modal
  recipient: string     // the tag players send to
  linkUrl: string
  qrUrl: string
  displayName?: string  // optional override for the name shown on the tile
  instructions?: string
  sortOrder?: number
}

export const BRANDS: Record<ManualBrand, { label: string; logoText: string; bg: string; glow: string; color: string; text: string }> = {
  chime:   { label: 'Chime',   logoText: 'chime',  bg: '#1EC677', glow: 'rgba(30,198,119,0.45)', color: 'bg-emerald-500', text: 'text-emerald-500' },
  cashapp: { label: 'CashApp', logoText: '$',      bg: '#00D632', glow: 'rgba(0,214,50,0.45)',   color: 'bg-green-500',   text: 'text-green-500' },
  paypal:  { label: 'PayPal',  logoText: 'PayPal', bg: '#0070E0', glow: 'rgba(0,112,224,0.45)',  color: 'bg-blue-500',    text: 'text-blue-500' },
  venmo:   { label: 'Venmo',   logoText: 'venmo',  bg: '#008CFF', glow: 'rgba(0,140,255,0.45)',  color: 'bg-sky-500',     text: 'text-sky-500' },
  zelle:   { label: 'Zelle',   logoText: 'Z',      bg: '#6D1ED4', glow: 'rgba(109,30,212,0.45)', color: 'bg-violet-600',  text: 'text-violet-400' },
  other:   { label: 'Other',   logoText: '',       bg: '#475569', glow: 'rgba(71,85,105,0.45)',  color: 'bg-slate-500',   text: 'text-slate-300' },
}

export const BRAND_OPTIONS = Object.keys(BRANDS) as ManualBrand[]

export const LEGACY_ACCOUNTS: ManualDepositAccount[] = [
  {
    id: 'chime', brand: 'chime', name: 'Chime 1', color: 'bg-emerald-500', text: 'text-emerald-500',
    recipient: '$Luis-Feliciano-9012',
    linkUrl: 'https://www.chime.com/r/Luis-Feliciano-9012/?c=q',
    qrUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png',
  },
  {
    id: 'chime2', brand: 'chime', name: 'Chime 2', color: 'bg-teal-500', text: 'text-teal-500',
    recipient: '$Brenda-Taylor-245',
    linkUrl: 'https://www.chime.com/r/Brenda-Taylor-245/?c=q',
    qrUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png',
  },
  {
    id: 'paypal', brand: 'paypal', name: 'PayPal', color: 'bg-blue-500', text: 'text-blue-500',
    recipient: '@Luis9542',
    linkUrl: 'https://www.paypal.com/paypalme/Luis9542',
    qrUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
  },
  {
    id: 'cashapp', brand: 'cashapp', name: 'CashApp 1', color: 'bg-green-500', text: 'text-green-500',
    recipient: '$JacobJonesAaron',
    linkUrl: 'https://cash.app/$JacobJonesAaron?qr=1',
    qrUrl: '',
  },
  {
    id: 'cashapp2', brand: 'cashapp', name: 'CashApp 2', color: 'bg-lime-500', text: 'text-lime-500',
    recipient: '$VictoriaSantielFaith',
    linkUrl: 'https://cash.app/$VictoriaSantielFaith?qr=1',
    qrUrl: '',
  },
  {
    id: 'venmo', brand: 'venmo', name: 'Venmo', color: 'bg-sky-500', text: 'text-sky-500',
    recipient: '@ktrimm24',
    linkUrl: 'https://venmo.com/u/ktrimm24',
    qrUrl: '',
  },
]

const legacyByCode = (code: string) => LEGACY_ACCOUNTS.find(a => a.id === code)

/** Is this PaymentMethod row a manual send-to-tag deposit method? */
export function isManualMethod(m: any): boolean {
  const code = String(m?.code || '').toLowerCase()
  return !!(m?.brand || legacyByCode(code))
}

/**
 * Manual deposit accounts to show players, built from the public PaymentMethod list.
 * `methods === null` (not loaded yet / failed) → [] — callers show a loading or retry state, never stale tags.
 */
export function buildManualAccounts(methods: any[] | null): ManualDepositAccount[] {
  if (!methods) return []
  const out: ManualDepositAccount[] = []
  for (const m of methods) {
    if (m?.isActive === false || m?.depositEnabled === false) continue
    const code = String(m.code || '').toLowerCase()
    // Built-in details only while the admin has never set a tag for this method
    const legacy = m.tag ? undefined : legacyByCode(code)
    const brand = (BRANDS[m.brand as ManualBrand] ? m.brand : legacy?.brand) as ManualBrand | undefined
    const recipient = m.tag || legacy?.recipient
    if (!brand || !recipient) continue
    out.push({
      id: code,
      brand,
      name: m.name || legacy?.name || BRANDS[brand].label,
      color: legacy ? legacy.color : BRANDS[brand].color,
      text: legacy ? legacy.text : BRANDS[brand].text,
      recipient,
      linkUrl: m.linkUrl || legacy?.linkUrl || '',
      qrUrl: m.qrUrl || legacy?.qrUrl || '',
      displayName: m.displayName || undefined,
      instructions: m.instructions || undefined,
      sortOrder: Number(m.sortOrder) || 0,
    })
  }
  // Admin "Order" first; ties keep the familiar order (Chime, CashApp, PayPal, Venmo, …; Chime 1 before Chime 2)
  const rank = (a: ManualDepositAccount) => {
    const legacyIdx = LEGACY_ACCOUNTS.findIndex(l => l.id === a.id)
    return [a.sortOrder || 0, BRAND_OPTIONS.indexOf(a.brand), legacyIdx < 0 ? 99 : legacyIdx]
  }
  return out
    .map((a, i) => ({ a, k: [...rank(a), i] }))
    .sort((x, y) => { for (let j = 0; j < x.k.length; j++) if (x.k[j] !== y.k[j]) return x.k[j] - y.k[j]; return 0 })
    .map(x => x.a)
}

/** First name from a tag: "$Luis-Feliciano-9012" → "Luis", "$JacobJonesAaron" → "Jacob", "@ktrimm24" → "Ktrimm" */
export function firstNameFromTag(tag: string): string {
  const core = tag.replace(/^[$@]/, '')
  const first = core.split(/[-_.\s@]/)[0] || core
  const word = (first.match(/^[A-Za-z][a-z]*/)?.[0]) || first.replace(/\d+$/, '') || first
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export const tileName = (a: ManualDepositAccount) => a.displayName || firstNameFromTag(a.recipient)
/** Small line under the tile name: the app name, or the method's own name for "Other" */
export const tileSubtitle = (a: ManualDepositAccount) => (a.brand === 'other' ? a.name : BRANDS[a.brand].label)
/** Logo text in the tile circle: the brand wordmark, or the first letter of the method name for "Other" */
export const tileLogo = (a: { brand: ManualBrand; name: string }) => BRANDS[a.brand].logoText || (a.name.trim()[0] || '?').toUpperCase()
