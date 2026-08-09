import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Copy, CheckCircle2, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'

interface CryptoDepositModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  paymentMethodId: string
}

export default function CryptoDepositModal({ isOpen, onClose, amount, paymentMethodId }: CryptoDepositModalProps) {
  const [step, setStep] = useState<'select_coin' | 'payment_details'>('select_coin')
  const [loadingCoins, setLoadingCoins] = useState(false)
  const [coins, setCoins] = useState<string[]>([])
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch enabled coins when modal opens
  useEffect(() => {
    if (isOpen && step === 'select_coin') {
      fetchCoins()
    }
  }, [isOpen, step])

  const fetchCoins = async () => {
    setLoadingCoins(true)
    try {
      const res = await depositApi.getCryptoCurrencies()
      // Sort to prioritize popular coins
      const priority = ['btc', 'eth', 'usdttrc20', 'usdterc20', 'ltc']
      const fetchedCoins: string[] = res.data.data || []
      
      fetchedCoins.sort((a, b) => {
        const aIndex = priority.indexOf(a.toLowerCase())
        const bIndex = priority.indexOf(b.toLowerCase())
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })

      setCoins(fetchedCoins)
    } catch (err: any) {
      toast.error('Failed to load available crypto currencies')
      onClose()
    } finally {
      setLoadingCoins(false)
    }
  }

  const handleCoinSelect = async (coin: string) => {
    setSelectedCoin(coin)
    setIsSubmitting(true)
    try {
      const res = await depositApi.create({ 
        amount, 
        paymentMethodId, 
        cryptoCurrency: coin 
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
    toast.success(`${field} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Handle modal reset on close
  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep('select_coin')
      setSelectedCoin(null)
      setPaymentDetails(null)
    }, 300) // Reset after exit animation
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-card w-full max-w-md overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {step === 'payment_details' && (
                <button 
                  onClick={() => setStep('select_coin')}
                  className="text-secondary hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h3 className="font-display font-bold text-lg text-white">
                {step === 'select_coin' ? 'Select Cryptocurrency' : 'Send Payment'}
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
          <div className="p-6">
            {step === 'select_coin' && (
              <div className="space-y-4">
                <p className="text-sm text-secondary text-center mb-6">
                  You are depositing <span className="text-white font-bold">${amount.toFixed(2)}</span>. 
                  Choose a coin to generate a payment address.
                </p>

                {loadingCoins ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
                    <p className="text-sm text-secondary">Loading available coins...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {coins.map((coin) => (
                      <button
                        key={coin}
                        disabled={isSubmitting}
                        onClick={() => handleCoinSelect(coin)}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                          selectedCoin === coin 
                            ? 'bg-neon-blue/20 border-neon-blue text-white' 
                            : 'glass border-border-strong hover:bg-white/5 text-secondary hover:text-white'
                        } ${isSubmitting && selectedCoin !== coin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSubmitting && selectedCoin === coin ? (
                          <Loader2 className="w-5 h-5 animate-spin text-neon-blue" />
                        ) : (
                          <span className="font-mono text-sm uppercase tracking-wider font-bold">
                            {coin}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'payment_details' && paymentDetails && (
              <div className="space-y-6">
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
                  <p className="text-xs text-muted mt-2">
                    ≈ ${paymentDetails.price_amount} USD
                  </p>
                </div>

                <div className="flex justify-center bg-white p-3 rounded-xl mx-auto w-fit">
                  <QRCodeSVG 
                    value={paymentDetails.pay_address} 
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-4">
                  {/* Amount Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-secondary uppercase ml-1">Amount</label>
                    <div className="flex relative">
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

                  {/* Address Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-secondary uppercase ml-1">Deposit Address</label>
                    <div className="flex relative">
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

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-xs text-orange-400">
                  <p className="font-bold mb-1">⚠️ Important</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Send only <b>{paymentDetails.pay_currency.toUpperCase()}</b> to this address.</li>
                    <li>Ensure you are using the correct network.</li>
                    <li>Payment will be credited automatically after network confirmations.</li>
                  </ul>
                </div>
                
                <button
                  onClick={handleClose}
                  className="btn-primary w-full py-3 text-sm"
                >
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
