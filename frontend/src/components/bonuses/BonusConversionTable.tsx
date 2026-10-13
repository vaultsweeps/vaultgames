'use client'
import { ChevronRight, Check, Gift } from 'lucide-react'

export interface ConversionRule {
  id: string
  sourceTypes: string[]
  minAmount: number
  maxAmount: number
  walletCreditAmount: number
}

const TYPE_LABELS: Record<string, string> = {
  FREEPLAY: 'Freeplay',
  REFERRAL_BONUS: 'Referral Bonus',
  COUPON: 'Coupon',
  CRYPTO_BONUS: 'Crypto Bonus',
  FREE_SPIN: 'Free Spin',
}
const ALL_TYPES = Object.keys(TYPE_LABELS)

const isAll = (types: string[]) => !types || types.length === 0 || types.includes('ALL')
const money = (n: number) => `$${n.toFixed(2)}`

// Presentation only: renders the rules it is given (already fetched by the caller) as a premium card list.
export default function BonusConversionTable({ rules }: { rules: ConversionRule[] }) {
  const covered = rules.some(r => isAll(r.sourceTypes))
    ? ALL_TYPES
    : ALL_TYPES.filter(t => rules.some(r => r.sourceTypes.includes(t)))
  const shown = covered.length > 0 ? covered : ALL_TYPES

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className="flex items-center gap-3 sm:gap-4" aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-sky-400/50" />
        <span className="text-[11px] sm:text-[13px] font-bold tracking-[0.2em] uppercase text-sky-300 whitespace-nowrap">Bonus winnings → Wallet credit</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-sky-400/50" />
      </div>

      <div className="flex items-center gap-3 sm:gap-4 rounded-2xl p-3 sm:p-4"
        style={{ background: 'linear-gradient(135deg, rgba(14,40,90,0.7), rgba(10,20,50,0.7))', boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.4), 0 0 24px -10px rgba(56,189,248,0.5)' }}>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Gift className="w-8 h-8 sm:w-9 sm:h-9 text-sky-300" strokeWidth={1.6} />
          <span className="text-[13px] sm:text-[15px] font-extrabold leading-tight text-white tracking-wide">BONUS<br />TYPE</span>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
          {shown.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-[13px] font-semibold text-sky-100"
              style={{ background: 'rgba(37,99,235,0.28)', boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.55)' }}>
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300" strokeWidth={3} />{TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </div>

      <div role="table" aria-label="Bonus cashout conversion rules" className="space-y-3 sm:space-y-3.5">
        {rules.map(r => (
          <div key={r.id} role="row"
            className="relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4"
            style={{ background: 'linear-gradient(120deg, rgba(10,20,50,0.9) 55%, rgba(76,29,149,0.45))', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.45), 0 10px 26px -16px rgba(0,0,0,0.8)' }}>
            <div role="cell" className="min-w-0">
              <p className="text-[10px] sm:text-[12px] font-bold tracking-[0.16em] uppercase text-sky-300/90">Winnings range</p>
              <p className="mt-0.5 text-[22px] sm:text-[28px] font-extrabold leading-none text-white tabular-nums whitespace-nowrap">
                {`$${Math.round(r.minAmount) === r.minAmount ? r.minAmount : r.minAmount.toFixed(2)} – $${Math.round(r.maxAmount) === r.maxAmount ? r.maxAmount : r.maxAmount.toFixed(2)}`}
              </p>
              {!isAll(r.sourceTypes) && (
                <p className="mt-1 text-[11px] text-slate-400 truncate">{r.sourceTypes.map(s => TYPE_LABELS[s] || s).join(', ')}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" aria-hidden />
            <div role="cell" className="flex-shrink-0 text-left">
              <p className="text-[10px] sm:text-[12px] font-bold tracking-[0.16em] uppercase text-violet-300/90 mb-1">Wallet credit</p>
              <span className="inline-block rounded-full px-5 sm:px-7 py-1.5 sm:py-2 text-[17px] sm:text-[22px] font-extrabold text-white tabular-nums"
                style={{ background: 'linear-gradient(90deg, #2563eb, #7c3aed)', boxShadow: '0 0 18px -2px rgba(99,102,241,0.7), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                {money(r.walletCreditAmount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
