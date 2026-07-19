'use client'
import React from 'react';
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, AlertCircle, Banknote } from 'lucide-react'

interface GameTransferModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'deposit' | 'cashout'
  gameName: string
  gameThumbnail: string | null
  accountName: string
  gameBalance: number
  walletBalance: number
  totalDeposited: number
  startAmount: number
  onTransfer: (amount: number, type: 'recharge' | 'withdraw') => Promise<void>
  onChangeGame?: () => void
  onRefresh?: () => Promise<void>
}

const presets = [
  { label: '+5', value: 5 },
  { label: '+10', value: 10 },
  { label: '+25', value: 25 },
  { label: 'X2', value: 'x2' },
] as const

const GameTransferModal = React.memo(function GameTransferModal({ 
  isOpen, onClose, type, gameName, gameThumbnail, accountName, gameBalance, walletBalance, totalDeposited, startAmount, onTransfer, onChangeGame, onRefresh
}: GameTransferModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showCashoutRules, setShowCashoutRules] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  // Cashout rules calculated strictly based on totalDeposited amount (excluding bonuses)
  let minCashout = 50;
  let maxCashout = 50;
  
  if (totalDeposited <= 5) {
    minCashout = 50; maxCashout = 50;
  } else if (totalDeposited >= 6 && totalDeposited <= 9) {
    minCashout = 50; maxCashout = 100;
  } else if (totalDeposited >= 10 && totalDeposited <= 15) {
    minCashout = 50; maxCashout = totalDeposited * 15;
  } else if (totalDeposited >= 16 && totalDeposited <= 50) {
    minCashout = totalDeposited * 3; maxCashout = totalDeposited * 15;
  } else if (totalDeposited > 50) {
    minCashout = totalDeposited * 3; maxCashout = 1000;
  }

  // Full game balance withdrawn from provider on cashout
  const fullGameBalance = Math.floor(gameBalance)
  // Only up to maxCashout is credited to wallet — excess is voided
  const creditedAmount = Math.min(fullGameBalance, maxCashout)
  const voidedAmount = Math.max(0, fullGameBalance - creditedAmount)

  // User must have at least minCashout in their game balance to be eligible
  const isCashoutValid = totalDeposited > 0 && gameBalance >= minCashout

  const parsedAmount = parseFloat(amount) || 0
  
  const handlePreset = (val: number | 'x2') => {
    if (val === 'x2') {
      setAmount((parsedAmount * 2).toString())
    } else {
      setAmount((parsedAmount + val).toString())
    }
  }

  const handleClear = () => setAmount('')

  const handleSubmit = async () => {
    // For cashout: always send the full game balance — backend handles void logic
    const finalAmount = type === 'cashout' ? fullGameBalance : parsedAmount;
    if (finalAmount <= 0) return
    setLoading(true)
    await onTransfer(finalAmount, type === 'deposit' ? 'recharge' : 'withdraw')
    setLoading(false)
    onClose()
    if (type === 'deposit') setAmount('')
  }

  // Warnings
  const insufficientWallet = type === 'deposit' && parsedAmount > walletBalance
  const insufficientGame = type === 'cashout' && parsedAmount > gameBalance
  const noSession = type === 'cashout' && gameBalance === 0

  const restrictDeposit = type === 'deposit' && gameBalance > 2

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col relative"
        >
          {/* Header */}
          <div className="p-5 flex justify-between items-center">
            <h2 className="text-white font-bold text-xl">{type === 'deposit' ? 'Add Cash' : 'Cash Out'}</h2>
            <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-5 pb-6 space-y-5">
            {/* Game Info Card */}
            <div className="bg-surface rounded-2xl p-4 flex items-center gap-4 border border-border-subtle relative">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/50 shrink-0">
                {gameThumbnail ? (
                  <img src={gameThumbnail} alt={gameName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted font-bold text-xs">{gameName.slice(0, 3).toUpperCase()}</div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {gameName} 
                    {onChangeGame && (
                      <span onClick={onChangeGame} className="text-[#2AC3FF] text-sm font-normal cursor-pointer ml-2 hover:underline">
                        change
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex justify-between mt-2">
                  <div>
                    <p className="text-muted text-xs">Login</p>
                    <p className="text-secondary text-sm font-mono">{accountName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted text-xs">Balance</p>
                    <p className="text-white font-bold">${gameBalance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {onRefresh && (
                <button 
                  onClick={async () => {
                    setRefreshing(true)
                    await onRefresh()
                    setRefreshing(false)
                  }}
                  disabled={refreshing}
                  className="absolute right-4 top-10 text-muted hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Input Section */}
            {type === 'deposit' && !restrictDeposit && (
              <>
                <div className="text-center">
                  <p className="text-muted text-sm mb-2">Amount</p>
                  <div className="bg-surface-elevated rounded-2xl flex items-center justify-center p-3 relative border border-border-subtle">
                    <span className="text-[#2AC3FF] absolute left-4 text-xl">💵</span>
                    <div className="flex items-center text-4xl font-bold text-white">
                      <span className="mr-1">$</span>
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="bg-transparent w-32 text-center outline-none"
                      />
                    </div>
                    {amount && (
                      <button onClick={handleClear} className="absolute right-4 text-muted hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="flex gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handlePreset(preset.value)}
                      className="flex-1 bg-surface hover:bg-surface-elevated text-[#2AC3FF] font-bold py-3 rounded-xl transition-colors border border-border-subtle"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button onClick={handleClear} className="w-12 bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Wallet Balance Info */}
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-secondary text-sm">Wallet balance</span>
                  <span className="text-white font-bold text-sm">${walletBalance.toFixed(2)}</span>
                </div>
              </>
            )}

            {/* Restricted Deposit Warnings */}
            {restrictDeposit && (
              <>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
                  <p className="text-sm text-orange-200">
                    You cannot make a deposit into this game because <span className="font-bold">your game balance</span> is more than $2.
                  </p>
                </div>
                <div className="bg-surface-elevated border border-[#2AC3FF]/30 rounded-2xl p-5 flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#2AC3FF]/20 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2AC3FF]"></div>
                  </div>
                  <p className="text-sm text-[#2AC3FF]">
                    Lower your game balance below <span className="font-bold">$2</span> to make a deposit into this game. If the balance is invalid, update it
                  </p>
                </div>
              </>
            )}

            {/* Cashout Summary Section */}
            {!noSession && type === 'cashout' && (
              <>
                <div className="bg-surface rounded-2xl p-5 border border-border-subtle space-y-5">
                  <div className="flex justify-between items-center text-muted text-sm">
                    <span>Session</span>
                    <span className="flex items-center gap-1 font-bold text-white"><Banknote className="w-4 h-4" /> Cash</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-muted text-sm">
                    <span>Total deposited</span>
                    <span className="font-bold text-[#2AC3FF]">$ {totalDeposited.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-muted text-sm">
                    <span>Game balance (full)</span>
                    <span className="font-bold text-white">$ {fullGameBalance.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-muted text-sm">
                    <span>Will be credited to wallet</span>
                    <span className="font-bold text-emerald-400">$ {creditedAmount.toFixed(2)}</span>
                  </div>

                  {voidedAmount > 0 && (
                    <div className="flex justify-between items-center text-muted text-sm">
                      <span>Will be voided (over limit)</span>
                      <span className="font-bold text-red-400">- $ {voidedAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex justify-between items-center">
                  <span className="text-muted text-sm">Cashouts range <strong className="text-white">from ${minCashout} to ${maxCashout}</strong></span>
                  <button onClick={() => setShowCashoutRules(true)} className="w-5 h-5 rounded-full bg-surface-elevated text-secondary hover:text-neon-blue hover:bg-neon-blue/10 flex items-center justify-center text-xs font-bold italic transition-colors border border-border-strong">i</button>
                </div>
              </>
            )}

            {/* Warnings */}
            {!isCashoutValid && !noSession && type === 'cashout' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">
                  <span className="font-bold text-red-500 block">Below Minimum Cashout!</span> 
                  You must have at least ${minCashout} to cash out.
                </p>
              </div>
            )}
            
            {/* Cashout range info */}
            {!noSession && type === 'cashout' && (
              <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex justify-between items-center">
                <span className="text-muted text-sm">Cashouts range <strong className="text-white">from ${minCashout} to ${maxCashout}</strong></span>
                <button onClick={() => setShowCashoutRules(true)} className="w-5 h-5 rounded-full bg-surface-elevated text-secondary hover:text-neon-blue hover:bg-neon-blue/10 flex items-center justify-center text-xs font-bold italic transition-colors border border-border-strong">i</button>
              </div>
            )}

            {insufficientWallet && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3 cursor-pointer hover:bg-orange-500/20 transition-colors">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-200">
                  <span className="font-bold text-orange-500 block">Not enough funds!</span> 
                  Click on this message to deposit ${(parsedAmount - walletBalance).toFixed(2)} to your wallet.
                </p>
              </div>
            )}

            {noSession && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-200">
                  There is no game session for cashing out funds on your game login. Change the game to cash out the funds.
                </p>
              </div>
            )}

            {insufficientGame && !noSession && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">
                  <span className="font-bold text-red-500 block">Insufficient Game Balance!</span> 
                  You only have ${gameBalance.toFixed(2)} available to cash out.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {restrictDeposit ? (
                <>
                  <button onClick={onChangeGame} className="flex-1 bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-colors">
                    Change game
                  </button>
                  <button onClick={onClose} className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-colors border border-border-subtle">
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || insufficientWallet || (noSession && type === 'cashout') || (!isCashoutValid && type === 'cashout') || (type === 'deposit' && parsedAmount <= 0)}
                    className="flex-1 bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : type === 'deposit' ? 'Add Cash' : 'Cash Out'}
                  </button>
                  <button onClick={onClose} className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-3.5 rounded-xl transition-colors border border-border-subtle">
                    Close
                  </button>
                </>
              )}
            </div>

          </div>
        </motion.div>
      </div>

      {/* Cashout Rules Popup */}
      <AnimatePresence>
        {showCashoutRules && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCashoutRules(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg bg-[#0F0F17] border border-[#2AC3FF]/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/80 max-h-[95vh] overflow-y-auto flex flex-col"
            >
              {/* Glow header */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0F0F17] p-6 border-b border-white/5">
                <div className="absolute inset-0 bg-[#2AC3FF]/5 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#2AC3FF] text-xs font-mono tracking-[0.3em] uppercase mb-1">Vault Sweeps</p>
                    <h3 className="text-white font-display font-bold text-2xl tracking-wide">
                      CASHOUT <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2AC3FF] to-[#7B2FFF]">LIMITS</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCashoutRules(false)}
                    className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-secondary hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Table */}
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#2AC3FF]/10">
                        {['DEPOSIT', 'MINIMUM', 'MAXIMUM'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[#2AC3FF] font-mono text-xs tracking-widest font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        { deposit: '$5',       min: '$50',  max: '$50'   },
                        { deposit: '$6–$9',    min: '$50',  max: '$100'  },
                        { deposit: '$10–$15',  min: '$50',  max: 'X15'   },
                        { deposit: '$16–$25',  min: 'X3',   max: 'X15'   },
                        { deposit: '$26–$35',  min: 'X3',   max: 'X15'   },
                        { deposit: '$36–$50',  min: 'X3',   max: 'X15'   },
                        { deposit: '$50+',     min: 'X3',   max: '$1000' },
                      ].map((row, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'} hover:bg-[#2AC3FF]/5 transition-colors`}>
                          <td className="px-4 py-3 text-white font-semibold">{row.deposit}</td>
                          <td className="px-4 py-3 text-emerald-400 font-mono font-bold">{row.min}</td>
                          <td className="px-4 py-3 text-[#2AC3FF] font-mono font-bold">{row.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer info */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">Minimum Deposit</p>
                    <p className="text-white font-bold text-lg">$5</p>
                  </div>
                  <div className="flex-1 bg-[#2AC3FF]/10 border border-[#2AC3FF]/20 rounded-xl p-3">
                    <p className="text-[#2AC3FF] text-xs font-mono font-bold uppercase tracking-wider mb-1">Max Cashout / Day</p>
                    <p className="text-white font-bold text-lg">$1,000</p>
                  </div>
                </div>

                {/* Note */}
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-200 text-xs leading-relaxed">
                    <span className="font-bold text-amber-400">NOTE: </span>
                    Winnings above the maximum limit are voided by the system. Multipliers (X3, X15) are calculated based on your total deposited amount.
                  </p>
                </div>

                <button
                  onClick={() => setShowCashoutRules(false)}
                  className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
})

export default GameTransferModal;
