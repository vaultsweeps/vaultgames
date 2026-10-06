'use client'
import { BRANDS, type ManualBrand } from '@/lib/manualDepositAccounts'

interface Props {
  brand: ManualBrand
  /** Main line — the account holder's first name (or the app name for a group tile) */
  title: string
  /** Small line under the title — defaults to the app name; pass '' for none */
  subtitle?: string
  /** Text inside the logo circle — defaults to the brand wordmark */
  logo?: string
  onClick: () => void
}

/** Deposit tile for manual send-to-tag methods (Chime / CashApp / PayPal / Venmo): logo on the left, name beside it. */
export default function ManualAccountTile({ brand, title, subtitle, logo, onClick }: Props) {
  const b = BRANDS[brand]
  const logoText = logo || b.logoText || title.trim()[0]?.toUpperCase() || '?'
  const wordmark = logoText.length > 1
  const sub = subtitle ?? b.label
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full h-[110px] text-left rounded-[20px] overflow-hidden px-2.5 sm:px-4 flex items-center gap-2 sm:gap-3 border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5"
    >
      <div
        className="shrink-0 w-[clamp(32px,9.5vw,56px)] h-[clamp(32px,9.5vw,56px)] rounded-full flex items-center justify-center text-white font-bold leading-none"
        style={{ background: b.bg, boxShadow: `0 0 16px ${b.glow}` }}
      >
        <span className={wordmark ? 'text-[clamp(8px,2.4vw,13px)] tracking-tighter' : 'text-[clamp(17px,5.4vw,26px)]'}>{logoText}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-white font-bold text-[clamp(12px,4.1vw,17px)] leading-tight whitespace-nowrap">{title}</p>
        {sub && <p className="text-slate-300/75 text-[clamp(11px,3.2vw,13px)] leading-tight mt-0.5 whitespace-nowrap">{sub}</p>}
      </div>
    </button>
  )
}
