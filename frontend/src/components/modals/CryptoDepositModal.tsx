'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Copy, CheckCircle2, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { getSmsUrl } from '@/lib/sms'

interface CoinInfo {
  currency: string
  available: boolean
}

interface CryptoDepositModalProps {
  isOpen: boolean
  onClose: () => void
  amount?: number
  paymentMethodId?: string
}

export default function CryptoDepositModal({ isOpen, onClose, amount: propAmount, paymentMethodId: propMethodId }: CryptoDepositModalProps) {
  const [step, setStep] = useState<'select_coin' | 'enter_amount' | 'payment_details' | 'success'>('select_coin')
  const [depositAmount, setDepositAmount] = useState(propAmount ? String(propAmount) : '')
  const [paymentMethodId, setPaymentMethodId] = useState(propMethodId || '')

  const [loadingCoins, setLoadingCoins] = useState(false)
  const [coins, setCoins] = useState<CoinInfo[]>([])
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)
  const [depositId, setDepositId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [paidAmount, setPaidAmount] = useState<number>(0)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fixed ordered list of coins to always display
  const FIXED_COINS = ['ltc', 'usdttrc20', 'btc', 'eth']

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  // Poll deposit status every 12 seconds while on payment_details step
  const startPolling = useCallback((id: string, amount: number) => {
    stopPolling()
    const poll = async () => {
      try {
        const res = await depositApi.getOne(id)
        const deposit = res.data.data
        if (deposit?.status === 'approved') {
          stopPolling()
          setPaidAmount(deposit.amount)
          setStep('success')
        }
      } catch {
        // Silently ignore poll errors
      }
    }
    pollIntervalRef.current = setInterval(poll, 12000)
  }, [stopPolling])

  // Cleanup polling on unmount or close
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Reset on close/open
  useEffect(() => {
    if (!isOpen) {
      stopPolling()
      setTimeout(() => {
        setStep('select_coin')
        setDepositAmount(propAmount ? String(propAmount) : '')
        setPaymentMethodId(propMethodId || '')
        setSelectedCoin(null)
        setPaymentDetails(null)
        setDepositId(null)
        setCoins([])
        setPaidAmount(0)
      }, 300)
    }
  }, [isOpen, propAmount, propMethodId, stopPolling])

  useEffect(() => {
    if (propAmount) setDepositAmount(String(propAmount))
    if (propMethodId) setPaymentMethodId(propMethodId)
  }, [propAmount, propMethodId])

  // Pre-fetch coins as soon as modal opens on select_coin step
  useEffect(() => {
    if (!isOpen || step !== 'select_coin') return
    fetchCoins(parseFloat(depositAmount) || 0)
  }, [step, isOpen])

  const fetchCoins = async (amount: number) => {
    setLoadingCoins(true)
    try {
      // Always show the fixed list — no API filtering
      setCoins(FIXED_COINS.map((c) => ({ currency: c, available: true })))
    } catch {
      // Fallback: still show all coins
      setCoins(FIXED_COINS.map((c) => ({ currency: c, available: true })))
    } finally {
      setLoadingCoins(false)
    }
  }

  const handleAmountSubmit = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount < 1) return toast.error('Minimum deposit is $1')
    if (amount > 10000) return toast.error('Maximum deposit is $10,000')

    if (!paymentMethodId) {
      try {
        const res = await depositApi.getPaymentMethods()
        const methods: any[] = res.data.data || []
        const cryptoMethod = methods.find((m: any) => m.code?.toLowerCase() === 'crypto')
        if (!cryptoMethod) return toast.error('Crypto payment method not available')
        setPaymentMethodId(cryptoMethod.id)
      } catch {
        return toast.error('Failed to load payment methods')
      }
    }

    // After entering amount, go straight to payment details using already-selected coin
    // (this is called from enter_amount step which comes AFTER coin selection)
    if (selectedCoin) {
      // Re-use handleCoinSelect logic with the already chosen coin
      await handleCoinSelectWithAmount(selectedCoin, amount)
    }
  }

  const handleCoinSelectWithAmount = async (coinCurrency: string, amount: number) => {
    setSelectedCoin(coinCurrency)
    setIsSubmitting(true)
    try {
      if (coinCurrency.toLowerCase() === 'usdttrc20') {
        const minRes = await depositApi.getCoinMinAmount(coinCurrency)
        const minAmount: number = minRes.data.data?.minAmount || 0
        if (amount < minAmount) {
          toast.error(`USDT TRC20 requires a minimum of $${Math.ceil(minAmount)}. Please increase your amount or choose another coin.`, { duration: 6000 })
          setIsSubmitting(false)
          setSelectedCoin(null)
          setStep('enter_amount')
          return
        }
      }
      const res = await depositApi.create({ amount, paymentMethodId, cryptoCurrency: coinCurrency })
      const details = res.data.data?.cryptoDetails
      const id = res.data.data?.id
      if (!details) throw new Error('Payment details missing from response')
      setPaymentDetails(details)
      setDepositId(id)
      setStep('payment_details')
      if (id) startPolling(id, amount)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate crypto payment address')
      setSelectedCoin(null)
      setStep('enter_amount')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCoinSelect = (coin: CoinInfo) => {
    if (!coin.available) {
      toast.error(`${coin.currency.toUpperCase()} is not available`)
      return
    }
    // Resolve payment method ID if not already set
    if (!paymentMethodId) {
      depositApi.getPaymentMethods().then(res => {
        const methods: any[] = res.data.data || []
        const cryptoMethod = methods.find((m: any) => m.code?.toLowerCase() === 'crypto')
        if (cryptoMethod) setPaymentMethodId(cryptoMethod.id)
      }).catch(() => {})
    }
    setSelectedCoin(coin.currency)
    setStep('enter_amount')
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copied!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleClose = () => {
    stopPolling()
    onClose()
  }

  const handleBack = () => {
    if (step === 'payment_details') {
      stopPolling()
      setStep('enter_amount')
      setPaymentDetails(null)
      setDepositId(null)
    } else if (step === 'enter_amount') {
      setStep('select_coin')
    }
  }

  if (!isOpen) return null

  const showBack = step === 'enter_amount' || step === 'payment_details'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-card w-full max-w-md overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {showBack && (
                <button onClick={handleBack} className="text-secondary hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-display font-bold text-lg text-white">
                {step === 'select_coin' ? 'Select Cryptocurrency' :
                 step === 'enter_amount' ? 'Enter Amount' :
                 step === 'payment_details' ? 'Send Payment' : 'Payment Received!'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-secondary hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">

            {/* ── STEP 2: Amount Entry ── */}
            {step === 'enter_amount' && (
              <div className="space-y-5">
                <p className="text-sm text-secondary text-center">
                  Enter the amount you want to deposit via <span className="text-white font-bold">{selectedCoin?.toUpperCase()}</span>.
                </p>
                <div>
                  <label className="text-xs font-mono text-secondary uppercase ml-1 mb-1.5 block">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neon-blue font-bold text-lg">$</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAmountSubmit()}
                      className="w-full bg-black/40 border border-border-strong rounded-xl py-3.5 pl-9 pr-4 text-white font-mono text-lg focus:outline-none focus:border-neon-blue/60 transition-colors"
                      placeholder="10.00"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted mt-1.5 ml-1">Min $1 · Max $10,000</p>
                </div>
                <button
                  onClick={handleAmountSubmit}
                  className="btn-primary w-full py-3.5 text-sm font-bold"
                >
                  CONTINUE
                </button>
              </div>
            )}

            {/* ── STEP 1: Coin Selection ── */}
            {step === 'select_coin' && (
              <div className="space-y-4">
                <p className="text-sm text-secondary text-center mb-4">
                  Choose which cryptocurrency you'd like to deposit with
                </p>

                {loadingCoins ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
                    <p className="text-sm text-secondary">Fetching available coins...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Litecoin — POPULAR featured card */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'ltc', available: true })}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden ${
                          selectedCoin === 'ltc'
                            ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.6)]'
                            : 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:border-blue-400 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)]'
                        } ${isSubmitting && selectedCoin !== 'ltc' ? 'opacity-30 cursor-not-allowed' : ''}`}
                        style={{ background: 'linear-gradient(180deg, #091325 0%, #030815 100%)' }}
                      >
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-bl-xl flex items-center gap-1 shadow-md z-10 border-b border-l border-yellow-300">👑 POPULAR</div>
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl" />
                        {isSubmitting && selectedCoin === 'ltc' ? (
                          <Loader2 className="w-10 h-10 animate-spin text-blue-400 my-6" />
                        ) : (
                          <>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-3xl italic shadow-[0_0_15px_rgba(59,130,246,0.6)] bg-gradient-to-br from-[#1c5bbd] to-[#0a2f6b] border-2 border-blue-300 relative z-10 mt-2 mb-1">Ł</div>
                            <div className="text-center relative z-10 w-full">
                              <span className="text-white font-black text-xl tracking-wide block drop-shadow-md">Litecoin</span>
                              <span className="text-cyan-400 font-bold text-[11px] block tracking-wider mb-2">Mainnet</span>
                              <div className="flex items-center justify-between gap-1 w-full mt-1 border-t border-blue-500/30 pt-2">
                                <div className="flex items-center gap-1 bg-black/40 px-1.5 py-1 rounded text-[7px] font-bold text-white flex-1 justify-center border border-white/5 leading-tight">
                                  <div className="bg-white rounded-full p-0.5"><svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-blue-600"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                                  QUICK<br/>CONFIRMATIONS
                                </div>
                                <div className="flex items-center gap-1 bg-black/40 px-1.5 py-1 rounded text-[7px] font-bold text-white flex-1 justify-center border border-white/5 leading-tight">
                                  <div className="bg-white rounded-full p-0.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-blue-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                                  LOW NETWORK<br/>FEES
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </button>

                      {/* USDT TRC-20 */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'usdttrc20', available: true })}
                        className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative ${
                          selectedCoin === 'usdttrc20'
                            ? 'bg-surface-elevated border-neon-blue text-white'
                            : 'bg-surface border-border-subtle hover:bg-surface-elevated text-secondary hover:text-white'
                        } ${isSubmitting && selectedCoin !== 'usdttrc20' ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting && selectedCoin === 'usdttrc20' ? (
                          <Loader2 className="w-10 h-10 animate-spin text-neon-blue" />
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-bold text-white text-xl">
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 12h18"/><path d="M12 3v18"/><path d="M3 12l9-9 9 9-9 9-9-9z"/></svg>
                            </div>
                            <div className="text-center mt-1">
                              <span className="text-white font-bold text-sm block">USDT</span>
                              <span className="text-muted text-[10px] block">TRC-20</span>
                            </div>
                          </>
                        )}
                      </button>

                      {/* Bitcoin */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'btc', available: true })}
                        className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative ${
                          selectedCoin === 'btc'
                            ? 'bg-surface-elevated border-neon-blue text-white'
                            : 'bg-surface border-border-subtle hover:bg-surface-elevated text-secondary hover:text-white'
                        } ${isSubmitting && selectedCoin !== 'btc' ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting && selectedCoin === 'btc' ? (
                          <Loader2 className="w-10 h-10 animate-spin text-neon-blue" />
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-white text-xl">₿</div>
                            <div className="text-center mt-1">
                              <span className="text-white font-bold text-sm block">Bitcoin</span>
                              <span className="text-muted text-[10px] block">Mainnet</span>
                            </div>
                          </>
                        )}
                      </button>

                      {/* Ethereum */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'eth', available: true })}
                        className={`p-5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative ${
                          selectedCoin === 'eth'
                            ? 'bg-surface-elevated border-neon-blue text-white'
                            : 'bg-surface border-border-subtle hover:bg-surface-elevated text-secondary hover:text-white'
                        } ${isSubmitting && selectedCoin !== 'eth' ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting && selectedCoin === 'eth' ? (
                          <Loader2 className="w-10 h-10 animate-spin text-neon-blue" />
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xl">Ξ</div>
                            <div className="text-center mt-1">
                              <span className="text-white font-bold text-sm block">Ethereum</span>
                              <span className="text-muted text-[10px] block">ERC-20</span>
                            </div>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <a href={getSmsUrl()} target="_blank" rel="noopener noreferrer" className="btn-sms-beam-rect w-full block font-bold py-3 rounded-xl text-center text-sm shadow-md transition-all">
                      <span className="relative z-10 text-white">Contact us for more option</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Payment Details ── */}
            {step === 'payment_details' && paymentDetails && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-secondary mb-1">Send EXACTLY</p>
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-3xl font-mono font-bold text-neon-blue">
                      {paymentDetails.pay_amount}
                    </h2>
                    <span className="text-xl font-bold uppercase text-white">
                      {paymentDetails.pay_currency}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                    Waiting for payment confirmation…
                  </p>
                </div>

                <div className="flex justify-center bg-white p-3 rounded-xl mx-auto w-fit">
                  <QRCodeSVG
                    value={`${paymentDetails.pay_currency}:${paymentDetails.pay_address}?amount=${paymentDetails.pay_amount}`}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-3">
                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-secondary uppercase ml-1">Amount</label>
                    <div className="relative">
                      <input
                        readOnly
                        value={paymentDetails.pay_amount}
                        className="w-full bg-black/40 border border-border-strong rounded-xl py-3 px-4 text-sm font-mono text-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopy(String(paymentDetails.pay_amount), 'Amount')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-neon-blue transition-colors"
                      >
                        {copiedField === 'Amount' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-secondary uppercase ml-1">Deposit Address</label>
                    <div className="relative">
                      <input
                        readOnly
                        value={paymentDetails.pay_address}
                        className="w-full bg-black/40 border border-border-strong rounded-xl py-3 px-4 pr-12 text-sm font-mono text-white focus:outline-none truncate"
                      />
                      <button
                        onClick={() => handleCopy(paymentDetails.pay_address, 'Address')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-neon-blue transition-colors"
                      >
                        {copiedField === 'Address' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3.5 text-xs text-orange-400">
                  <p className="font-bold mb-1">⚠️ Important</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Send ONLY <b>{paymentDetails.pay_currency.toUpperCase()}</b> to this address.</li>
                    <li>Ensure you are on the correct network.</li>
                    <li>Balance is credited automatically after confirmation.</li>
                    <li>Payment expires in <b>8 hours</b>.</li>
                  </ul>
                </div>

                <button onClick={handleClose} className="w-full py-3 text-sm rounded-xl border border-border-strong text-secondary hover:text-white hover:border-white/20 transition-all">
                  CLOSE
                </button>
              </div>
            )}

            {/* ── STEP 4: Success ── */}
            {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="relative"
                >
                  {/* Glowing ring */}
                  <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl scale-150" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40 relative">
                    <CheckCircle className="w-12 h-12 text-white" strokeWidth={2} />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-display font-black text-white">Payment Confirmed!</h2>
                  <p className="text-secondary text-sm">
                    Your crypto deposit of{' '}
                    <span className="text-emerald-400 font-bold">${paidAmount > 0 ? paidAmount.toFixed(2) : parseFloat(depositAmount).toFixed(2)}</span>{' '}
                    has been confirmed and credited to your account.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full space-y-3"
                >
                  <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-emerald-400 font-medium">
                    💰 Your balance has been updated. You can now play!
                  </div>
                  <button
                    onClick={handleClose}
                    className="btn-primary w-full py-3.5 text-sm font-bold"
                  >
                    AWESOME, LET'S PLAY!
                  </button>
                </motion.div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
