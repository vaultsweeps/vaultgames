import Footer from '@/components/layout/Footer'
import { CheckCircle, Shield, AlertCircle, ArrowDownToLine, ArrowUpToLine, Timer, Wallet, Infinity as InfinityIcon } from 'lucide-react'

const RULES = [
  { icon: ArrowDownToLine, title: 'Minimum Cashout', value: '$50', desc: 'The minimum amount per withdrawal request is $50 USD.', color: '#00D4FF' },
  { icon: ArrowUpToLine, title: 'Maximum Cashout', value: '$2000', desc: 'Maximum single withdrawal is $2000 per transaction. Unlimited withdrawals throughout the day.', color: '#7B2FFF' },
  { icon: Timer, title: 'Processing Time', value: 'Under 10 Mins', desc: 'Cashouts are reviewed and processed by our team in under 10 minutes.', color: '#00FFC8' },
]

const STEPS = [
  { step: '01', title: 'Submit Request', desc: 'Go to Dashboard > Cashouts and fill in your withdrawal details.' },
  { step: '02', title: 'Admin Review', desc: 'Our team reviews your request in under 10 minutes for security checks.' },
  { step: '03', title: 'Approval', desc: 'Once approved, your cashout is processed to your chosen payment method.' },
  { step: '04', title: 'Funds Received', desc: 'Funds arrive based on your payment method (crypto is fastest).' },
]

const LIMITS = [
  { deposit: '$5', min: '$50', max: '$50' },
  { deposit: '$6-$9', min: '$50', max: '$100' },
  { deposit: '$10-$15', min: '$50', max: 'X15' },
  { deposit: '$16-$25', min: 'X3', max: 'X15' },
  { deposit: '$26-$35', min: 'X3', max: 'X15' },
  { deposit: '$36-$50', min: 'X3', max: 'X15' },
  { deposit: '$50+', min: 'X3', max: '$2000' },
]

const FACTS = [
  { icon: Wallet, label: 'Minimum Deposit', value: '$5', color: '#00D4FF' },
  { icon: ArrowUpToLine, label: 'Maximum Per Transaction', value: '$2000', color: '#7B2FFF' },
  { icon: InfinityIcon, label: 'Daily Withdrawals', value: 'Unlimited', color: '#34D399' },
]

const TERMS = [
  'Bonus funds are subject to wagering requirements before withdrawal eligibility',
  'Withdrawal requests may be delayed during peak periods or for additional verification',
  'All withdrawals are processed in USD equivalent',
  'Users must provide accurate and verified payment information',
  'Vault Sweeps reserves the right to request identity verification at any time',
  'Daily withdrawal limit: Unlimited for standard and VIP accounts',
]

const card = 'relative rounded-3xl border border-border-subtle bg-surface'
const cardShadow = { boxShadow: '0 18px 50px -28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)' } as const

function SectionTitle({ lead, accent }: { lead: string; accent: string }) {
  return (
    <h2 className="font-display font-bold text-[22px] sm:text-[28px] leading-tight text-primary text-center tracking-wide">
      {lead} <span className="gradient-text">{accent}</span>
    </h2>
  )
}

