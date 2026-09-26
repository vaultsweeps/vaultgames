'use client'
/**
 * VaultSweeps dashboard design system — shared primitives.
 *
 * Presentation only. These components own no data, routing or business logic; pages pass in
 * whatever they already render/handle. Colours come from the theme variables that `.ds-scope`
 * (globals.css) re-maps, so everything works in dark, night and light themes.
 *
 * Type scale (Inter):  page title 26/30px bold · section heading 17/18px bold · card title 16–18px semibold
 *                      body 14–15px · secondary 12–14px · numbers 22–32px bold.
 * Radius: cards 20px, buttons/inputs 14–16px, icon tiles 12–14px, pills full.
 * The futuristic display face (`font-brand`) is reserved for the wordmark and hero name only.
 */
import { ButtonHTMLAttributes, ReactNode, HTMLAttributes, forwardRef } from 'react'
import { Apple, CreditCard, Landmark, Send, Wallet, Zap } from 'lucide-react'

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/* ───────────────────────── tones / icon tiles ───────────────────────── */
export type Tone = 'cyan' | 'blue' | 'purple' | 'gold' | 'green' | 'red' | 'pink' | 'orange' | 'slate'

export const TONES: Record<Tone, { fg: string; bg: string; ring: string }> = {
  cyan:   { fg: '#38BDF8', bg: 'rgba(56,189,248,0.13)',  ring: 'rgba(56,189,248,0.24)' },
  blue:   { fg: '#60A5FA', bg: 'rgba(96,165,250,0.13)',  ring: 'rgba(96,165,250,0.24)' },
  purple: { fg: '#A78BFA', bg: 'rgba(167,139,250,0.14)', ring: 'rgba(167,139,250,0.26)' },
  gold:   { fg: '#FBBF24', bg: 'rgba(251,191,36,0.14)',  ring: 'rgba(251,191,36,0.26)' },
  green:  { fg: '#34D399', bg: 'rgba(52,211,153,0.13)',  ring: 'rgba(52,211,153,0.24)' },
  red:    { fg: '#F87171', bg: 'rgba(248,113,113,0.13)', ring: 'rgba(248,113,113,0.24)' },
  pink:   { fg: '#F472B6', bg: 'rgba(244,114,182,0.13)', ring: 'rgba(244,114,182,0.24)' },
  orange: { fg: '#FB923C', bg: 'rgba(251,146,60,0.13)',  ring: 'rgba(251,146,60,0.24)' },
  slate:  { fg: '#94A3B8', bg: 'rgba(148,163,184,0.12)', ring: 'rgba(148,163,184,0.22)' },
}

const TILE_SIZES = { sm: 'w-9 h-9 rounded-xl', md: 'w-11 h-11 rounded-[14px]', lg: 'w-14 h-14 rounded-2xl' } as const
const TILE_ICON = { sm: 18, md: 22, lg: 28 } as const

/** Consistent icon container: same size/stroke/tint everywhere. Pass a lucide icon component. */
export function IconTile({ icon: Icon, tone = 'cyan', size = 'md', className }: {
  icon: React.ElementType
  tone?: Tone; size?: keyof typeof TILE_SIZES; className?: string
}) {
  const t = TONES[tone]
  return (
    <span className={cn('inline-flex items-center justify-center flex-shrink-0', TILE_SIZES[size], className)} style={{ background: t.bg }}>
      <Icon size={TILE_ICON[size]} strokeWidth={2} style={{ color: t.fg }} />
    </span>
  )
}

/* ───────────────────────── cards ───────────────────────── */
export const cardClass = ({ interactive = false, padded = true }: { interactive?: boolean; padded?: boolean } = {}) =>
  cn('ds-card', interactive && 'ds-card-interactive cursor-pointer', padded && 'p-4 sm:p-6')

export function Card({ interactive, padded = true, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean }) {
  return <div className={cn(cardClass({ interactive, padded }), className)} {...rest}>{children}</div>
}

/* ───────────────────────── headings ───────────────────────── */
export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5 sm:mb-7', className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-primary leading-[1.15]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] sm:text-[15px] text-secondary leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

export function SectionHeading({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3.5', className)}>
      <h2 className="text-[17px] sm:text-lg font-bold text-primary tracking-tight">{title}</h2>
      {action && <div className="text-[13px] font-medium">{action}</div>}
    </div>
  )
}

