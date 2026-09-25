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
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#050608]/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md overflow-hidden flex flex-col relative rounded-[28px] shadow-2xl"
          style={{ backgroundColor: '#131521', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Subtle Ambient Lighting */}
          <div className="absolute top-0 left-1/4 w-64 h-32 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-64 h-32 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-5 relative z-10 border-b border-white/5">
            <div className="flex items-center gap-3">
              {showBack && (
                <button onClick={handleBack} className="text-white/50 hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-bold text-[19px] text-white tracking-wide">
                {step === 'select_coin' ? 'Select Cryptocurrency' :
                 step === 'enter_amount' ? 'Enter Amount' :
                 step === 'payment_details' ? 'Send Payment' : 'Payment Received!'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[75vh] overflow-y-auto relative z-10">

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
              <div className="space-y-6">
                <p className="text-[14px] text-white/60 px-1">
                  Choose which cryptocurrency you'd like to deposit with
                </p>

                {loadingCoins ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-sm text-white/60">Fetching available coins...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Litecoin — RECOMMENDED featured card */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'ltc', available: true })}
                        className={`p-4 rounded-[20px] flex flex-col relative overflow-hidden transition-all text-left w-full h-[130px] border bg-[#1C1F2E] hover:bg-[#23273A] ${
                          selectedCoin === 'ltc'
                            ? 'border-blue-400 bg-[#23273A] shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-[1.02]'
                            : 'border-blue-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-blue-500/60 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:-translate-y-0.5'
                        } ${isSubmitting && selectedCoin !== 'ltc' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {/* Soft blue glow behind the card content */}
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex justify-between items-start mb-auto w-full relative z-10">
                          <div className="w-11 h-11 rounded-full bg-[#345D9D] flex items-center justify-center shadow-[0_0_12px_rgba(52,93,157,0.5)]">
                            <span className="text-white font-bold text-[22px] italic drop-shadow-md">Ł</span>
                          </div>
                          <div className="bg-[#FFB800] text-black text-[10px] font-bold px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(255,184,0,0.2)]">
                            POPULAR
                          </div>
                        </div>
                        
                        <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                          <span className="text-white font-bold text-[16px] tracking-wide">Litecoin</span>
                          <span className="text-white/50 text-[12px]">Mainnet</span>
                        </div>
                      </button>

                      {/* USDT TRC-20 */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'usdttrc20', available: true })}
                        className={`p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[130px] border bg-[#1C1F2E] hover:bg-[#23273A] ${
                          selectedCoin === 'usdttrc20'
                            ? 'border-white/20 bg-[#23273A] scale-[1.02]'
                            : 'border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-white/10 hover:-translate-y-0.5'
                        } ${isSubmitting && selectedCoin !== 'usdttrc20' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-auto w-full relative z-10">
                          <div className="w-11 h-11 rounded-full bg-[#E51C23] flex items-center justify-center shadow-[0_0_12px_rgba(229,28,35,0.3)]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 12h18"/><path d="M12 3v18"/><path d="M3 12l9-9 9 9-9 9-9-9z"/></svg>
                          </div>
                        </div>
                        
                        <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                          <span className="text-white font-bold text-[16px] tracking-wide">USDT</span>
                          <span className="text-white/50 text-[12px]">TRC-20</span>
                        </div>
                      </button>

                      {/* Bitcoin */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'btc', available: true })}
                        className={`p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[130px] border bg-[#1C1F2E] hover:bg-[#23273A] ${
                          selectedCoin === 'btc'
                            ? 'border-white/20 bg-[#23273A] scale-[1.02]'
                            : 'border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-white/10 hover:-translate-y-0.5'
                        } ${isSubmitting && selectedCoin !== 'btc' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-auto w-full relative z-10">
                          <div className="w-11 h-11 rounded-full bg-[#F7931A] flex items-center justify-center shadow-[0_0_12px_rgba(247,147,26,0.3)]">
                            <span className="text-white font-bold text-[22px] drop-shadow-md">₿</span>
                          </div>
                        </div>
                        
                        <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                          <span className="text-white font-bold text-[16px] tracking-wide">Bitcoin</span>
                          <span className="text-white/50 text-[12px]">Mainnet</span>
                        </div>
                      </button>

                      {/* Ethereum */}
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect({ currency: 'eth', available: true })}
                        className={`p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[130px] border bg-[#1C1F2E] hover:bg-[#23273A] ${
                          selectedCoin === 'eth'
                            ? 'border-white/20 bg-[#23273A] scale-[1.02]'
                            : 'border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-white/10 hover:-translate-y-0.5'
                        } ${isSubmitting && selectedCoin !== 'eth' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-auto w-full relative z-10">
                          <div className="w-11 h-11 rounded-full bg-[#627EEA] flex items-center justify-center shadow-[0_0_12px_rgba(98,126,234,0.3)]">
                            <svg viewBox="0 0 24 24" fill="white" className="w-[22px] h-[22px] drop-shadow-md">
                              <path d="M11.944 2.5L2 9.5l9.944 7L22 9.5l-10.056-7z"/>
                              <path d="M2 11.5l9.944 7 10.056-7L11.944 23 2 11.5z"/>
                            </svg>
                          </div>
                        </div>
                        
                        <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                          <span className="text-white font-bold text-[16px] tracking-wide">Ethereum</span>
                          <span className="text-white/50 text-[12px]">ERC-20</span>
                        </div>
                      </button>
                    </div>
                    
                    <a href={getSmsUrl()} target="_blank" rel="noopener noreferrer" className="w-full block font-bold py-4 rounded-[16px] text-center text-[15px] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border border-blue-400/50 hover:scale-[1.01]">
                      Contact us for more option
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
