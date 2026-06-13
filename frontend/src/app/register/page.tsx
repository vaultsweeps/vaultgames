'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, Lock, Mail, User, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type RegisterForm = z.infer<typeof schema>

const PERKS = ['Welcome Bonus up to 500%', 'Access 500+ Games', 'Instant Withdrawals', '24/7 Support']

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [registered, setRegistered] = useState(false)
  const { register: registerUser, isLoading } = useAuthStore()
  const router = useRouter()

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({ username: data.username, email: data.email, password: data.password })
      setRegistered(true)
      toast.success('Account created! Please verify your email.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-12 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-white mb-3">ACCOUNT CREATED!</h2>
          <p className="text-slate-400 mb-6">We sent a verification email to your inbox. Please verify to activate your account.</p>
          <Link href="/login" className="btn-primary">Go to Login</Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-neon-blue/10 rounded-full blur-3xl" />

      <div className="w-full max-w-4xl relative z-10 grid lg:grid-cols-2 gap-8 items-center">
        {/* Left - Perks */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-neon-purple rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl gradient-text">NEXUSGAMING</span>
          </Link>
          <h1 className="font-display font-black text-5xl text-white mb-4 leading-tight">JOIN THE<br /><span className="gradient-text">NEXUS</span></h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">Create your free account and start your gaming journey today.</p>
          <div className="space-y-3">
            {PERKS.map((perk, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-neon-blue/20 border border-neon-blue/40 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-neon-blue" />
                </div>
                <span className="text-slate-300 text-sm">{perk}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right - Form */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
          <div className="glass-card p-8">
            <div className="lg:hidden text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-blue to-neon-purple rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold gradient-text">NEXUSGAMING</span>
              </Link>
            </div>
            <h2 className="font-display font-bold text-xl text-white mb-6">CREATE ACCOUNT</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input {...register('username')} type="text" placeholder="coolplayer99" className="input-neon pl-10" />
                </div>
                {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input {...register('email')} type="email" placeholder="you@email.com" className="input-neon pl-10" />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="input-neon pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input {...register('confirmPassword')} type="password" placeholder="••••••••" className="input-neon pl-10" />
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                By creating an account, you agree to our{' '}
                <Link href="#" className="text-neon-blue hover:underline">Terms of Service</Link> and{' '}
                <Link href="#" className="text-neon-blue hover:underline">Privacy Policy</Link>.
              </p>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : 'CREATE FREE ACCOUNT'}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-white/5 text-center">
              <p className="text-slate-500 text-sm">Already have an account? <Link href="/login" className="text-neon-blue hover:underline font-medium">Sign in</Link></p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
