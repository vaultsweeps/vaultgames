'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

interface RemoveGameLoginModalProps {
  isOpen: boolean
  onClose: () => void
  // confirmBurn is true only when the player ticked the box acknowledging the balance will be lost
  onConfirm: (confirmBurn: boolean) => void
  loading: boolean
  gameName: string
  gameThumbnail?: string | null
  accountName: string
  balance: number
}

export default function RemoveGameLoginModal({ isOpen, onClose, onConfirm, loading, gameName, gameThumbnail, accountName, balance }: RemoveGameLoginModalProps) {
  const [understood, setUnderstood] = useState(false)
  useEffect(() => { if (!isOpen) setUnderstood(false) }, [isOpen])
  // A balance change while the popup is open (e.g. the server found money) must be accepted again
  useEffect(() => { setUnderstood(false) }, [balance])

  if (!isOpen) return null
  const hasBalance = balance >= 0.01
  const canRemove = !loading && (!hasBalance || understood)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={loading ? undefined : onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          role="dialog" aria-modal="true" aria-label="Remove login"
          className="relative z-10 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0F1220] border border-white/10 p-5 sm:p-6 shadow-2xl shadow-black/80"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-bold text-2xl leading-tight">Remove login</h3>
              <p className="text-slate-400 text-[15px] mt-1">Do you really want to remove your game username?</p>
            </div>
            <button onClick={onClose} disabled={loading} aria-label="Close" className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-40">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#171B2E] border border-white/5 p-4">
            {gameThumbnail ? (
              <Image src={gameThumbnail} alt={gameName} width={72} height={72} unoptimized className="w-[72px] h-[72px] rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-2xl bg-white/5 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-xl truncate">{gameName}</p>
              <div className="mt-1 flex gap-6 text-sm min-w-0">
                <div className="min-w-0">
                  <p className="text-slate-500">Login</p>
                  <p className="text-white font-bold truncate">{accountName}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-slate-500">Balance</p>
                  <p className={`font-bold tabular-nums ${hasBalance ? 'text-red-400' : 'text-white'}`}>${balance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl p-4"
            style={hasBalance
              ? { background: 'rgba(239,68,68,0.10)', boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.5)' }
              : { background: 'rgba(245,158,11,0.10)', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.45)' }}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${hasBalance ? 'text-red-400' : 'text-amber-400'}`} />
            <p className={`text-[14px] leading-relaxed ${hasBalance ? 'text-red-100' : 'text-amber-100'}`}>
              {hasBalance
                ? <>When you remove a login, the entire balance is <b>burned</b>. Your ${balance.toFixed(2)} will be taken out of the game and <b>cannot be recovered, cashed out or credited</b> to your wallet. Cash out first if you want to keep it.</>
                : 'This login will be removed from VaultSweeps and its password will be changed, so it can no longer be used. You can get a new login any time. You can remove a game login 2 times every 7 days.'}
            </p>
          </div>

          {hasBalance && (
            <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} disabled={loading} className="mt-1 w-4 h-4 accent-red-500" />
              <span className="text-[14px] text-slate-200 leading-snug">I understand that my ${balance.toFixed(2)} balance will be permanently lost.</span>
            </label>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => onConfirm(hasBalance && understood)}
              disabled={!canRemove}
              className={`flex-1 rounded-2xl text-white font-bold py-3.5 transition disabled:opacity-50 disabled:cursor-not-allowed ${hasBalance ? 'bg-red-500 hover:bg-red-400' : 'bg-[#4DA8FF] hover:bg-[#6BB7FF]'}`}
            >
              {loading ? 'Removing…' : hasBalance ? 'Burn balance & remove' : 'Remove'}
            </button>
            <button onClick={onClose} disabled={loading} className="flex-1 rounded-2xl bg-[#171B2E] hover:bg-[#1f2440] border border-white/10 text-slate-300 font-bold py-3.5 transition disabled:opacity-50">
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
