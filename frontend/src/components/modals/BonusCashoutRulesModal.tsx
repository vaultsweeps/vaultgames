'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle } from 'lucide-react'
import { publicApi } from '@/lib/api'

interface BonusCashoutRule {
  id: string
  sourceTypes: string[]
  minAmount: number
  maxAmount: number
  walletCreditAmount: number
  priority: number
}

interface BonusCashoutRulesModalProps {
  isOpen: boolean
  onClose: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  ALL: 'All bonus types',
  CRYPTO_BONUS: 'Crypto Bonus',
  FREEPLAY: 'Freeplay',
  REFERRAL_BONUS: 'Referral Bonus',
  COUPON: 'Coupon',
  FREE_SPIN: 'Free Spin',
}

function describeSourceTypes(sourceTypes: string[]): string {
  if (!sourceTypes || sourceTypes.length === 0 || sourceTypes.includes('ALL')) return 'All bonus types'
  return sourceTypes.map((s) => SOURCE_LABELS[s] || s).join(', ')
}

export default function BonusCashoutRulesModal({ isOpen, onClose }: BonusCashoutRulesModalProps) {
  const [rules, setRules] = useState<BonusCashoutRule[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    publicApi.getBonusCashoutRules()
      .then((res) => setRules(res.data?.data || []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-[#0F0F17] border border-[#2AC3FF]/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/80 max-h-[95vh] overflow-y-auto flex flex-col"
        >
          <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0F0F17] p-6 border-b border-white/5">
            <div className="absolute inset-0 bg-[#2AC3FF]/5 pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#2AC3FF] text-xs font-mono tracking-[0.3em] uppercase mb-1">Vault Sweeps</p>
                <h3 className="text-white font-display font-bold text-2xl tracking-wide">
                  BONUS CASHOUT <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2AC3FF] to-[#7B2FFF]">RULES</span>
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-secondary hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-secondary">
              Winnings from a game session funded by Bonus Balance convert to Wallet Balance according to the table below,
              based on your total winnings for that session. Only the listed amount becomes real, withdrawable Wallet Balance.
            </p>

            {loading ? (
              <div className="text-center text-muted text-sm py-8">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">No active bonus cashout rules right now.</div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#2AC3FF]/10">
                      {['BONUS TYPE', 'WINNINGS RANGE', 'WALLET CREDIT'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[#2AC3FF] font-mono text-xs tracking-widest font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rules.map((rule, i) => (
                      <tr key={rule.id} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'} hover:bg-[#2AC3FF]/5 transition-colors`}>
                        <td className="px-4 py-3 text-white font-semibold">{describeSourceTypes(rule.sourceTypes)}</td>
                        <td className="px-4 py-3 text-emerald-400 font-mono font-bold">${rule.minAmount.toFixed(2)} – ${rule.maxAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[#2AC3FF] font-mono font-bold">${rule.walletCreditAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs leading-relaxed">
                <span className="font-bold text-amber-400">NOTE: </span>
                Bonus funds are promotional. Winnings outside any listed range do not convert to Wallet Balance.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3 rounded-xl transition-all text-sm"
            >
              Got it!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
