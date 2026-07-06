import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Paperclip, CheckCircle, Clock, Shield, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { publicApi, withdrawalApi } from '@/lib/api'

const TIMER_SECONDS = 10 * 60 // 10 minutes

interface CountdownProps {
  amount: string
  title: string
  settings: any
  onClose: () => void
  withdrawalId: string | null
}

function WithdrawalCountdown({ amount, title, settings, onClose, withdrawalId }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const expired = secondsLeft <= 0

  // Timer interval
  useEffect(() => {
    if (status !== 'pending') return
    
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status])

  // Polling interval
  useEffect(() => {
    if (!withdrawalId || status !== 'pending') return
    
    pollRef.current = setInterval(async () => {
      try {
        const res = await withdrawalApi.getOne(withdrawalId)
        const currentStatus = res.data.data.status
        if (currentStatus === 'approved') {
          setStatus('approved')
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (['rejected', 'canceled', 'failed'].includes(currentStatus)) {
          setStatus('rejected')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch (err) {
        console.error('Failed to poll withdrawal status', err)
      }
    }, 5000)
    
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [withdrawalId, status])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const progress = secondsLeft / TIMER_SECONDS // 1.0 → 0.0
  
  // SVG ring params
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  // Color shifts from green → yellow → red as time runs low
  const ringColor = secondsLeft > 300 ? '#2AC3FF' : secondsLeft > 120 ? '#F59E0B' : '#EF4444'
  const glowColor = secondsLeft > 300 ? '42, 195, 255' : secondsLeft > 120 ? '245, 158, 11' : '239, 68, 68'

  const messages = [
    { threshold: 480, text: '🚀 Payment is being processed...', sub: 'Our team has received your request' },
    { threshold: 300, text: '⚡ Almost there!', sub: 'Your transfer is being finalized' },
    { threshold: 120, text: '🔥 Just moments away!', sub: 'Payment is nearly complete' },
    { threshold: 0, text: '✅ Checking final status...', sub: 'Awaiting confirmation' },
  ]
  const msg = status === 'approved' 
    ? { text: '🎉 Payment Approved!', sub: 'The funds have been sent to your account.' }
    : status === 'rejected'
      ? { text: '❌ Payment Rejected', sub: 'Please contact support for more details.' }
      : messages.find(m => secondsLeft >= m.threshold) || messages[messages.length - 1]

  if (status === 'approved') {
    return (
      <div className="p-6 flex flex-col items-center">
        <div className="w-full flex justify-end mb-2">
          <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Payment Approved!</h2>
        <p className="text-secondary text-center text-sm mb-6">Your cashout of ${amount} has been successfully processed and sent to your {title} account.</p>
        <button onClick={onClose} className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all">
          Done
        </button>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="p-6 flex flex-col items-center">
        <div className="w-full flex justify-end mb-2">
          <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <X className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Payment Rejected</h2>
        <p className="text-secondary text-center text-sm mb-6">Your cashout of ${amount} could not be processed at this time.</p>
        <div className="w-full space-y-3">
          <a href={settings.telegram_url || 'https://t.me/vaultsweeps_support'} target="_blank" rel="noreferrer" className="w-full block bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all text-center">
            Contact Support
          </a>
          <button onClick={onClose} className="w-full bg-surface hover:bg-surface-elevated text-white font-bold py-3.5 rounded-2xl transition-all border border-border-subtle">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6">
        <div>
          <h2 className="text-white text-xl font-bold">Withdrawal Submitted</h2>
          <p className="text-secondary text-xs mt-0.5">${amount} via {title}</p>
        </div>
        <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ring Timer */}
      <div className="relative flex items-center justify-center my-2" style={{ width: 180, height: 180 }}>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 40px rgba(${glowColor}, 0.3)`, transition: 'box-shadow 1s ease' }} />
        
        {/* Pulsing background */}
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(${glowColor}, 0.08) 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* SVG ring */}
        <svg className="absolute inset-0 -rotate-90" width="180" height="180">
          {/* Track */}
          <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="relative flex flex-col items-center">
          {expired ? (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          ) : (
            <>
              <span className="text-white text-4xl font-bold font-mono tabular-nums leading-none">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="text-secondary text-xs mt-1">remaining</span>
            </>
          )}
        </div>
      </div>

      {/* Status message */}
      <motion.div
        key={msg.text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mt-4 mb-6"
      >
        <p className="text-white font-semibold text-base">{msg.text}</p>
        <p className="text-secondary text-sm mt-1">{msg.sub}</p>
      </motion.div>

      {/* Trust badges */}
      <div className="w-full grid grid-cols-3 gap-2 mb-6">
        {[
          { icon: Shield, label: 'Secure', color: 'text-emerald-400' },
          { icon: Zap, label: 'Fast Transfer', color: 'text-[#2AC3FF]' },
          { icon: Clock, label: '24/7 Support', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="bg-white/5 rounded-xl p-3 flex flex-col items-center gap-1.5 border border-border-subtle">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-secondary text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-2">
        <a
          href={settings.telegram_url || 'https://t.me/vaultsweeps_support'}
          target="_blank" rel="noreferrer"
          className="w-full block bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-2xl transition-all text-center text-sm"
        >
          Track via Telegram Support
        </a>
        <button
          onClick={onClose}
          className="w-full text-muted hover:text-white transition-colors text-sm py-2"
        >
          Close — I'll check my balance later
        </button>
      </div>
    </div>
  )
}

interface ManualCashoutModalProps {
  isOpen: boolean
  onClose: () => void
  method: 'chime' | 'cashapp'
  balance: number
}

export default function ManualCashoutModal({ isOpen, onClose, method, balance }: ManualCashoutModalProps) {
  const [amount, setAmount] = useState<string>('0.00')
  const [tag, setTag] = useState('')
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    if (isOpen) {
      publicApi.getSettings().then(res => setSettings(res.data.data)).catch(() => {})
    } else {
      // Reset state when modal closes so it starts fresh next time
      const t = setTimeout(() => {
        setShowSuccess(false)
        setWithdrawalId(null)
        setAmount('0.00')
        setTag('')
        setQrFile(null)
      }, 300)
      return () => clearTimeout(t)
    }
    // Body overflow is managed by WalletModal (parent)
  }, [isOpen])


  const isChime = method === 'chime'
  const title = isChime ? 'Chime' : 'CashApp'
  const tagPlaceholder = isChime ? '$chime-tag' : '$cashtag'
  const tagLabel = isChime ? 'Your chime $tag' : 'Your cashapp $tag'

  const handlePercentage = (percent: number) => {
    setAmount(((balance * percent) / 100).toFixed(2))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQrFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) return toast.error('Please enter a valid amount')
    if (numAmount > balance) return toast.error('Insufficient balance')
    if (!tag.trim()) return toast.error(`Please enter your ${title} tag`)

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('amount', numAmount.toString())
      formData.append('paymentMethodId', method)
      formData.append('accountInfo', tag)
      if (qrFile) {
        formData.append('qrCode', qrFile)
      }

      const res = await withdrawalApi.manualCashout(formData)

      if (res.data?.data?.id) {
        setWithdrawalId(res.data.data.id)
      }
      
      setShowSuccess(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // allow only numbers and decimal
    const val = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(val)
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
      <motion.div 
        key="cashout-overlay"
        initial={{ opacity: 0, pointerEvents: 'none' }}
        animate={{ opacity: 1, pointerEvents: 'auto' }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          key="cashout-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col"
        >
          {showSuccess ? (
            <WithdrawalCountdown amount={amount} title={title} settings={settings} onClose={onClose} withdrawalId={withdrawalId} />
          ) : (
            <>
              {/* Header */}
              <div className="p-6 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-white font-bold text-2xl mb-1">{title}</h2>
                  <p className="text-secondary text-sm">Fill in all the fields to create a<br/>withdrawal request.</p>
                </div>
                <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors -mr-2">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 pt-2 space-y-6">
                {/* Amount Section */}
                <div className="space-y-4">
                  <p className="text-secondary text-sm text-center">Enter cashout amount</p>
                  
                  <div className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-subtle relative">
                    <div className="flex items-center w-full">
                      <span className="text-muted mr-2 text-3xl font-bold">$</span>
                      <input 
                        type="text"
                        value={amount}
                        onChange={handleAmountChange}
                        className="bg-transparent text-white font-bold text-4xl w-full focus:outline-none placeholder:text-slate-700"
                        placeholder="0.00"
                      />
                    </div>
                    {amount !== '0.00' && amount !== '' && (
                      <button onClick={() => setAmount('')} className="absolute right-4 text-muted hover:text-secondary">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map(pct => (
                      <button 
                        key={pct}
                        onClick={() => handlePercentage(pct)}
                        className="bg-surface hover:bg-surface-elevated text-[#2AC3FF] font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                    <span className="text-secondary text-sm">Available balance</span>
                    <span className="text-white font-bold text-sm">${balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tag Input */}
                <div className="space-y-2">
                  <p className="text-secondary text-sm">{tagLabel}</p>
                  <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center relative">
                    <input 
                      type="text"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder={tagPlaceholder}
                      className="bg-transparent text-secondary text-sm w-full focus:outline-none placeholder:text-slate-600 font-medium"
                    />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600 absolute right-4"></div>
                  </div>
                </div>

                {/* QR Code Upload (Optional) */}
                <div className="space-y-2">
                  <p className="text-secondary text-sm flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> QR Code (Optional)
                  </p>
                  <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="bg-transparent text-secondary text-sm w-full focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#2AC3FF]/10 file:text-[#2AC3FF] hover:file:bg-[#2AC3FF]/20"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-[2] bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : 'Continue'}
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-all border border-border-subtle"
                  >
                    Back
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
