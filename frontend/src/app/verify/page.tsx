'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { X, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function VerifyPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (user === null) {
      router.push('/login')
    }
  }, [user, router])

  const handleVerifyEmail = async () => {
    if (user?.isVerified) {
      toast.success('Your email is already verified!')
      router.push('/games')
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

  const handleVerifyPhone = () => {
    toast.error('Phone verification is currently unavailable. Please verify using email.')
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-surface-elevated rounded-2xl border border-border-subtle shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-border-subtle relative">
          <button 
            onClick={() => router.push('/')}
            className="absolute right-6 top-6 text-secondary hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Bonus</h1>
          <p className="text-secondary">
            Confirm your phone number and email address to receive your bonus! <br/>
            <span className="text-sm text-yellow-500/80 mt-1 inline-block">Note: Please check your Spam or Junk folder if you do not see the email.</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Confirm your details</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Phone Card */}
            <button 
              onClick={handleVerifyPhone}
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

          <button 
            onClick={handleVerifyEmail}
            disabled={isSending}
            className="w-full py-4 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors"
          >
            Redeem bonus
          </button>
        </div>
      </motion.div>
    </div>
  )
}
