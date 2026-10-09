'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Mail, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'
import StatusCard from '@/components/verify/StatusCard'
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
  const [emailSent, setEmailSent] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  // Pre-fill with the number given at sign-up so they don't retype it (still editable)
  const signupPhone: string | undefined = (user as any)?.profile?.signupPhone
  useEffect(() => {
    if (signupPhone) setPhone(prev => prev || signupPhone)
  }, [signupPhone])

  // Keep the verified / not-verified status current: on open, and whenever the user comes back to this tab (e.g. after
  // clicking the link in their email). A failed refresh is ignored — it must never sign anyone out.
  const refreshStatus = () =>
    authApi.getMe().then(res => { if (res.data?.data) useAuthStore.getState().setUser(res.data.data) }).catch(() => {})
  useEffect(() => {
    refreshStatus()
    const onFocus = () => { if (document.visibilityState === 'visible') refreshStatus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [])

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
      setEmailSent(true)
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
      await refreshStatus()
      
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

  const emailVerified = !!user.isVerified
  // isPhoneVerified comes from the server; a saved verified phone number is the fallback for older cached data
  const phoneVerified = !!((user as any).isPhoneVerified ?? (user as any).profile?.phone)
  const allVerified = emailVerified && phoneVerified

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div id="recaptcha-container"></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-[#0f1016] rounded-[24px] border border-white/[0.08] shadow-[0_0_80px_rgba(0,212,255,0.15)] relative overflow-hidden"
      >
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[150px] bg-blue-500/10 blur-[100px] pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-white/[0.05] relative flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {step !== 'select' && (
              <button 
                onClick={() => setStep('select')}
                className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center text-secondary hover:text-white hover:bg-white/[0.08] hover:scale-105 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-1 tracking-tight">Welcome Bonus</h1>
              <p className="text-secondary text-sm font-medium">
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
            className="w-10 h-10 flex items-center justify-center rounded-full text-secondary hover:text-white hover:bg-white/[0.08] hover:rotate-90 transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 relative min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 h-full flex flex-col justify-center"
              >
                <div className="grid grid-cols-2 gap-3 sm:gap-5 items-stretch">
                  <StatusCard
                    icon={Phone}
                    verified={phoneVerified}
                    doneLabel="Phone number verified"
                    todoLabel="Confirm phone number"
                    buttonLabel="Verify now"
                    onVerify={() => setStep('phone_input')}
                  />
                  <StatusCard
                    icon={Mail}
                    verified={emailVerified}
                    doneLabel="Email address verified"
                    todoLabel="Confirm email address"
                    buttonLabel={emailSent ? 'Resend email' : 'Verify now'}
                    onVerify={handleVerifyEmail}
                    loading={isSending}
                  />
                </div>

                {!emailVerified && (
                  <div className="flex items-start gap-3 text-sm font-medium text-amber-300/95 bg-amber-500/10 py-3 px-4 rounded-xl border border-amber-500/25">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <span><b className="text-amber-200">Note:</b> Please check your Spam or Junk folder if you do not see the email.</span>
                  </div>
                )}

                {allVerified ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 text-sm text-emerald-300">
                      <ShieldCheck className="w-6 h-6 shrink-0 text-emerald-400" />
                      <span>You&apos;re all set — both are verified, so you&apos;re eligible for your 100% signup bonus.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/games')}
                      className="w-full btn-primary py-3.5 text-base rounded-[16px] shadow-[0_0_20px_rgba(0,212,255,0.3)]"
                    >
                      Continue to games
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06] text-sm text-secondary">
                    <ShieldCheck className="w-6 h-6 shrink-0 text-blue-400" />
                    <span>Verify both your phone number and email address to claim your 100% signup bonus.</span>
                  </div>
                )}
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
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="input-neon text-lg py-4 px-5 bg-black/20"
                    required
                  />
                  <p className="text-xs text-secondary mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Please include your country code (e.g. +1 for US).
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSending || !phone}
                  className="w-full btn-primary py-4 text-lg rounded-[16px] flex items-center justify-center gap-2 group disabled:opacity-50 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
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
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="input-neon text-lg py-4 px-5 bg-black/20 text-center tracking-[0.5em] font-mono font-bold"
                    required
                  />
                  <p className="text-xs text-secondary mt-3 flex items-center justify-center gap-1.5 bg-black/20 py-2 rounded-lg border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    We sent a code to <span className="text-white font-semibold">{phone}</span>
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSending || !otpCode}
                  className="w-full btn-primary py-4 text-lg rounded-[16px] flex items-center justify-center gap-2 group disabled:opacity-50 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
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
