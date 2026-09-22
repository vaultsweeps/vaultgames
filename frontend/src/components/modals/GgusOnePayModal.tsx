'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, ChevronDown, Shield, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi } from '@/lib/api'

interface GgusOnePayModalProps {
  isOpen: boolean
  onClose: () => void
  paymentMethodId: string
  preset?: string  // pre-select a specific wayCode (e.g. 'applepay', 'googlepay', 'card')
  onSuccess?: () => void
}

const GGUSONEPAY_METHODS = [
  { value: 'ecashapp', label: 'Cash App' },
  // Zelle is temporarily unavailable and not supported at this time.
  // { value: 'paypal', label: 'PayPal' }, // Temporarily disabled due to GgusOnePay Channel Maintenance
  { value: 'applepay', label: 'Apple Pay' },
  { value: 'googlepay', label: 'Google Pay' },
  { value: 'card', label: 'Debit Card' },
  { value: 'chime', label: 'Chime' }
]

export default function GgusOnePayModal({ isOpen, onClose, paymentMethodId, preset, onSuccess }: GgusOnePayModalProps) {
  const [payType, setPayType] = useState(preset || 'ecashapp')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPayType(preset || 'ecashapp')
      setAmount('')
      setIsSubmitting(false)
    }
  }, [isOpen, preset])

  const handleSubmit = async () => {
    if (!payType) return toast.error('Please select a payment type')
    
    const parsedAmount = parseFloat(amount)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) return toast.error('Please enter a valid amount')

    // Specific limits for debit card as per GgusOnePay gateway rules
    if (payType === 'card') {
      if (parsedAmount < 10.99) return toast.error('Minimum amount for Debit Card is $10.99')
      if (parsedAmount > 199.99) return toast.error('Maximum amount for Debit Card is $199.99')
    }

    if (!paymentMethodId) return toast.error('Payment method not loaded. Please close and reopen the wallet.')

    const payload = { 
      amount: parseFloat(amount), 
      paymentMethodId, 
      ggusonepayMethod: payType 
    }
    console.log('[GgusOnePay] Submitting deposit:', payload)

    setIsSubmitting(true)
    try {
      const res = await depositApi.create(payload)

      const data = res.data?.data

      if (data?.redirectRequired && data?.paymentUrl) {
        toast.success('Redirecting to payment gateway...')
        window.location.href = data.paymentUrl
      } else {
        toast.error('Payment URL not received')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payment submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

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
        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
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
          }}
        >
          {/* Glow accent top */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #22c55e, transparent)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                💸
              </div>
              <div>
                <h2 className="text-white font-bold text-base tracking-wide">Instant Deposit</h2>
                <p className="text-xs" style={{ color: '#22c55e' }}>Secure · Encrypted · Auto-Verified</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Shield, label: 'SSL Secured', color: '#22c55e' },
                { icon: Zap, label: 'Instant Credit', color: '#F7931A' }
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Payment Type */}
            {preset ? (
              <div>
                <label style={labelStyle}>Payment Method</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
                  <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>
                  <span>{GGUSONEPAY_METHODS.find(m => m.value === preset)?.label || preset}</span>
                </div>
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Payment Method</label>
                <div className="relative">
                  <select
                    value={payType}
                    onChange={e => setPayType(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '36px' }}
                    onFocus={e => (e.target.style.borderColor = '#22c55e')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  >
                    {GGUSONEPAY_METHODS.map(t => (
                      <option key={t.value} value={t.value} style={{ background: '#0d1117' }}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>
              </div>
            )}

            {/* Amount Selection */}
            <div>
              <label style={labelStyle}>Select Amount (USD)</label>
              <div 
                className="grid grid-cols-3 gap-2 overflow-y-auto pr-1"
                style={{ maxHeight: '180px' }}
              >
                {(payType === 'chime' ? [
                  '20', '25', '30', '31', '40', '50', '60', '100', 
                  '125', '130', '150', '200', '300', '400', '500'
                ] : payType === 'card' ? [
                  '10.99', '14.99', '17.99', '19.99', '24.99', '29.99', '30.99',
                  '39.99', '49.99', '59.99', '99.99', '124.99', '129.99',
                  '149.99', '199.99'
                ] : [
                  '9.99', '14.99', '17.99', '19.99', '24.99', '29.99', '30.99',
                  '39.99', '49.99', '59.99', '99.99', '124.99', '129.99',
                  '149.99', '199.99', '249.99', '299.99', '399.99', '499.99'
                ]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      amount === val 
                        ? 'bg-[#22c55e] border-[#22c55e] text-[#000] shadow-[0_0_12px_rgba(34,197,94,0.3)]' 
                        : 'bg-transparent border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount || !payType}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-black mt-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] flex justify-center items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
            >
              {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : 'CONTINUE TO PAYMENT →'}
            </button>

            <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              You will be securely redirected to complete payment.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
