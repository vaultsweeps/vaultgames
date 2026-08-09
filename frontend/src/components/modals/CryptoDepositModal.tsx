'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Copy, CheckCircle2, ChevronLeft, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'

interface CoinInfo {
  currency: string
  minAmount: number
  available: boolean
}

interface CryptoDepositModalProps {
  isOpen: boolean
  onClose: () => void
  // Optional: pre-fill amount + paymentMethodId (from deposits page)
  // If not provided, modal will ask for amount itself
  amount?: number
  paymentMethodId?: string
}

export default function CryptoDepositModal({ isOpen, onClose, amount: propAmount, paymentMethodId: propMethodId }: CryptoDepositModalProps) {
  // Step: enter_amount → select_coin → payment_details
  const [step, setStep] = useState<'enter_amount' | 'select_coin' | 'payment_details'>(
    propAmount && propMethodId ? 'select_coin' : 'enter_amount'
  )
  const [depositAmount, setDepositAmount] = useState(propAmount ? String(propAmount) : '')
  const [paymentMethodId, setPaymentMethodId] = useState(propMethodId || '')

  const [loadingCoins, setLoadingCoins] = useState(false)
  const [coins, setCoins] = useState<CoinInfo[]>([])
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const PRIORITY = ['btc', 'eth', 'usdttrc20', 'usdterc20', 'ltc', 'sol', 'bnbbsc', 'trx']

  // Reset on close/open
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(propAmount && propMethodId ? 'select_coin' : 'enter_amount')
        setDepositAmount(propAmount ? String(propAmount) : '')
        setPaymentMethodId(propMethodId || '')
        setSelectedCoin(null)
        setPaymentDetails(null)
        setCoins([])
      }, 300)
    }
  }, [isOpen, propAmount, propMethodId])

  // If propAmount changes while open (e.g. parent updated)
  useEffect(() => {
    if (propAmount) setDepositAmount(String(propAmount))
    if (propMethodId) setPaymentMethodId(propMethodId)
  }, [propAmount, propMethodId])

  // Fetch coins with min amounts once we move to select_coin step
  useEffect(() => {
    if (!isOpen || step !== 'select_coin') return
    const amount = parseFloat(depositAmount)
    if (!amount || isNaN(amount)) return
    fetchCoins(amount)
  }, [step, isOpen])

  const fetchCoins = async (amount: number) => {
    setLoadingCoins(true)
    try {
      const res = await depositApi.getCryptoCoinsForAmount(amount)
      const fetchedCoins: CoinInfo[] = res.data.data || []
      fetchedCoins.sort((a, b) => {
        const ai = PRIORITY.indexOf(a.currency.toLowerCase())
        const bi = PRIORITY.indexOf(b.currency.toLowerCase())
        // available first, then priority order
        if (a.available !== b.available) return a.available ? -1 : 1
        if (ai === -1 && bi === -1) return a.currency.localeCompare(b.currency)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      setCoins(fetchedCoins)
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

    // If no paymentMethodId yet, fetch it
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
      toast.error(`Minimum deposit for ${coin.currency.toUpperCase()} is $${coin.minAmount.toFixed(2)}`)
      return
    }
    setSelectedCoin(coin.currency)
    setIsSubmitting(true)
    try {
      const res = await depositApi.create({
        amount: parseFloat(depositAmount),
        paymentMethodId,
        cryptoCurrency: coin.currency
      })
      const details = res.data.data?.cryptoDetails
      if (!details) throw new Error('Payment details missing from response')
      setPaymentDetails(details)
      setStep('payment_details')
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
    onClose()
  }

  const handleBack = () => {
    if (step === 'payment_details') {
      setStep('select_coin')
      setSelectedCoin(null)
      setPaymentDetails(null)
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
                {step === 'enter_amount' ? 'Crypto Deposit' : step === 'select_coin' ? 'Select Cryptocurrency' : 'Send Payment'}
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
                          !coin.available
                            ? 'opacity-50 cursor-not-allowed border-border-strong bg-black/20'
                            : selectedCoin === coin.currency
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
                        {!coin.available && (
                          <span className="text-[10px] text-orange-400 font-medium text-center leading-tight">
                            Min ${coin.minAmount.toFixed(0)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!loadingCoins && coins.some(c => !c.available) && (
                  <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>Some coins have a higher minimum due to network fees. Increase your deposit amount or choose an available coin.</p>
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

                <button onClick={handleClose} className="btn-primary w-full py-3 text-sm">
                  CLOSE
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
