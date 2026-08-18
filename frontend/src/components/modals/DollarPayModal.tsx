'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, CheckCircle, AlertTriangle, Shield, Zap, Clock, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface DollarPayModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  paymentMethodId: string
  onSuccess?: () => void
}

type ModalStep = 'checkout' | 'submitting' | 'pending' | 'success' | 'failed'

const PAYMENT_TYPES = [
  { value: '1', label: 'Cash App' },
  { value: '2', label: 'Apple Pay' },
  { value: '3', label: 'Google Pay' },
  { value: '4', label: 'Debit / Credit Card / Chime' },
]

// Amount options per payment type (from DollarPay's page)
const PAYMENT_AMOUNTS: Record<string, string[]> = {
  '1': ['4.99','5.99','6.99','7.99','8.99','9.99','10.99','11.99','12.99','13.99','14.99','17.99','19.99','22.99','24.99','29.99','30.99','32.99','39.99','49.99','54.99','59.99','99.99','109.99','124.99','129.99','149.99','199.99','249.99','299.99','399.99','499.99'],
  '2': ['4.99','5.99','6.99','7.99','8.99','9.99','10.99','11.99','12.99','13.99','14.99','17.99','19.99','22.99','24.99','29.99','30.99','32.99','39.99','49.99','54.99','59.99','99.99','109.99','124.99','129.99','149.99','199.99','249.99','299.99','399.99','499.99'],
  '3': ['4.99','5.99','6.99','7.99','8.99','9.99','10.99','11.99','12.99','13.99','14.99','17.99','19.99','22.99','24.99','29.99','30.99','32.99','39.99','49.99','54.99','59.99','99.99','109.99','124.99','129.99','149.99','199.99','249.99','299.99','399.99','499.99'],
  '4': ['9.99','10.99','11.99','12.99','13.99','14.99','17.99','19.99','22.99','24.99','29.99','30.99','32.99','39.99','49.99','54.99','59.99','99.99','109.99','124.99','129.99','149.99','199.99'],
}

