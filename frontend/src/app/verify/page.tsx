'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'

type Step = 'select' | 'phone_input' | 'otp_input'

export default function VerifyPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isSending, setIsSending] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (user === null) {
      router.push('/login')
    }
  }, [user, router])

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })
    }
  }

  const handleVerifyEmail = async () => {
    if (user?.isVerified) {
      toast.success('Your email is already verified!')
      if ((user as any).isPhoneVerified) {
        router.push('/games')
      }
      return
    }

    setIsSending(true)
    try {
      await authApi.resendVerification()
      toast.success('Verification email sent! Please check your inbox and Spam folder.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send verification email.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) {
      toast.error('Please enter your phone number.')
      return
    }

    setIsSending(true)
    try {
      // Check if phone number is already used in our database before requesting OTP
      const formattedPhone = phone.startsWith('+') ? phone : '+' + phone;
      await authApi.checkPhone(formattedPhone);

      setupRecaptcha()
      const appVerifier = (window as any).recaptchaVerifier
      const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier)
      setConfirmationResult(confirmation)
      toast.success('Verification code sent to your phone!')
      setStep('otp_input')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || err.message || 'Failed to send verification code. Ensure phone number is valid and in E.164 format (e.g., +1...).')
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.render().then((widgetId: any) => {
          if ((window as any).grecaptcha) {
            (window as any).grecaptcha.reset(widgetId)
          }
        })
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode) {
      toast.error('Please enter the verification code.')
      return
    }
    if (!confirmationResult) {
      toast.error('Session expired. Please try again.')
      setStep('phone_input')
      return
    }

    setIsSending(true)
    try {
      const result = await confirmationResult.confirm(otpCode)
      const idToken = await result.user.getIdToken()
      
      await authApi.verifyPhoneOTP(idToken)
      toast.success('Phone verified successfully!')
      
      // Update local user state if needed, or redirect
      if (user?.isVerified) {
        router.push('/games')
      } else {
        setStep('select')
        toast('Don\'t forget to verify your email too!', { icon: '📧' })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Invalid or expired verification code.')
    } finally {
      setIsSending(false)
    }
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div id="recaptcha-container"></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-surface-elevated rounded-2xl border border-border-subtle shadow-2xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border-subtle relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <button 
                onClick={() => setStep('select')}
                className="text-secondary hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Welcome Bonus</h1>
              <p className="text-secondary text-sm">
                {step === 'select' 
                  ? 'Confirm your details to receive your bonus!' 
                  : step === 'phone_input'
                  ? 'Enter your phone number'
                  : 'Enter verification code'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="text-secondary hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 relative min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 h-full flex flex-col justify-center"
              >
                <div className="grid grid-cols-2 gap-4">
                  {/* Phone Card */}
                  <button 
                    onClick={() => setStep('phone_input')}
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-subtle bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full border border-border-strong flex items-center justify-center">
                      <Phone className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="text-secondary font-medium">Confirm phone<br/>number</span>
                  </button>

                  {/* Email Card */}
                  <button 
                    onClick={handleVerifyEmail}
                    disabled={isSending}
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border-subtle bg-white/[0.02] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-full border border-border-strong flex items-center justify-center">
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Mail className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <span className="text-secondary font-medium">Confirm email<br/>address</span>
                  </button>
                </div>

                <div className="text-sm text-yellow-500/80 text-center">
                  Note: Please check your Spam or Junk folder if you do not see the email.
                </div>
              </motion.div>
            )}

            {step === 'phone_input' && (
              <motion.form
                key="phone_input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendPhoneOTP}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full bg-background border border-border-subtle rounded-xl px-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary transition-colors"
                    required
                  />
                  <p className="text-xs text-secondary mt-2">
                    Please include your country code (e.g. +1 for US).
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSending || !phone}
                  className="w-full py-4 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isSending ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </motion.form>
            )}

            {step === 'otp_input' && (
              <motion.form
                key="otp_input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-background border border-border-subtle rounded-xl px-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary transition-colors text-center tracking-widest text-lg"
                    required
                  />
                  <p className="text-xs text-secondary mt-2 text-center">
                    We sent a code to {phone}
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSending || !otpCode}
                  className="w-full py-4 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isSending ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify Phone'
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
