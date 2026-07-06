'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft } from 'lucide-react'
import { authApi } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true)
    try {
      await authApi.forgotPassword(data.email)
      setIsSent(true)
      toast.success('Reset link sent!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send reset email.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 mb-4 group text-secondary hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to login</span>
          </Link>
          <h1 className="font-display font-bold text-3xl text-white mb-2">FORGOT PASSWORD</h1>
          <p className="text-secondary text-sm">Enter your email to receive a reset link</p>
        </div>

        <div className="glass-card p-8">
          {isSent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-white text-xl font-bold">Check your inbox</h2>
              <p className="text-secondary text-sm">
                We've sent password reset instructions to your email address.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="your@email.com"
                    className="input-neon pl-10"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : 'SEND RESET LINK'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
