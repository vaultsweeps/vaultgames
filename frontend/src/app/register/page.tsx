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

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
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
      await registerUser({ username: data.username, email: data.email, password: data.password, referralCode })
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-neon-blue/10 rounded-full blur-3xl" />

      <div className="w-full max-w-4xl relative z-10 grid lg:grid-cols-2 gap-8 items-center">
        {/* Left - Perks */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-10 w-auto object-contain drop-shadow-md" priority />
            <span className="font-display font-bold text-xl gradient-text">VAULT SWEEPS</span>
          </Link>
          <h1 className="font-display font-black text-5xl text-white mb-4 leading-tight">JOIN THE<br /><span className="gradient-text">VAULT SWEEPS</span></h1>
          <p className="text-secondary text-lg mb-8 leading-relaxed">Create your free account and start your gaming journey today.</p>
          <div className="space-y-3">
            {PERKS.map((perk, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-neon-blue/20 border border-neon-blue/40 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-neon-blue" />
                </div>
                <span className="text-secondary text-sm">{perk}</span>
              </motion.div>
            ))}
          </div>

          {/* Username rules info box */}
          <div className="mt-10 glass-card p-5 border border-neon-blue/10">
            <p className="text-neon-blue text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> Username Rules
            </p>
            <ul className="space-y-2">
              {CRITERIA.map(c => (
                <li key={c.id} className="flex items-center gap-2 text-xs text-secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-blue/50" />
                  {c.label}
                </li>
              ))}
              <li className="flex items-center gap-2 text-xs text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue/50" />
                Must be unique — not already used on this platform or in the game
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Right - Form */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
          <div className="glass-card p-8">
            <div className="lg:hidden text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-2 mb-2">
                <Image src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" width={551} height={488} className="h-10 w-auto object-contain drop-shadow-md" priority />
                <span className="font-display font-bold gradient-text">VAULT SWEEPS</span>
              </Link>
            </div>
            <h2 className="font-display font-bold text-xl text-white mb-6">CREATE ACCOUNT</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Username field */}
              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    {...register('username')}
                    type="text"
                    placeholder="coolplayer99"
                    className={`input-neon pl-10 pr-10 transition-all ${
                      availStatus === 'available' ? 'border-emerald-500/50 focus:border-emerald-500' :
                      availStatus === 'taken' ? 'border-red-500/50 focus:border-red-500' : ''
                    }`}
                  />
                  {/* Status icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {availStatus === 'checking' && <Loader2 className="w-4 h-4 text-secondary animate-spin" />}
                    {availStatus === 'available' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {availStatus === 'taken' && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>

                {/* Availability message */}
                <AnimatePresence mode="wait">
                  {availStatus === 'available' && (
                    <motion.p key="avail" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Username is available!
                    </motion.p>
                  )}
                  {availStatus === 'taken' && (
                    <motion.p key="taken" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> {availReason}
                    </motion.p>
                  )}
                </AnimatePresence>

                {errors.username && !availReason && (
                  <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
                )}

                {/* Live criteria checklist — show when typing */}
                {usernameVal.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 p-3 bg-white/3 rounded-xl border border-border-subtle space-y-1.5">
                    {CRITERIA.map(c => {
                      const pass = c.test(usernameVal)
                      return (
                        <div key={c.id} className={`flex items-center gap-2 text-[11px] transition-colors ${pass ? 'text-emerald-400' : 'text-muted'}`}>
                          {pass
                            ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                            : <div className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0" />}
                          {c.label}
                        </div>
                      )
                    })}
                    <div className={`flex items-center gap-2 text-[11px] transition-colors ${
                      availStatus === 'available' ? 'text-emerald-400' : availStatus === 'taken' ? 'text-red-400' : 'text-muted'
                    }`}>
                      {availStatus === 'available'
                        ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        : availStatus === 'taken'
                          ? <XCircle className="w-3 h-3 flex-shrink-0" />
                          : <div className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0" />}
                      Unique — not taken on platform or in game
                    </div>
                  </motion.div>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input {...register('email')} type="email" placeholder="you@email.com" className="input-neon" style={{ paddingLeft: '2.5rem' }} />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="input-neon" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-secondary uppercase mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input {...register('confirmPassword')} type="password" placeholder="••••••••" className="input-neon" style={{ paddingLeft: '2.5rem' }} />
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                By creating an account, you agree to our{' '}
                <Link href="#" className="text-neon-blue hover:underline">Terms of Service</Link> and{' '}
                <Link href="#" className="text-neon-blue hover:underline">Privacy Policy</Link>.
              </p>

              <button
                type="submit"
                disabled={isLoading || availStatus === 'taken' || availStatus === 'checking'}
                className="btn-primary w-full py-3 text-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : availStatus === 'checking' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking username...
                  </span>
                ) : 'CREATE FREE ACCOUNT'}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-border-subtle text-center">
              <p className="text-muted text-sm">Already have an account? <Link href="/login" className="text-neon-blue hover:underline font-medium">Sign in</Link></p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
