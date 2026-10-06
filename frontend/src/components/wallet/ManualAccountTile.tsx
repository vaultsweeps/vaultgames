'use client'
import { BRANDS, type ManualBrand } from '@/lib/manualDepositAccounts'

interface Props {
  brand: ManualBrand
  /** Big line — the account holder's first name (or the brand name for a group tile) */
  title: string
  /** Small line under the title — defaults to the brand name */
  subtitle?: string
  badge?: string
  /** Text inside the logo circle — defaults to the brand wordmark */
  logo?: string
  onClick: () => void
}

/** Deposit tile for manual send-to-tag methods (Chime / Cash App / PayPal / Venmo). */
export default function ManualAccountTile({ brand, title, subtitle, badge = 'No fee', logo, onClick }: Props) {
  const b = BRANDS[brand]
  const logoText = logo || b.logoText || title.trim()[0]?.toUpperCase() || '?'
  const wordmark = logoText.length > 1
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full h-[110px] text-left rounded-[20px] p-3.5 sm:p-4 flex items-center gap-3 overflow-hidden border border-[#3B5BDB]/30 bg-gradient-to-br from-[#16213F] to-[#0E1630] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-[#4C7DFF]/60 hover:shadow-[0_0_24px_rgba(76,125,255,0.25)] hover:-translate-y-0.5"
    >
      <div
        className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold leading-none"
        style={{ background: b.bg, boxShadow: `0 0 16px ${b.glow}` }}
      >
        <span className={wordmark ? 'text-[12px] sm:text-[14px] tracking-tight' : 'text-[22px] sm:text-[26px]'}>{logoText}</span>
      </div>

      <div className="min-w-0 flex-1 pt-4">
        <p className="text-white font-bold text-[16px] sm:text-[18px] leading-tight break-words">{title}</p>
        <p className="text-slate-300/80 text-[12px] sm:text-[13px] leading-tight mt-0.5 truncate">{subtitle ?? b.label}</p>
      </div>

      {badge && (
        <span className="absolute top-2.5 right-2.5 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/70 text-emerald-300 bg-emerald-500/10">
          {badge}
        </span>
      )}
    </button>
  )
}