export default function DollarPayModal({ isOpen, onClose, amount, paymentMethodId, onSuccess }: DollarPayModalProps) {
  const [step, setStep] = useState<ModalStep>('checkout')
  const [payType, setPayType] = useState('')
  const [selectedAmount, setSelectedAmount] = useState('')
  const [userName, setUserName] = useState('')
  const [timeLeft, setTimeLeft] = useState(900)
  const [cashAppTag, setCashAppTag] = useState('')
  const [cashAppInstructions, setCashAppInstructions] = useState<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => {
    if (!isOpen) { stopPolling(); return }
    setStep('checkout')
    setPayType('')
    setSelectedAmount('')
    setUserName('')
    setTimeLeft(900)
    setCashAppTag('')
    setCashAppInstructions(null)
    return () => stopTimer()
  }, [isOpen])

  const availableAmounts = payType ? PAYMENT_AMOUNTS[payType] || [] : []

  // Find closest available amount or default to first
  useEffect(() => {
    if (!payType) return
    const amounts = PAYMENT_AMOUNTS[payType] || []
    const targetStr = amount.toFixed(2)
    // Try to find exact or closest
    const exact = amounts.find(a => a === targetStr)
    const closest = exact || amounts.reduce((prev, curr) => {
      return Math.abs(parseFloat(curr) - amount) < Math.abs(parseFloat(prev) - amount) ? curr : prev
    }, amounts[0])
    setSelectedAmount(closest || '')
  }, [payType, amount])

  const handleSubmit = async () => {
    if (!payType) return toast.error('Please select a payment type')
    if (!selectedAmount) return toast.error('Please select an amount')
    if (!userName.trim()) return toast.error('Please enter your username')

    setStep('submitting')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'

      // Submit to DollarPay via backend proxy (no deposit record yet — webhook creates it)
      const formData = new URLSearchParams()
      formData.append('is_pay', payType)
      formData.append('amount', selectedAmount)
      formData.append('name', userName)

      const proxyRes = await fetch(`${backendUrl}/api/proxy/dollarpay-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })

      const result = await proxyRes.json()

      if (result.success && result.redirectUrl) {
        toast.success('Redirecting to payment gateway...')
        // Use location.href instead of window.open to avoid popup blockers
        window.location.href = result.redirectUrl
      } else if (result.success) {
        setCashAppInstructions(result.instructions)
        setStep('pending')
      } else {
        toast.error(result.message || 'Submission failed')
        setStep('checkout')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Payment submission failed')
      setStep('checkout')
    }
  }

  const handleClose = () => { stopTimer(); onClose() }
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '6px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={e => { if (e.target === e.currentTarget) handleClose() }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-md relative"
          style={{
            background: 'linear-gradient(135deg, #0d1117 0%, #0f1923 100%)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: '20px',
            boxShadow: '0 0 60px rgba(34,197,94,0.08), 0 25px 60px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Glow accent top */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #22c55e, transparent)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 z-10" style={{ background: 'linear-gradient(135deg, #0d1117 0%, #0f1923 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                💵
              </div>
              <div>
                <h2 className="text-white font-bold text-base tracking-wide">DollarPay Checkout</h2>
                <p className="text-xs" style={{ color: '#22c55e' }}>Secure · Encrypted · Auto-Verified</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CHECKOUT FORM */}
          {step === 'checkout' && (
            <div className="px-6 pb-6 space-y-4">
              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Shield, label: 'SSL Secured', color: '#22c55e' },
                  { icon: Zap, label: 'Instant Credit', color: '#F7931A' },
                  { icon: Clock, label: formatTime(timeLeft), color: '#00D4FF' }
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Payment Type */}
              <div>
                <label style={labelStyle}>Payment Type</label>
                <div className="relative">
                  <select
                    value={payType}
                    onChange={e => setPayType(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '36px' }}
                    onFocus={e => (e.target.style.borderColor = '#22c55e')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  >
                    <option value="" style={{ background: '#0d1117' }}>Select payment method</option>
                    {PAYMENT_TYPES.map(t => (
                      <option key={t.value} value={t.value} style={{ background: '#0d1117' }}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>
              </div>

              {/* Amount */}
              {payType && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  <label style={labelStyle}>Amount (USD)</label>
                  <div className="relative">
                    <select
                      value={selectedAmount}
                      onChange={e => setSelectedAmount(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '36px' }}
                      onFocus={e => (e.target.style.borderColor = '#22c55e')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                    >
                      <option value="" style={{ background: '#0d1117' }}>Select amount</option>
                      {availableAmounts.map(a => (
                        <option key={a} value={a} style={{ background: '#0d1117' }}>${a}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                </motion.div>
              )}

              {/* Username */}
              <div>
                <label style={labelStyle}>Your Username</label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="Enter your username"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#22c55e')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!payType || !selectedAmount || !userName.trim()}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black mt-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
              >
                PAY NOW →
              </button>

              <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Secured by 256-bit SSL encryption
              </p>
            </div>
          )}

          {/* SUBMITTING */}
          {step === 'submitting' && (
            <div className="px-6 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mt-4"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#22c55e' }} />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Processing Payment...</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Please wait, do not close this window.</p>
              </div>
            </div>
          )}

          {/* PENDING (waiting for payment) */}
          {step === 'pending' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 pb-6 space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl mb-2">💵</div>
                <h3 className="text-white font-bold text-lg mb-1">Complete Your Payment</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your deposit of <span style={{ color: '#22c55e', fontWeight: 700 }}>${selectedAmount}</span> via {PAYMENT_TYPES.find(t=>t.value===payType)?.label} is pending.
                </p>
              </div>

              {cashAppTag && (
                <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Send to Cash App tag</p>
                  <p className="text-xl font-bold font-mono" style={{ color: '#22c55e' }}>{cashAppTag}</p>
                </div>
              )}

              {cashAppInstructions && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-sm text-white leading-relaxed">{cashAppInstructions?.note || 'Follow the payment instructions sent to you.'}</p>
                </div>
              )}

              <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Method</span>
                  <span className="text-white font-medium">{PAYMENT_TYPES.find(t=>t.value===payType)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Amount</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>${selectedAmount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting for payment confirmation...</span>
              </div>

              <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Your balance will be credited automatically once payment is confirmed.
              </p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="px-6 pb-8 flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mt-4"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
                <CheckCircle className="w-10 h-10" style={{ color: '#22c55e' }} />
              </motion.div>
              <div className="text-center">
                <h3 className="text-white font-bold text-xl mb-2">PAYMENT CONFIRMED!</h3>
                <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>${selectedAmount}</span> has been credited to your account.
                </p>
              </div>
              <button onClick={handleClose} className="w-full py-3 rounded-xl font-bold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                Continue to Dashboard
              </button>
            </motion.div>
          )}

          {/* FAILED */}
          {step === 'failed' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-6 pb-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mt-4"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: '#ef4444' }} />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Payment Not Completed</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Session expired or payment was not received.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  Cancel
                </button>
                <button onClick={() => { setStep('checkout'); setTimeLeft(900) }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
