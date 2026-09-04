'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { getSignalUrl } from '@/lib/signal'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi, publicApi } from '@/lib/api'

interface ZappayDepositModalProps {
  isOpen: boolean
  onClose: () => void
  method?: 'zappay' | 'apple' | 'card' | null
}

export default function ZappayDepositModal({ isOpen, onClose, method = 'zappay' }: ZappayDepositModalProps) {
  const getTitle = () => {
    if (method === 'apple') return 'Apple Pay'
    if (method === 'card') return 'Debit Card'
    return 'Zappay'
  }
  const title = getTitle()
  const [step, setStep] = useState(1) // 1: Pay, 2: Details, 3: Status
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'failed' | 'timeout'>('idle')
  const [amount, setAmount] = useState<string>('0.00')
  const [profileName, setProfileName] = useState('')
  const [methods, setMethods] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})
  const [signalUrl, setSignalUrl] = useState('')

  useEffect(() => {
    if (isOpen) {
      depositApi.getPaymentMethods().then(res => setMethods(res.data.data)).catch(() => {})
      publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
      setSignalUrl(getSignalUrl())
      setStep(1)
      setStatus('idle')
      setAmount('0.00')
      setProfileName('')
    }
    // Body overflow is managed by WalletModal (parent)
  }, [isOpen])

  // Keep signal URL up to date as shifts change
  useEffect(() => {
    setSignalUrl(getSignalUrl())
    const t = setInterval(() => setSignalUrl(getSignalUrl()), 60_000)
    return () => clearInterval(t)
  }, [])


  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    setAmount(val)
  }

  const handleAdd = (add: number) => {
    setAmount(prev => {
      const current = parseFloat(prev) || 0
      return (current + add).toFixed(2)
    })
  }

  const handleMultiply = (mult: number) => {
    setAmount(prev => {
      const current = parseFloat(prev) || 0
      return (current * mult).toFixed(2)
    })
  }

  const handleContinue = () => {
    setStep(2)
  }

  const handleISent = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) return toast.error('Please enter a valid amount')
    if (!profileName.trim()) return toast.error('Please enter your Zappay profile name')

    setStatus('verifying')
    setStep(3)
    try {
      const methodStr = method || 'zappay'
      const activeMethod = methods.find(m => m.code === methodStr) || methods.find(m => m.name.toLowerCase().includes(methodStr))
      const paymentMethodId = activeMethod ? activeMethod.id : `temp-${methodStr}-id`
      
      const res = await depositApi.create({ 
        amount: parseFloat(amount), 
        paymentMethodId,
        accountName: profileName // Pass profile name to backend
      })
      const depositId = res.data.data.id;
      
      let attempts = 0;
      const maxAttempts = 12; // 60 seconds
      
      const poll = setInterval(async () => {
        attempts++;
        try {
          const checkRes = await depositApi.getOne(depositId);
          const currentStatus = checkRes.data.data.status;
          
          if (currentStatus === 'approved') {
            clearInterval(poll);
            setStatus('success');
            toast.success('Payment verified successfully!');
          } else if (currentStatus === 'failed') {
            clearInterval(poll);
            setStatus('failed');
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            setStatus('timeout');
          }
        } catch (e) {
          console.error(e)
        }
      }, 5000);

    } catch (err: any) {
      setStatus('idle')
      setStep(2)
      toast.error(err?.response?.data?.message || err.message || 'Failed to submit deposit')
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
      <motion.div 
        key="zappay-overlay"
        initial={{ opacity: 0, pointerEvents: 'none' }}
        animate={{ opacity: 1, pointerEvents: 'auto' }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          key="zappay-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col"
        >
          {/* Header */}
          <div className="p-6 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-white font-bold text-2xl mb-1">{title}</h2>
              {step === 1 ? (
                <p className="text-secondary text-sm">First, send your payment via {title}</p>
              ) : (
                <p className="text-secondary text-sm">Provide your payment details for verification</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors -mr-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 pt-2 space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-surface rounded-2xl p-5 border border-[#2AC3FF]/30 flex flex-col gap-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#2AC3FF]/10 flex items-center justify-center mx-auto">
                    <ArrowRight className="w-6 h-6 text-[#2AC3FF]" />
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">
                    To start, you must send the money via {title}. Once you've completed the transfer, you will receive a Profile Name/Sender Name.
                  </p>
                </div>

                <a 
                  href="https://app.myzappay.com/en/pay/vegaswera"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all text-center flex items-center justify-center w-full"
                >
                  Click here to pay
                </a>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleContinue}
                    className="flex-[2] bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    I have paid, Continue
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-all border border-border-subtle"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-secondary text-sm text-center">Enter the amount you sent</p>
                  
                  <div className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-subtle relative">
                    <div className="flex items-center w-full">
                      <span className="text-[#2AC3FF] mr-2 text-3xl font-bold">$</span>
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

                  <div className="grid grid-cols-5 gap-2">
                    {[5, 10, 25].map(add => (
                      <button 
                        key={add}
                        onClick={() => handleAdd(add)}
                        className="bg-surface hover:bg-surface-elevated text-[#2AC3FF] font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm"
                      >
                        +{add}
                      </button>
                    ))}
                    <button 
                      onClick={() => handleMultiply(2)}
                      className="bg-surface hover:bg-surface-elevated text-[#2AC3FF] font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm"
                    >
                      X2
                    </button>
                    <button 
                      onClick={() => setAmount('0.00')}
                      className="bg-[#3b1d24] hover:bg-[#4d242e] text-red-400 font-bold py-2.5 rounded-xl border border-red-500/20 transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-secondary text-sm">Sender {title} Profile Name</p>
                  <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center relative">
                    <input 
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your Profile Name (e.g. Nick Roger)"
                      className="bg-transparent text-secondary text-sm w-full focus:outline-none placeholder:text-slate-600 font-medium"
                    />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2AC3FF] absolute right-4"></div>
                  </div>
                  <p className="text-xs text-muted mt-1">Make sure this matches exactly to enable automatic verification.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleISent}
                    disabled={status === 'verifying'}
                    className="flex-[2] bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50"
                  >
                    Verify Deposit
                  </button>
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-all border border-border-subtle"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 text-center py-6">
                {status === 'verifying' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full border-4 border-[#2AC3FF]/30 border-t-[#2AC3FF] animate-spin mx-auto"></div>
                    <h3 className="text-white font-bold text-xl">Verifying Payment...</h3>
                    <p className="text-secondary text-sm">We are checking our {title} inbox for your payment of <span className="text-white font-bold">${amount}</span> from <span className="text-white font-bold">{profileName}</span>. This may take up to 60 seconds.</p>
                  </motion.div>
                )}

                {status === 'success' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-2xl">Payment Verified!</h3>
                    <p className="text-secondary text-sm">Your deposit has been successfully verified and added to your balance.</p>
                    <button onClick={onClose} className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all mt-4">
                      Close
                    </button>
                  </motion.div>
                )}

                {status === 'failed' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                      <X className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-2xl">Verification Failed</h3>
                    <p className="text-secondary text-sm">We could not find a matching payment. If you already sent it, please wait a few minutes and check your history.</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 w-full">
                      {smsUrl && (
                        <a href={smsUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 font-bold py-2 rounded-xl transition-all border border-[#4ade80]/30 text-xs relative overflow-hidden group">
                          <div className="absolute inset-0 bg-[#4ade80]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-center gap-1.5 z-10">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            SMS
                          </div>
                          <span className="text-[10px] font-medium opacity-80 z-10">Fastest</span>
                        </a>
                      )}
                      <a href={getTelegramUrl(settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps", useAuthStore.getState().user)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 bg-[#2AC3FF]/10 text-[#2AC3FF] hover:bg-[#2AC3FF]/20 font-bold py-3 rounded-xl transition-all border border-[#2AC3FF]/20 text-sm">
                        Telegram
                      </a>
                      <a href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://m.me/vaultsweeps"} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold py-3 rounded-xl transition-all border border-blue-500/20 text-sm">
                        Messenger
                      </a>
                    </div>
                    <button onClick={onClose} className="w-full bg-surface hover:bg-surface-elevated text-white font-bold py-4 rounded-2xl transition-all border border-border-subtle mt-4">
                      Close
                    </button>
                  </motion.div>
                )}

                {status === 'timeout' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                      <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-white font-bold text-2xl">Verification Pending</h3>
                    <p className="text-secondary text-sm">Your deposit request is submitted but verification is taking longer than expected. It will automatically be approved in the background once the email arrives.</p>
                    <button onClick={onClose} className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all mt-4">
                      Got it
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