/* ───────────────────────── buttons ───────────────────────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'
const VARIANT: Record<Variant, string> = {
  primary: 'ds-btn-primary',
  secondary: 'bg-surface-elevated border border-border-strong text-primary hover:brightness-125',
  ghost: 'text-secondary hover:text-primary hover:bg-[var(--ds-hover)]',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/15',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15',
}
const SIZE: Record<Size, string> = { sm: 'h-10 px-4 text-[14px]', md: 'h-12 px-6 text-[15px]', lg: 'h-14 px-8 text-base' }

/** Class string for anything that must look like a button (<Link>, <a>, <label>). */
export const buttonClass = ({ variant = 'primary', size = 'md', full = false }: { variant?: Variant; size?: Size; full?: boolean } = {}) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold whitespace-nowrap select-none transition-all duration-150',
    'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-50 disabled:pointer-events-none',
    VARIANT[variant], SIZE[size], full && 'w-full'
  )

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean }>(
  function Button({ variant, size, full, className, type = 'button', ...rest }, ref) {
    return <button ref={ref} type={type} className={cn(buttonClass({ variant, size, full }), className)} {...rest} />
  }
)

/* ───────────────────────── status / badges ───────────────────────── */
const STATUS_TONE: Record<string, Tone> = {
  approved: 'green', success: 'green', completed: 'green', active: 'green',
  paid: 'cyan',
  pending: 'orange', processing: 'orange', open: 'orange', in_progress: 'orange',
  failed: 'red', rejected: 'red', cancelled: 'red', expired: 'red', closed: 'slate', resolved: 'green',
}

export function Badge({ tone = 'slate', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  const t = TONES[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap', className)}
      style={{ background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.fg }} />}
      {children}
    </span>
  )
}

/** Status pill: dot + word (never colour alone). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status || '').toLowerCase()
  const label = key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  return <Badge tone={STATUS_TONE[key] || 'slate'} dot className={className}>{label}</Badge>
}

/* ───────────────────────── tabs / stats / misc ───────────────────────── */
/** Segmented control for page-level views (e.g. "New request" / "History"). Purely controlled. */
export function TabBar<T extends string>({ tabs, active, onChange, className }: {
  tabs: { id: T; label: ReactNode; icon?: ReactNode }[]; active: T; onChange: (id: any) => void; className?: string
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full p-1 gap-1 rounded-2xl bg-surface-elevated border border-border-subtle', className)}>
      {tabs.map(t => {
        const on = t.id === active
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cn('inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
              on ? 'text-white shadow-[0_6px_18px_-8px_rgba(59,130,246,0.7)]' : 'text-muted hover:text-primary')}
            style={on ? { background: 'var(--ds-accent)' } : undefined}>
            {t.icon}{t.label}
          </button>
        )
      })}
    </div>
  )
}

