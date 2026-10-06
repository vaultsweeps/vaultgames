'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift, MessageCircle, CheckCircle2, Circle, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusApi } from '@/lib/api'
import { getSignalContact, SignalContact } from '@/lib/signal'
import { useAuthStore } from '@/store/authStore'

interface FreeplayStatus {
  eligible: boolean
  amount: number
  minDeposit: number
  recentDeposits: number
  checks: { accountActive: boolean; depositRequirementMet: boolean; notClaimedThisWeek: boolean }
}

const SIGNAL_BLUE = '#3A76F0'

/**
 * Sunday $3 Freeplay is claimed by texting staff on Signal (no automatic grant) — this card lists the
 * eligibility rules, shows a signed-in customer whether they qualify right now, and gives ONE Signal button
 * whose link follows the staff shift (4 AM–4 PM / 4 PM–4 AM New York time).
 */
export default function SundayFreeplayCard({ className = '' }: { className?: string }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const username = useAuthStore(s => s.user?.username)
  const [contact, setContact] = useState<SignalContact | null>(null)
  const [status, setStatus] = useState<FreeplayStatus | null>(null)

  // Resolved on the client only (time-dependent), and refreshed every minute so a page left open across
  // 4 AM / 4 PM switches to the shift that's actually on.
  useEffect(() => {
    setContact(getSignalContact())
    const t = setInterval(() => setContact(getSignalContact()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setStatus(null); return }
    bonusApi.getSundayFreeplayStatus()
      .then(res => setStatus(res.data?.data || null))
      .catch(() => setStatus(null))
  }, [isAuthenticated])

  const criteria = [
    { text: 'Active account in good standing', met: status?.checks.accountActive },
    {
      text: 'At least $5 in approved deposits in the last 7 days',
      met: status?.checks.depositRequirementMet,
      detail: status ? `You have $${status.recentDeposits.toFixed(2)} in the last 7 days` : undefined,
    },
    { text: 'One Freeplay per week (Sunday – Saturday)', met: status?.checks.notClaimedThisWeek },
  ]

  let statusLine: { text: string; color: string } | null = null
  if (status) {
    if (status.eligible) statusLine = { text: 'You qualify this week — text us on Signal to claim your $3!', color: '#34D399' }
    else if (!status.checks.notClaimedThisWeek) statusLine = { text: "You've already received this week's Freeplay. See you next Sunday!", color: '#00D4FF' }
    else if (!status.checks.depositRequirementMet) statusLine = { text: `Deposit $${Math.max(0, status.minDeposit - status.recentDeposits).toFixed(2)} more this week to qualify.`, color: '#FBBF24' }
    else statusLine = { text: 'Your account is not eligible right now. Contact support for help.', color: '#F87171' }
  }

  const copyUsername = () => {
    if (!username) return
    navigator.clipboard.writeText(username).then(() => toast.success('Username copied')).catch(() => {})
  }

  return (
    <section
      className={`relative overflow-hidden rounded-3xl p-5 sm:p-8 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.14), rgba(123,47,255,0.16))',
        boxShadow: 'inset 0 0 0 1.5px rgba(0,212,255,0.4), 0 18px 50px -24px rgba(0,180,255,0.35)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-50"
        style={{ background: 'radial-gradient(closest-side, rgba(0,212,255,0.35), transparent)' }} />

      <div className="relative text-center">
        <p className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold tracking-[0.2em] uppercase text-amber-300 mb-3"
          style={{ background: 'rgba(251,191,36,0.12)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.35)' }}>
          <Gift className="w-3.5 h-3.5" /> Every Sunday
        </p>
        <h2 className="font-display font-bold text-[26px] sm:text-[34px] leading-tight text-primary mb-2">
          Claim <span className="gradient-text">$3 Free</span> Every Sunday
        </h2>
        <p className="text-secondary text-[14px] sm:text-base leading-relaxed max-w-lg mx-auto">
          Text us on Signal on Sunday and we&apos;ll add $3 Freeplay to your Bonus Balance.
        </p>
      </div>

      <div className="relative mt-6 grid gap-4 md:grid-cols-2 max-w-3xl mx-auto text-left">
        {/* Eligibility */}
        <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-sky-300 mb-3">Who can claim</h3>
          <ul className="space-y-2.5">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug">
                {c.met === true
                  ? <CheckCircle2 className="w-[18px] h-[18px] flex-shrink-0 mt-px text-emerald-400" />
                  : c.met === false
                    ? <Circle className="w-[18px] h-[18px] flex-shrink-0 mt-px text-amber-400" />
                    : <CheckCircle2 className="w-[18px] h-[18px] flex-shrink-0 mt-px text-sky-400/70" />}
                <span className="text-primary">
                  {c.text}
                  {c.detail && <span className="block text-[12px] text-secondary mt-0.5">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* How to claim */}
        <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-sky-300 mb-3">How to claim</h3>
          <ol className="space-y-2.5 text-[14px] leading-snug text-primary">
            <li className="flex gap-2.5"><span className="font-bold text-sky-400">1.</span><span>On Sunday, tap the button below to open Signal.</span></li>
            <li className="flex gap-2.5">
              <span className="font-bold text-sky-400">2.</span>
              <span>
                Send us your Vault Sweeps username
                {username && (
                  <button type="button" onClick={copyUsername} className="ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-sky-300 hover:text-white"
                    style={{ background: 'rgba(0,212,255,0.12)' }} aria-label="Copy your username">
                    {username} <Copy className="w-3 h-3" />
                  </button>
                )}
                {' '}and ask for your Sunday Freeplay.
              </span>
            </li>
            <li className="flex gap-2.5"><span className="font-bold text-sky-400">3.</span><span>We verify and add $3 to your Bonus Balance.</span></li>
          </ol>
          <p className="mt-3 text-[12px] text-secondary leading-relaxed">
            Freeplay follows the <Link href="/bonus-cashout-rules" className="text-sky-300 underline hover:text-white">Bonus Cashout Rules</Link>.
          </p>
        </div>
      </div>

      {statusLine && (
        <p className="relative mt-5 text-center text-[14px] font-semibold" style={{ color: statusLine.color }}>{statusLine.text}</p>
      )}

      <div className="relative mt-5 flex flex-col items-center gap-2">
        <a
          href={contact?.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!contact}
          className="inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-105 active:scale-95 w-full sm:w-auto"
          style={{ background: SIGNAL_BLUE, boxShadow: '0 10px 28px -10px rgba(58,118,240,0.7)' }}
        >
          <MessageCircle className="w-5 h-5" /> Text us on Signal to claim
        </a>
        <p className="text-[12px] text-secondary text-center">
          Day team 4 AM – 4 PM · Night team 4 PM – 4 AM (New York time) — the button connects you to whoever&apos;s on now.
        </p>
      </div>
    </section>
  )
}
