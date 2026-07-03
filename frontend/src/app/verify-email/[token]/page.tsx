'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { authApi } from '@/lib/api'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email address...')
  const params = useParams()
  const token = params.token as string
  const hasVerified = useRef(false)

  useEffect(() => {
    if (!token || hasVerified.current) return
    hasVerified.current = true

    authApi.verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.data?.message || 'Email verified successfully!')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.message || 'Invalid or expired verification link.')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10 glass-card p-8 text-center"
      >
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-white/10 border-t-neon-blue rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-white">Verifying...</h2>
            <p className="text-slate-400">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Verified!</h2>
              <p className="text-slate-400">{message}</p>
            </div>
            <Link href="/login" className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">
              Continue to Login <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
              <p className="text-slate-400">{message}</p>
            </div>
            <Link href="/login" className="btn-secondary w-full py-3 inline-flex items-center justify-center gap-2 border border-white/10 text-white rounded-lg hover:bg-white/5">
              Back to Login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}
