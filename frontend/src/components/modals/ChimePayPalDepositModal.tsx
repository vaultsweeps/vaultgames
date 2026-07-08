import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, ArrowRight, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { depositApi, publicApi } from '@/lib/api'

interface ChimePayPalDepositModalProps {
  isOpen: boolean
  onClose: () => void
  method: 'chime' | 'paypal' | null
}

export default function ChimePayPalDepositModal({ isOpen, onClose, method }: ChimePayPalDepositModalProps) {
  const [step, setStep] = useState(1) // 1: Pay, 2: Details, 3: Status
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'failed' | 'timeout'>('idle')
  const [amount, setAmount] = useState<string>('0.00')
  const [profileName, setProfileName] = useState('')
  const [methods, setMethods] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    if (isOpen && method) {
      depositApi.getPaymentMethods().then(res => setMethods(res.data.data)).catch(() => {})
      publicApi.getSettings().then(res => setSettings(res.data.data || {})).catch(() => {})
      setStep(1)
      setStatus('idle')
      setAmount('0.00')
      setProfileName('')
    }
  }, [isOpen, method])


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
    if (!profileName.trim()) return toast.error(`Please enter your ${method === 'chime' ? 'Chime' : 'PayPal'} name`)

    setStatus('verifying')
    setStep(3)
    try {
      const pm = methods.find(m => m.code === method) || methods.find(m => m.name.toLowerCase().includes(method!))
      const paymentMethodId = pm ? pm.id : `temp-${method}-id`
      
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

  if (!method) return null;

  const config = {
    chime: {
        name: 'Chime',
        color: 'bg-emerald-500',
        text: 'text-emerald-500',
        recipient: '$Luis-Feliciano-114',
        linkUrl: 'https://www.chime.com/r/Luis-Feliciano-114/?c=q',
        qrUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Chime_company_logo.svg/1200px-Chime_company_logo.svg.png' // Just placeholder if we had QR we'd put here
    },
    paypal: {
        name: 'PayPal',
        color: 'bg-blue-500',
        text: 'text-blue-500',
        recipient: 'Luis Feliciano',
        linkUrl: 'https://www.paypal.com/paypalme/Luis9542',
        qrUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg'
    }
  }

  const currentConfig = config[method];

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
      <motion.div 
        key={`${method}-overlay`}
        initial={{ opacity: 0, pointerEvents: 'none' }}
        animate={{ opacity: 1, pointerEvents: 'auto' }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          key={`${method}-modal`}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border-subtle flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-white font-bold text-2xl mb-1">{currentConfig.name} Deposit</h2>
              {step === 1 ? (
                <p className="text-secondary text-sm">First, send your payment via {currentConfig.name}</p>
              ) : (
                <p className="text-secondary text-sm">Provide your payment details for verification</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-secondary hover:text-white rounded-full transition-colors -mr-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 pt-2 space-y-6 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-surface rounded-2xl p-5 border border-border-subtle flex flex-col gap-4 text-center">
                  <div className={`w-12 h-12 rounded-full ${currentConfig.color} bg-opacity-10 flex items-center justify-center mx-auto`}>
                    <ArrowRight className={`w-6 h-6 ${currentConfig.text}`} />
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">
                    To start, you must send the money via {currentConfig.name}. Please send your deposit to the following recipient:
                  </p>
                  
                  <div className="bg-surface-elevated p-4 rounded-xl border border-border-subtle flex justify-between items-center">
                     <div>
                       <p className="text-muted text-xs mb-1 text-left">Recipient / Tag</p>
                       <p className="text-white font-bold text-xl tracking-wider select-all">{currentConfig.recipient}</p>
                     </div>
                     <button
                       onClick={() => {
                         navigator.clipboard.writeText(currentConfig.recipient);
                         toast.success('Copied to clipboard!');
                       }}
                       className="p-3 bg-surface hover:bg-white/5 rounded-xl transition-colors text-secondary hover:text-white"
                     >
                       <Copy className="w-5 h-5" />
                     </button>
                  </div>

                  <p className="text-xs text-amber-400 mt-2">
                    Make sure to complete the transfer on your {currentConfig.name} app before continuing.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <a 
                    href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-[#3b1d24] hover:bg-[#4d242e] text-white font-bold py-4 rounded-2xl transition-all border border-red-500/20 text-center flex items-center justify-center"
                  >
                    Can't find tag
                  </a>
                  <button 
                    onClick={() => {
                      const isAndroid = /Android/i.test(navigator.userAgent || '');
                      if (method === 'paypal') {
                        if (isAndroid) {
                          window.location.href = 'intent://paypal.com/paypalme/Luis9542#Intent;scheme=https;package=com.paypal.android.p2pmobile;end;';
                        } else {
                          window.location.href = 'https://www.paypal.com/paypalme/Luis9542';
                        }
                      } else if (method === 'chime') {
                        if (isAndroid) {
                          window.location.href = 'intent://chime.com/r/Luis-Feliciano-114/?c=q#Intent;scheme=https;package=com.onedebit.chime;end;';
                        } else {
                          window.location.href = 'https://www.chime.com/r/Luis-Feliciano-114/?c=q';
                        }
                      }
                    }}
                    className={`flex-[2] ${currentConfig.color} hover:opacity-90 text-white font-bold py-4 rounded-2xl transition-all text-center flex items-center justify-center`}
                  >
                    Open {currentConfig.name} to Pay
                  </button>
                </div>

                <button 
                  onClick={handleContinue}
                  className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all"
                >
                  I have paid, Continue
                </button>
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-secondary text-sm text-center">Enter the amount you sent</p>
                  
                  <div className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-subtle relative">
                    <div className="flex items-center w-full">
                      <span className={`${currentConfig.text} mr-2 text-3xl font-bold`}>$</span>
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
                        className={`bg-surface hover:bg-surface-elevated ${currentConfig.text} font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm`}
                      >
                        +{add}
                      </button>
                    ))}
                    <button 
                      onClick={() => handleMultiply(2)}
                      className={`bg-surface hover:bg-surface-elevated ${currentConfig.text} font-bold py-2.5 rounded-xl border border-border-subtle transition-colors text-sm`}
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
                  <p className="text-secondary text-sm">Sender {currentConfig.name} Name</p>
                  <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex items-center relative">
                    <input 
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={`Your Name on ${currentConfig.name} (e.g. Chad M.)`}
                      className="bg-transparent text-secondary text-sm w-full focus:outline-none placeholder:text-slate-600 font-medium"
                    />
                    <div className={`w-1.5 h-1.5 rounded-full ${currentConfig.color} absolute right-4`}></div>
                  </div>
                  <p className="text-xs text-muted mt-1">Make sure this matches exactly to enable automatic verification from the receipt.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleISent}
                    disabled={status === 'verifying'}
                    className={`flex-[2] ${currentConfig.color} hover:opacity-90 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50`}
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
                    <div className={`w-16 h-16 rounded-full border-4 ${currentConfig.text} border-opacity-30 border-t-current animate-spin mx-auto`}></div>
                    <h3 className="text-white font-bold text-xl">Verifying Payment...</h3>
                    <p className="text-secondary text-sm">We are checking our {currentConfig.name} inbox for your payment of <span className="text-white font-bold">${amount}</span> from <span className="text-white font-bold">{profileName}</span>. This may take up to 60 seconds.</p>
                  </motion.div>
                )}

                {status === 'success' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-2xl">Payment Verified!</h3>
                    <p className="text-secondary text-sm">Your deposit has been successfully verified and added to your balance.</p>
                    <button onClick={onClose} className={`w-full ${currentConfig.color} hover:opacity-90 text-white font-bold py-4 rounded-2xl transition-all mt-4`}>
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
                      <a href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps"} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 bg-[#2AC3FF]/10 text-[#2AC3FF] hover:bg-[#2AC3FF]/20 font-bold py-3 rounded-xl transition-all border border-[#2AC3FF]/20 text-sm">
                        Telegram
                      </a>
                      <a href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://m.me/vaultsweeps"} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold py-3 rounded-xl transition-all border border-blue-500/20 text-sm">
                        Messenger
                      </a>
                      <a href="mailto:supportvaultsweeps@gmail.com" className="flex items-center justify-center gap-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 font-bold py-3 rounded-xl transition-all border border-purple-500/20 text-sm">
                        Email
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
                    <button onClick={onClose} className={`w-full ${currentConfig.color} hover:opacity-90 text-white font-bold py-4 rounded-2xl transition-all mt-4`}>
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
