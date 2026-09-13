'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, User, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { AuthBackground } from '@/components/auth/AuthBackground'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'

const schema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuthStore()
  const router = useRouter()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password)
      toast.success('Welcome back!')
      router.push('/')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid credentials. Please try again.')
    }
  }

  return (
    <AuthBackground>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
            <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform duration-500" priority />
            <span className="font-display font-bold text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              VAULT SWEEPS
            </span>
          </Link>
          <motion.h1 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="font-display font-bold text-3xl text-white mb-2 tracking-wide"
          >
            WELCOME BACK
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-slate-400 text-sm font-medium"
          >
            Sign in to your account to continue
          </motion.p>
        </div>

        {/* Form card */}
        <AuthCard>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 relative z-10">
            {/* Email or Username */}
            <AuthInput
              {...register('email')}
              type="text"
              label="Email or Username"
              placeholder="your@email.com or username"
              autoComplete="username"
              icon={<User className="w-5 h-5" />}
              error={errors.email?.message}
            />

            {/* Password */}
            <div className="relative">
              <AuthInput
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="••••••••"
                icon={<Lock className="w-5 h-5" />}
                error={errors.password?.message}
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none p-1">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
              />
            </div>

            <div className="flex justify-end pt-1 pb-5">
              <Link href="/forgot-password" className="text-[11px] font-medium tracking-wide text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all">
                FORGOT PASSWORD?
              </Link>
            </div>

            <AuthButton type="submit" isLoading={isLoading} loadingText="SIGNING IN...">
              SIGN IN
            </AuthButton>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center relative z-10">
            <p className="text-slate-400 text-sm font-medium">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all font-bold">
                Create one free
              </Link>
            </p>
          </div>
        </AuthCard>
      </motion.div>
    </AuthBackground>
  )
}
