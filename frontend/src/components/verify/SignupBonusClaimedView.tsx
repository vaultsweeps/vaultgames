'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Gift, Check, Gamepad2, Users, Sparkles } from 'lucide-react'

interface Props {
  /** true: the 100% signup bonus was paid on their first recharge. false: their first recharge happened without it. */
  claimed: boolean
  onContinue?: () => void
}

/**
 * Shown on the Verify page when a fully verified player opens it after the one-time 100% signup bonus is already used:
 * says so clearly, and points them at the 30% bonus they get on every recharge from now on.
 */
export default function SignupBonusClaimedView({ claimed, onContinue }: Props) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      {/* Gift badge with a soft pulsing glow and a "done" tick */}
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.25)]">
          <Gift className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-300" strokeWidth={1.75} />
        </div>
        <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-[#0f1016] flex items-center justify-center shadow-[0_0_14px_rgba(16,185,129,0.6)]">
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </span>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {claimed ? 'Signup bonus already claimed' : 'Your first recharge is done'}
        </h2>
        <p className="text-secondary text-sm sm:text-[15px] mt-1.5 max-w-sm mx-auto leading-relaxed">
          {claimed
            ? "You've already claimed your 100% signup bonus — thank you for joining Vault Sweeps!"
            : 'The 100% signup bonus is a one-time reward on your very first recharge, which has already been made.'}
        </p>
      </div>

      {/* what they get from here on */}
      <div className="w-full rounded-2xl p-[1px] bg-gradient-to-br from-amber-300/70 via-amber-500/20 to-purple-500/40">
        <div className="rounded-[15px] bg-[#13121d] px-4 py-4 sm:px-5 sm:py-5 flex items-center gap-4 text-left">
          <div
            className="shrink-0 text-4xl sm:text-5xl font-black leading-none bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(180deg, #FDE047, #F59E0B)' }}
          >
            30%
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black tracking-[0.16em] text-amber-300">
              <Sparkles className="w-3.5 h-3.5" /> REGULAR BONUS
            </p>
            <p className="text-sm sm:text-[15px] text-white/90 leading-snug mt-1">
              You get <b className="text-white">30% extra</b> directly in your game every time you add cash —{' '}
              <span className="text-white/70">it&apos;s added in the game, not to your wallet balance.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-2.5">
        <Link
          href="/games"
          onClick={onContinue}
          className="w-full btn-primary py-3.5 text-base rounded-[16px] inline-flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
        >
          <Gamepad2 className="w-5 h-5" /> Add cash in a game
        </Link>
        <Link
          href="/dashboard/invite"
          onClick={onContinue}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-[16px] text-sm font-bold text-secondary hover:text-white border border-white/10 hover:border-white/25 transition-colors"
        >
          <Users className="w-4 h-4" /> Invite friends &amp; earn up to $10
        </Link>
      </div>
    </div>
  )
}