export function StatCard({ icon, tone = 'cyan', value, label, className }: { icon: React.ComponentProps<typeof IconTile>['icon']; tone?: Tone; value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={cn('ds-card p-4 sm:p-5 text-center min-w-0', className)}>
      <IconTile icon={icon} tone={tone} size="sm" className="mx-auto mb-3 !rounded-full" />
      <p className="text-[22px] sm:text-2xl font-bold text-primary leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs text-secondary leading-snug">{label}</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-14 h-14 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
        <Icon size={24} strokeWidth={1.75} className="text-muted" />
      </div>
      <p className="text-primary font-semibold text-base mb-1">{title}</p>
      {text && <p className="text-secondary text-[14px] max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Label + control + hint/error, for forms. Style the control itself with className="ds-input". */
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-[13px] font-medium text-secondary mb-2">{label}</span>
      {children}
      {error ? <span className="block mt-1.5 text-xs text-red-400">{error}</span> : hint ? <span className="block mt-1.5 text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('rounded-2xl bg-surface-elevated animate-pulse', className)} />

/** Premium gold gift box with red ribbon — the bonus/referral icon. Decorative. */
export function GiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('w-full h-full', className)} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="ds-gift-glow" cx="50%" cy="55%" r="50%"><stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" /><stop offset="100%" stopColor="#FBBF24" stopOpacity="0" /></radialGradient>
        <linearGradient id="ds-gift-box" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCD34D" /><stop offset="100%" stopColor="#D97706" /></linearGradient>
        <linearGradient id="ds-gift-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDE68A" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient>
        <linearGradient id="ds-gift-ribbon" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#F87171" /><stop offset="50%" stopColor="#EF4444" /><stop offset="100%" stopColor="#B91C1C" /></linearGradient>
      </defs>
      <circle cx="48" cy="52" r="46" fill="url(#ds-gift-glow)" />
      <ellipse cx="48" cy="86" rx="26" ry="4" fill="#000" opacity="0.28" />
      <rect x="17" y="46" width="62" height="38" rx="6" fill="url(#ds-gift-box)" />
      <rect x="12" y="34" width="72" height="16" rx="5" fill="url(#ds-gift-lid)" />
      <rect x="42" y="34" width="12" height="50" rx="2" fill="url(#ds-gift-ribbon)" />
      <path d="M48 34 C38 16, 20 20, 26 31 C30 37, 42 36, 48 34Z" fill="url(#ds-gift-ribbon)" />
      <path d="M48 34 C58 16, 76 20, 70 31 C66 37, 54 36, 48 34Z" fill="url(#ds-gift-ribbon)" />
      <circle cx="48" cy="34" r="5" fill="#DC2626" />
      <circle cx="46.5" cy="32.5" r="1.6" fill="#fff" opacity="0.5" />
      <rect x="20" y="50" width="5" height="30" rx="2.5" fill="#fff" opacity="0.22" />
      <rect x="16" y="37" width="30" height="3.5" rx="1.75" fill="#fff" opacity="0.35" />
    </svg>
  )
}

/* ───────────────────────── payment brand icons ───────────────────────── */
type BrandDef = { bg: string; fg?: string; glyph: ReactNode; italic?: boolean }

const BRANDS: Record<string, BrandDef> = {
  crypto:    { bg: '#F7931A', glyph: '₿' },
  bitcoin:   { bg: '#F7931A', glyph: '₿' },
  btc:       { bg: '#F7931A', glyph: '₿' },
  eth:       { bg: '#627EEA', glyph: 'Ξ' },
  usdt:      { bg: '#26A17B', glyph: '₮' },
  ltc:       { bg: '#345D9D', glyph: 'Ł', italic: true },
  litecoin:  { bg: '#345D9D', glyph: 'Ł', italic: true },
  trx: { bg: '#E51C23', glyph: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[52%] h-[52%]" aria-hidden><path d="M3 12h18" /><path d="M12 3v18" /><path d="M3 12l9-9 9 9-9 9-9-9z" /></svg>
  ) },
  chime:     { bg: '#10B981', glyph: 'C' },
  cashapp:   { bg: '#22C55E', glyph: '$' },
  cash_app:  { bg: '#22C55E', glyph: '$' },
  dollarpay: { bg: '#22C55E', glyph: '$' },
  paypal:    { bg: '#3B82F6', glyph: 'P' },
  venmo:     { bg: '#3D95CE', glyph: 'V' },
  zappay:    { bg: '#8B5CF6', glyph: <Wallet className="w-[48%] h-[48%]" strokeWidth={2.2} /> },
  bank:      { bg: '#0EA5E9', glyph: <Landmark className="w-[48%] h-[48%]" strokeWidth={2.2} /> },
  applepay:  { bg: '#000000', glyph: (
    <span className="flex items-center gap-[1px] text-[0.42em] font-semibold leading-none"><Apple className="w-[1.1em] h-[1.1em]" fill="currentColor" strokeWidth={0} aria-hidden />Pay</span>
  ) },
  googlepay: { bg: '#FFFFFF', fg: '#4285F4', glyph: 'G' },
  card:      { bg: '#2563EB', glyph: <CreditCard className="w-[48%] h-[48%]" strokeWidth={2.2} /> },
  ggusonepay:{ bg: '#A855F7', glyph: <Zap className="w-[48%] h-[48%]" strokeWidth={2.2} fill="currentColor" /> },
  default:   { bg: '#8B5CF6', glyph: <Wallet className="w-[48%] h-[48%]" strokeWidth={2.2} /> },
}
const BRAND_ALIAS: Record<string, string> = { chime2: 'chime', cashapp2: 'cashapp', apple: 'applepay', google: 'googlepay', debitcard: 'card', debit_card: 'card', tron: 'trx', tether: 'usdt', ethereum: 'eth' }

/** Resolve a payment-method code/name to a brand key (falls back to a neutral wallet). */
export function brandKey(codeOrName?: string) {
  const k = (codeOrName || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '')
  const a = BRAND_ALIAS[k] || k
  return BRANDS[a] ? a : 'default'
}

const BRAND_SIZES = { sm: 'w-8 h-8 text-[15px]', md: 'w-10 h-10 text-[18px]', lg: 'w-12 h-12 text-[22px]', xl: 'w-14 h-14 text-[26px]' } as const

/** Solid brand-coloured round icon for payment methods (deposit / cashout / crypto). */
export function BrandIcon({ kind, size = 'lg', glow, className }: {
  kind: string; size?: keyof typeof BRAND_SIZES; glow?: boolean; className?: string
}) {
  const b = BRANDS[brandKey(kind)]
  return (
    <span
      aria-hidden
      className={cn('inline-flex items-center justify-center flex-shrink-0 rounded-full font-bold leading-none select-none', BRAND_SIZES[size], b.italic && 'italic', className)}
      style={{
        background: b.bg, color: b.fg || '#fff',
        boxShadow: [glow ? `0 0 16px ${b.bg}66` : '', b.bg === '#000000' ? 'inset 0 0 0 1px rgba(255,255,255,0.22)' : ''].filter(Boolean).join(',') || undefined,
      }}
    >
      {b.glyph}
    </span>
  )
}
