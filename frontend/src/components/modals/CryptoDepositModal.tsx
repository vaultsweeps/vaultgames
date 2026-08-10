'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Copy, CheckCircle2, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'

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
  const [step, setStep] = useState<'enter_amount' | 'select_coin' | 'payment_details' | 'success'>(
    propAmount && propMethodId ? 'select_coin' : 'enter_amount'
  )
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

  const PRIORITY = ['btc', 'eth', 'usdttrc20', 'usdterc20', 'ltc', 'sol', 'bnbbsc', 'trx']

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
        setStep(propAmount && propMethodId ? 'select_coin' : 'enter_amount')
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

  useEffect(() => {
    if (!isOpen || step !== 'select_coin') return
    const amount = parseFloat(depositAmount)
    if (!amount || isNaN(amount)) return
    fetchCoins(amount)
  }, [step, isOpen])

  const fetchCoins = async (amount: number) => {
    setLoadingCoins(true)
    try {
      const res = await depositApi.getCryptoCurrencies()
      const fetched: string[] = res.data.data || []
      const sorted = [...fetched].sort((a, b) => {
        const ai = PRIORITY.indexOf(a.toLowerCase())
        const bi = PRIORITY.indexOf(b.toLowerCase())
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      setCoins(sorted.map((c) => ({ currency: c, available: true })))
    } catch {
      toast.error('Failed to load available coins')
      handleClose()
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

    setStep('select_coin')
  }

  const handleCoinSelect = async (coin: CoinInfo) => {
    if (!coin.available) {
      toast.error(`${coin.currency.toUpperCase()} is not available for this deposit amount`)
      return
    }

    const amount = parseFloat(depositAmount)

    // For USDTTRC20, check the minimum amount before attempting
    if (coin.currency.toLowerCase() === 'usdttrc20') {
      setIsSubmitting(true)
      setSelectedCoin(coin.currency)
      try {
        const minRes = await depositApi.getCoinMinAmount(coin.currency)
        const minAmount: number = minRes.data.data?.minAmount || 0
        if (amount < minAmount) {
          toast.error(
            `USDT TRC20 requires a minimum deposit of $${Math.ceil(minAmount)} due to Tron network fees. Please increase your amount or choose another coin.`,
            { duration: 6000 }
          )
          setIsSubmitting(false)
          setSelectedCoin(null)
          return
        }
      } catch {
        // If min check fails, proceed anyway — payment API will handle it
      }
    }

    setSelectedCoin(coin.currency)
    setIsSubmitting(true)
    try {
      const res = await depositApi.create({
        amount,
        paymentMethodId,
        cryptoCurrency: coin.currency
      })
      const details = res.data.data?.cryptoDetails
      const id = res.data.data?.id
      if (!details) throw new Error('Payment details missing from response')
      setPaymentDetails(details)
      setDepositId(id)
      setStep('payment_details')
      // Start polling for payment confirmation
      if (id) startPolling(id, amount)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate crypto payment address')
      setSelectedCoin(null)
    } finally {
      setIsSubmitting(false)
    }
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
      setStep('select_coin')
      setSelectedCoin(null)
      setPaymentDetails(null)
      setDepositId(null)
    } else if (step === 'select_coin') {
      setStep(propAmount && propMethodId ? 'select_coin' : 'enter_amount')
    }
  }

  if (!isOpen) return null

  const showBack = (step === 'select_coin' && !propAmount) || step === 'payment_details'

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
                {step === 'enter_amount' ? 'Crypto Deposit' :
                 step === 'select_coin' ? 'Select Cryptocurrency' :
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

            {/* ── STEP 1: Amount Entry ── */}
            {step === 'enter_amount' && (
              <div className="space-y-5">
                <p className="text-sm text-secondary text-center">
                  Enter the amount you want to deposit in USD.
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

            {/* ── STEP 2: Coin Selection ── */}
            {step === 'select_coin' && (
              <div className="space-y-4">
                <p className="text-sm text-secondary text-center mb-4">
                  Depositing <span className="text-white font-bold">${parseFloat(depositAmount).toFixed(2)}</span> · Select a coin
                </p>

                {loadingCoins ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
                    <p className="text-sm text-secondary">Fetching available coins...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {coins.map((coin) => (
                      <button
                        key={coin.currency}
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect(coin)}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all relative ${
                          selectedCoin === coin.currency
                            ? 'bg-neon-blue/20 border-neon-blue text-white'
                            : 'glass border-border-strong hover:bg-white/5 text-secondary hover:text-white'
                        } ${isSubmitting && selectedCoin !== coin.currency ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting && selectedCoin === coin.currency ? (
                          <Loader2 className="w-5 h-5 animate-spin text-neon-blue" />
                        ) : (
                          <span className="font-mono text-xs uppercase tracking-wider font-bold">
                            {coin.currency}
                          </span>
                        )}
                      </button>
                    ))}
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
