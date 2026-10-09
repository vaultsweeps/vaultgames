'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Mail, ShieldCheck, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import StatusCard from '@/components/verify/StatusCard'
import { VERIFY_PROMPT_KEY, VERIFY_PROMPT_EVENT, clearVerifyPrompt } from '@/lib/verifyPrompt'

/**
 * Shown once, right after someone signs up WITH a coupon code: a coupon is only added to the Bonus Balance once the
 * account's email and phone number are both verified, so this lets them do it now (or skip and do it later — the
 * coupon is then applied automatically as soon as they finish). Mounted once in the root layout; renders nothing
 * unless the sign-up flow asked for it.
 */
export default function VerifyCouponPopup() {
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const checking = useRef(false)

  const emailVerified = !!user?.isVerified
  // isPhoneVerified comes from the server; a saved verified phone number is the fallback for older cached data
  const phoneVerified = !!((user as any)?.isPhoneVerified ?? (user as any)?.profile?.phone)
  const allVerified = emailVerified && phoneVerified

  const refreshStatus = useCallback(async () => {
    try {
      const res = await authApi.getMe()
      if (res.data?.data) useAuthStore.getState().setUser(res.data.data)
      return res.data?.data
    } catch { return null } // a failed refresh must never sign anyone out
  }, [])

  // Open when the sign-up flow asked for it (event right after sign-up, or a flag left behind by a reload)
  useEffect(() => {
    const maybeOpen = async () => {
      if (checking.current) return
      let flagged = false
      try { flagged = localStorage.getItem(VERIFY_PROMPT_KEY) === '1' } catch {}
      if (!flagged || !useAuthStore.getState().user) return
      checking.current = true
      const fresh = await refreshStatus()
      checking.current = false
      const u: any = fresh || useAuthStore.getState().user
      const done = !!u?.isVerified && !!(u?.isPhoneVerified ?? u?.profile?.phone)
      if (done) clearVerifyPrompt() // nothing left to verify
      else setOpen(true)
    }
    maybeOpen()
    window.addEventListener(VERIFY_PROMPT_EVENT, maybeOpen)
    return () => window.removeEventListener(VERIFY_PROMPT_EVENT, maybeOpen)
  }, [refreshStatus, user?.id])

  // While open: refresh whenever the player comes back to this tab (e.g. after clicking the link in their email)
  useEffect(() => {
    if (!open) return
    const onFocus = () => { if (document.visibilityState === 'visible') refreshStatus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [open, refreshStatus])

  const close = () => { clearVerifyPrompt(); setOpen(false) }

  const skip = () => {
    close()
    toast("No problem — you can verify any time from your Profile. Your coupon is added as soon as you do.", { icon: '🎟️', duration: 7000 })
  }

  const sendEmail = async () => {
    setSending(true)
    try {
      await authApi.resendVerification()
      setEmailSent(true)
      toast.success('Verification email sent! Please check your inbox and Spam folder.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send verification email.')
    } finally {
      setSending(false)
    }
  }

  const verifyPhone = () => { close(); router.push('/verify') }

  if (!user) return null

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={skip}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog" aria-modal="true" aria-label="Verify your account to receive your coupon"
            className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0f1016] rounded-[24px] border border-white/[0.08] shadow-[0_0_80px_rgba(0,212,255,0.15)]"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[150px] bg-blue-500/10 blur-[100px] pointer-events-none" />

            <div className="relative p-6 sm:p-8 pb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">Bonus</span>
                </h2>
                <p className="text-secondary text-sm sm:text-base font-medium mt-1">Confirm your details to receive your bonus!</p>
              </div>
              <button onClick={skip} aria-label="Close" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-secondary hover:text-white hover:bg-white/[0.08] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative px-6 sm:px-8 pb-6 sm:pb-8 space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:gap-5 items-stretch">
                <StatusCard
                  icon={Phone}
                  verified={phoneVerified}
                  doneLabel="Phone number verified"
                  todoLabel="Confirm phone number"
                  buttonLabel="Verify now"
                  onVerify={verifyPhone}
                />
                <StatusCard
                  icon={Mail}
                  verified={emailVerified}
                  doneLabel="Email address verified"
                  todoLabel="Confirm email address"
                  buttonLabel={emailSent ? 'Resend email' : 'Verify now'}
                  onVerify={sendEmail}
                  loading={sending}
                />
              </div>

              {allVerified ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm text-emerald-300 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 px-4">
                    <ShieldCheck className="w-6 h-6 shrink-0 text-emerald-400" />
                    <span>All verified! Your coupon is being added to your Bonus Balance — you&apos;ll get a notification.</span>
                  </div>
                  <button onClick={close} className="w-full btn-primary py-3.5 text-base rounded-[16px] shadow-[0_0_20px_rgba(0,212,255,0.3)]">Done</button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 text-sm font-medium text-amber-300/95 bg-amber-500/10 py-3 px-4 rounded-xl border border-amber-500/25">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <span><b className="text-amber-200">Note:</b> If your account is not verified, your coupon will not be added to your Bonus Balance.</span>
                  </div>
                  {!emailVerified && (
                    <p className="text-xs text-muted text-center -mt-2">Please check your Spam or Junk folder if you do not see the email.</p>
                  )}
                  <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06] text-sm text-secondary">
                    <ShieldCheck className="w-6 h-6 shrink-0 text-blue-400" />
                    <span>Verify both your phone number and email address to claim your coupon and your 100% signup bonus.</span>
                  </div>
                  <button onClick={skip} className="w-full text-center text-sm font-semibold text-secondary hover:text-white transition-colors py-1">
                    Skip for now
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
