'use client'
import { ArrowRight, Check, Clock, type LucideIcon } from 'lucide-react'

/** One verification card: what it is, whether it's done, and (if not) the button to do it. */
export default function StatusCard({ icon: Icon, verified, doneLabel, todoLabel, buttonLabel, onVerify, loading }: {
  icon: LucideIcon; verified: boolean; doneLabel: string; todoLabel: string; buttonLabel: string; onVerify: () => void; loading?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center text-center gap-3 p-4 sm:p-6 rounded-[20px] border transition-colors ${
        verified ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'
      }`}
    >
      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border bg-black/40 flex items-center justify-center ${verified ? 'border-emerald-500/40' : 'border-white/[0.1]'}`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white/90" />
      </div>

      {verified ? (
        <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_14px_rgba(16,185,129,0.5)]" aria-hidden>
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span className="w-7 h-7 rounded-full border-2 border-amber-400 flex items-center justify-center" aria-hidden>
          <Clock className="w-4 h-4 text-amber-400" />
        </span>
      )}

      <p className={`font-bold leading-snug text-[15px] sm:text-[17px] ${verified ? 'text-emerald-400' : 'text-amber-400'}`}>
        {verified ? doneLabel : todoLabel}
      </p>

      {!verified && (
        <button
          type="button"
          onClick={onVerify}
          disabled={loading}
          className="mt-auto w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold text-sm sm:text-[15px] py-2.5 shadow-[0_0_18px_rgba(79,70,229,0.35)] transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{buttonLabel} <ArrowRight className="w-4 h-4" /></>}
        </button>
      )}
    </div>
  )
}