export default function CashoutRulesPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 pb-28 sm:pb-20 overflow-x-clip">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">

          {/* Hero */}
          <div className="relative text-center mb-10 sm:mb-14">
            <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[520px] max-w-full h-52 rounded-full opacity-60"
              style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.22), transparent)' }} />
            <p className="relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.22em] uppercase text-neon-blue mb-4"
              style={{ background: 'rgba(0,212,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(0,212,255,0.22)' }}>
              <Shield className="w-3.5 h-3.5" /> Withdrawals
            </p>
            <h1 className="relative font-display font-bold text-[34px] min-[400px]:text-[40px] sm:text-6xl leading-[1.08] text-primary mb-4">
              CASHOUT <span className="gradient-text">RULES</span>
            </h1>
            <p className="relative text-secondary text-[16px] sm:text-lg leading-relaxed max-w-xl mx-auto">
              Everything you need to know about withdrawing your winnings.
            </p>
          </div>

          {/* Key numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
            {RULES.map((r, i) => (
              <div key={i} className={`${card} p-5 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5`}
                style={{ ...cardShadow, backgroundImage: `linear-gradient(160deg, ${r.color}14 0%, transparent 55%)` }}>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center"
                    style={{ background: `${r.color}1F`, boxShadow: `inset 0 0 0 1px ${r.color}40` }}>
                    <r.icon className="w-6 h-6" style={{ color: r.color }} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-secondary leading-tight">{r.title}</p>
                    <p className="text-[26px] sm:text-[20px] md:text-[22px] font-bold text-primary leading-tight tracking-tight mt-0.5">{r.value}</p>
                  </div>
                </div>
                <p className="mt-3.5 text-[14px] leading-relaxed text-secondary">{r.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <section className={`${card} p-5 sm:p-8 mb-8 sm:mb-10`} style={cardShadow}>
            <SectionTitle lead="HOW IT" accent="WORKS" />
            <ol className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {STEPS.map((s, i) => (
                <li key={i} className="relative flex gap-4">
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="sm:hidden absolute left-[19px] top-11 bottom-[-20px] w-px"
                      style={{ background: 'linear-gradient(to bottom, rgba(0,212,255,0.4), rgba(123,47,255,0.08))' }} />
                  )}
                  <span className="relative w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #22D3EE, #3B82F6, #8B5CF6)', boxShadow: '0 8px 20px -8px rgba(59,130,246,0.7)' }}>
                    {s.step}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[16px] font-semibold text-primary leading-snug">{s.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-secondary">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Limits */}
          <section className={`${card} p-4 sm:p-8 mb-8 sm:mb-10`} style={cardShadow}>
            <SectionTitle lead="CASHOUT" accent="LIMITS" />

            <div role="table" aria-label="Cashout limits by deposit amount" className="mt-6 sm:mt-8 rounded-2xl overflow-hidden border border-border-subtle">
              <div role="rowgroup">
                <div role="row" className="grid grid-cols-[1.15fr_1fr_1fr] gap-2 px-3.5 sm:px-6 py-3 text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider"
                  style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.14), rgba(139,92,246,0.14))' }}>
                  <span role="columnheader" className="text-sky-400">Deposit</span>
                  <span role="columnheader" className="text-sky-400">Minimum</span>
                  <span role="columnheader" className="text-violet-400">Maximum</span>
                </div>
              </div>
              <div role="rowgroup">
                {LIMITS.map((l, i) => {
                  const last = i === LIMITS.length - 1
                  return (
                    <div key={i} role="row"
                      className="grid grid-cols-[1.15fr_1fr_1fr] gap-2 items-center px-3.5 sm:px-6 py-3 sm:py-3.5 text-[14px] sm:text-[15px] tabular-nums border-t border-border-subtle first:border-t-0"
                      style={last ? { background: 'linear-gradient(90deg, rgba(34,211,238,0.07), rgba(139,92,246,0.10))' } : i % 2 === 0 ? { background: 'color-mix(in srgb, var(--bg-surface-elevated) 55%, transparent)' } : undefined}>
                      <span role="cell" className="font-bold text-primary">{l.deposit}</span>
                      <span role="cell" className="font-medium text-secondary">{l.min}</span>
                      <span role="cell" className="font-semibold text-primary">{l.max}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-1 min-[400px]:grid-cols-3 gap-3">
              {FACTS.map((f, i) => (
                <div key={i} className="rounded-2xl bg-surface-elevated border border-border-subtle p-3.5 flex min-[400px]:flex-col items-center min-[400px]:items-start gap-3 min-[400px]:gap-2">
                  <span className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${f.color}1F`, boxShadow: `inset 0 0 0 1px ${f.color}40` }}>
                    <f.icon className="w-[18px] h-[18px]" style={{ color: f.color }} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1 min-[400px]:flex-none flex min-[400px]:block items-baseline justify-between gap-3">
                    <dt className="text-[13px] text-secondary leading-snug">{f.label}</dt>
                    <dd className="text-[18px] font-bold text-primary leading-tight min-[400px]:mt-0.5">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-start gap-3 rounded-2xl p-3.5 sm:p-4"
              style={{ background: 'rgba(251,191,36,0.08)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.25)' }}>
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-[14px] leading-relaxed text-secondary">
                <span className="font-bold uppercase tracking-wide text-yellow-500">Note:</span> winning above the maximum limit is voided by the system
              </p>
            </div>
          </section>

          {/* Terms */}
          <section className="rounded-3xl p-5 sm:p-7 bg-surface" style={{ boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.22), 0 18px 50px -28px rgba(0,0,0,0.6)', backgroundImage: 'linear-gradient(160deg, rgba(251,191,36,0.06), transparent 50%)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.14)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.3)' }}>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </span>
              <h2 className="text-[17px] sm:text-[18px] font-bold text-yellow-400 leading-snug">Important Terms &amp; Conditions</h2>
            </div>
            <ul className="space-y-3">
              {TERMS.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-secondary">
                  <CheckCircle className="w-[18px] h-[18px] flex-shrink-0 mt-[3px] text-yellow-500/80" strokeWidth={2} />
                  <span className="min-w-0 break-words">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
