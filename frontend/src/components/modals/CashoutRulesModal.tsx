'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'

interface CashoutRulesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CashoutRulesModal({ isOpen, onClose }: CashoutRulesModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#090b11] w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Header */}
          <div className="p-6 pb-2 relative flex flex-col items-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-white font-black text-2xl tracking-widest uppercase">
              CASHOUT <span className="text-[#8b5cf6]">LIMITS</span>
            </h2>
          </div>

          {/* Table */}
          <div className="p-6 pt-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[#1e293b]/50 text-[#3b82f6] font-bold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 border-b border-white/5">DEPOSIT</th>
                    <th className="px-6 py-4 border-b border-white/5">MINIMUM</th>
                    <th className="px-6 py-4 border-b border-white/5">MAXIMUM</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 font-medium divide-y divide-white/5 bg-[#0f172a]/30">
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$5</td>
                    <td className="px-6 py-3.5">$50</td>
                    <td className="px-6 py-3.5">$50</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$6-$9</td>
                    <td className="px-6 py-3.5">$50</td>
                    <td className="px-6 py-3.5">$100</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$10-$15</td>
                    <td className="px-6 py-3.5">$50</td>
                    <td className="px-6 py-3.5">X15</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$16-$25</td>
                    <td className="px-6 py-3.5">X3</td>
                    <td className="px-6 py-3.5">X15</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$26-$35</td>
                    <td className="px-6 py-3.5">X3</td>
                    <td className="px-6 py-3.5">X15</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$36-$50</td>
                    <td className="px-6 py-3.5">X3</td>
                    <td className="px-6 py-3.5">X15</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5 text-white font-bold">$50+</td>
                    <td className="px-6 py-3.5">X3</td>
                    <td className="px-6 py-3.5">$2000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="mt-4 bg-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border border-white/5">
              <div className="space-y-1 text-sm whitespace-nowrap">
                <p className="font-mono text-slate-300">MINIMUM DEPOSIT: <span className="text-cyan-400 font-bold">$5</span></p>
                <p className="font-mono text-slate-300">MAXIMUM PER TRANSACTION: <span className="text-cyan-400 font-bold">$2000</span></p>
                <p className="font-mono text-slate-300">DAILY WITHDRAWALS: <span className="text-green-400 font-bold">Unlimited</span></p>
              </div>
              <div className="flex items-start gap-2 text-yellow-500 text-xs font-medium max-w-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>NOTE: winning above the maximum limit is voided by the system.</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
