'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, Lock, Mail, User, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/lib/api'
import { AuthBackground } from '@/components/auth/AuthBackground'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  couponCode: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type RegisterForm = z.infer<typeof schema>

const PERKS = ['Welcome Bonus up to 100%', 'Access 500+ Games', 'Instant Withdrawals', '24/7 Support']

// Username criteria list shown under the field
const CRITERIA = [
  { id: 'length',    label: '3 to 20 characters',                test: (v: string) => v.length >= 3 && v.length <= 20 },
  { id: 'chars',     label: 'Letters, numbers, underscores only', test: (v: string) => /^[a-zA-Z0-9_]+$/.test(v) },
  { id: 'noSpaces',  label: 'No spaces or special characters',    test: (v: string) => !/\s/.test(v) },
  { id: 'startChar', label: 'Starts with a letter or number',     test: (v: string) => /^[a-zA-Z0-9]/.test(v) },
]

type AvailStatus = 'idle' | 'checking' | 'available' | 'taken'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [usernameVal, setUsernameVal] = useState('')
  const [availStatus, setAvailStatus] = useState<AvailStatus>('idle')
  const [availReason, setAvailReason] = useState('')
  const { register: registerUser, isLoading } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref') || undefined
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({ resolver: zodResolver(schema) })
  const watchedUsername = watch('username', '')

  // Debounced availability check
  useEffect(() => {
    const val = (watchedUsername || '').trim()
    setUsernameVal(val)

    if (!val || val.length < 3 || !/^[a-zA-Z0-9_]+$/.test(val)) {
      setAvailStatus('idle')
      setAvailReason('')
      return
    }

    setAvailStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/auth/check-username?username=${encodeURIComponent(val)}`)
        if (res.data.available) {
          setAvailStatus('available')
          setAvailReason('')
        } else {
          setAvailStatus('taken')
          setAvailReason(res.data.reason || 'Username is not available.')
        }
      } catch {
        setAvailStatus('idle')
      }
    }, 600)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [watchedUsername])

  const onSubmit = async (data: RegisterForm) => {
    if (availStatus === 'taken') {
      toast.error('Please choose a different username.')
      return
    }
    try {
      await registerUser({ username: data.username, email: data.email, password: data.password, referralCode, couponCode: data.couponCode })
      setRegistered(true)
      toast.success('Account created! Please verify your email.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-12 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-white mb-3">ACCOUNT CREATED!</h2>
          <p className="text-secondary mb-6">We sent a verification email to your inbox. Please verify to activate your account.</p>
          <Link href="/login" className="btn-primary">Go to Login</Link>
        </motion.div>
      </div>
    )
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-6xl relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left - Perks & Branding */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
            <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform duration-500" priority />
            <span className="font-display font-bold text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              VAULT SWEEPS
            </span>
          </Link>
          <h1 className="font-display font-black text-5xl text-white mb-6 leading-tight tracking-tight drop-shadow-md">
            JOIN THE<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">PREMIUM VAULT</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed font-medium max-w-md">
            Create your free account to access an exclusive, high-end gaming experience with unparalleled rewards.
          </p>
          <div className="space-y-5">
            {PERKS.map((perk, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i + 0.3 }} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                </div>
                <span className="text-slate-300 text-[15px] font-medium tracking-wide">{perk}</span>
              </motion.div>
            ))}
          </div>

          {/* Username rules info box (Premium HUD style) */}
          <div className="mt-12 rounded-[24px] bg-[#0a0f1c]/60 backdrop-blur-md p-7 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            <p className="text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-widest mb-5 flex items-center gap-2">
              <Zap className="w-4 h-4" /> SYSTEM REQUIREMENTS
            </p>
            <ul className="space-y-3.5">
              {CRITERIA.map(c => (
                <li key={c.id} className="flex items-center gap-3 text-[11px] font-mono tracking-wide text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                  {c.label}
                </li>
              ))}
              <li className="flex items-center gap-3 text-[11px] font-mono tracking-wide text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                Must be unique across the platform
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Right - Form */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          <AuthCard>
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-3 mb-2 group">
                <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-10 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform" priority />
                <span className="font-display font-bold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                  VAULT SWEEPS
                </span>
              </Link>
            </div>
            
            <h2 className="font-display font-bold text-2xl text-white mb-8 tracking-wide drop-shadow-md">CREATE ACCOUNT</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 relative z-10">
              {/* Username field */}
              <div className="relative">
                <AuthInput
                  {...register('username')}
                  type="text"
                  label="Username"
                  placeholder="coolplayer99"
                  icon={<User className="w-5 h-5" />}
                  error={(!availReason && errors.username) ? errors.username.message : undefined}
                  className={`
                    ${availStatus === 'available' ? '!border-emerald-500/50 focus:!border-emerald-500/50 !shadow-[0_0_15px_rgba(16,185,129,0.1)]' : ''}
                    ${availStatus === 'taken' ? '!border-red-500/50 focus:!border-red-500/50 !shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
                  `}
                  rightElement={
                    availStatus === 'checking' ? <Loader2 className="w-5 h-5 animate-spin text-cyan-400" /> :
                    availStatus === 'available' ? <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> :
                    availStatus === 'taken' ? <XCircle className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> : undefined
                  }
                />

                {/* Availability message */}
                <AnimatePresence mode="wait">
                  {availStatus === 'available' && (
                    <motion.p key="avail" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-emerald-400 text-[11px] font-medium mt-[-4px] mb-4 flex items-center gap-1.5 ml-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Username is available!
                    </motion.p>
                  )}
                  {availStatus === 'taken' && (
                    <motion.p key="taken" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-red-400 text-[11px] font-medium mt-[-4px] mb-4 flex items-center gap-1.5 ml-1">
                      <XCircle className="w-3.5 h-3.5" /> {availReason}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Live criteria checklist — show when typing on mobile (since desktop has it on left) */}
                {usernameVal.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="lg:hidden mt-2 mb-4 p-5 bg-[#0a0f1c]/80 rounded-[20px] border border-white/5 space-y-2.5">
                    {CRITERIA.map(c => {
                      const pass = c.test(usernameVal)
                      return (
                        <div key={c.id} className={`flex items-center gap-3 text-[10px] font-mono tracking-wide transition-colors ${pass ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {pass ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-700 flex-shrink-0" />}
                          {c.label}
                        </div>
                      )
                    })}
                    <div className={`flex items-center gap-3 text-[10px] font-mono tracking-wide transition-colors ${
                      availStatus === 'available' ? 'text-emerald-400' : availStatus === 'taken' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {availStatus === 'available' ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : availStatus === 'taken' ? <XCircle className="w-3 h-3 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-700 flex-shrink-0" />}
                      Unique across platform
                    </div>
                  </motion.div>
                )}
              </div>

              <AuthInput
                {...register('email')}
                type="email"
                label="Email Address"
                placeholder="you@email.com"
                icon={<Mail className="w-5 h-5" />}
                error={errors.email?.message}
              />

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

              <AuthInput
                {...register('confirmPassword')}
                type="password"
                label="Confirm Password"
                placeholder="••••••••"
                icon={<Lock className="w-5 h-5" />}
                error={errors.confirmPassword?.message}
              />

              <AuthInput
                {...register('couponCode')}
                type="text"
                label="Coupon Code (Optional)"
                placeholder="ENTER PROMO CODE"
                icon={<Zap className="w-5 h-5" />}
                error={errors.couponCode?.message}
                className="uppercase placeholder:normal-case"
              />

              <div className="pt-3 pb-7">
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  By creating an account, you agree to our{' '}
                  <Link href="#" className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all">Terms of Service</Link> and{' '}
                  <Link href="#" className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all">Privacy Policy</Link>.
                </p>
              </div>

              <AuthButton
                type="submit"
                disabled={isLoading || availStatus === 'taken' || availStatus === 'checking'}
                isLoading={isLoading || availStatus === 'checking'}
                loadingText={isLoading ? "CREATING ACCOUNT..." : "CHECKING USERNAME..."}
              >
                CREATE FREE ACCOUNT
              </AuthButton>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center relative z-10">
              <p className="text-slate-400 text-sm font-medium">
                Already have an account?{' '}
                <Link href="/login" className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all font-bold">
                  Sign in
                </Link>
              </p>
            </div>
          </AuthCard>
        </motion.div>
      </div>
    </AuthBackground>
  )
}
