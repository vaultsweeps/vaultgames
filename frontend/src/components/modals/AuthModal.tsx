'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register'
}

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password is required'),
})

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  telegramUsername: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  couponCode: z.string().optional(),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) })
})

export default function AuthModal({ isOpen, onClose, initialView = 'login' }: AuthModalProps) {
  // Track the view using a ref so we can set it synchronously before render
  const [view, setView] = useState<'login' | 'register'>(initialView)
  const [showPassword, setShowPassword] = useState(false)
  const { login, register: registerUser, isLoading } = useAuthStore()

  // Declare forms FIRST, before any useEffect that calls them
  const { register: registerLogin, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors }, reset: resetLogin } = useForm({ resolver: zodResolver(loginSchema) })
  const { register: registerReg, handleSubmit: handleRegSubmit, formState: { errors: regErrors }, reset: resetReg } = useForm({ resolver: zodResolver(registerSchema) })

  // Sync view with initialView prop whenever modal opens
  // This MUST come after form declarations so reset functions are available
  useEffect(() => {
    if (isOpen) {
      setView(initialView)
      resetLogin()
      resetReg()
      setShowPassword(false)
    }
  }, [isOpen, initialView]) // eslint-disable-line react-hooks/exhaustive-deps

  const onLogin = async (data: any) => {
    try {
      await login(data.email, data.password)
      toast.success('Welcome back!')
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid credentials. Please try again.')
    }
  }

  const onRegister = async (data: any) => {
    try {
      await registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
        couponCode: data.couponCode,
      })
      await login(data.email, data.password)
      toast.success('Registration successful! Welcome to Vault Sweeps!')
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  const switchView = (newView: 'login' | 'register') => {
    setView(newView)
    resetLogin()
    resetReg()
    setShowPassword(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#1C1C24] border border-border-strong rounded-2xl w-full max-w-md overflow-hidden relative z-10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-2">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{view === 'login' ? 'Sign In' : 'Sign Up'}</h2>
                <p className="text-secondary text-sm">
                  {view === 'login' ? 'Welcome back! Please enter your details.' : 'Fill in the fields below and join Vault Sweeps!'}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface hover:bg-surface-elevated flex items-center justify-center text-secondary hover:text-white transition-colors self-start -mt-2 -mr-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 pt-4">
              <AnimatePresence mode="wait">
                {view === 'login' ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    onSubmit={handleLoginSubmit(onLogin)}
                    className="space-y-4"
                  >
                    <div>
                      <div className="relative">
                        <input {...registerLogin('email')} type="text" placeholder="Email or Username" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all" />
                      </div>
                      {loginErrors.email && <p className="text-red-400 text-xs mt-1 px-1">{loginErrors.email.message as string}</p>}
                    </div>

                    <div>
                      <div className="relative">
                        <input {...registerLogin('password')} type={showPassword ? 'text' : 'password'} placeholder="Password" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all pr-12" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {loginErrors.password && <p className="text-red-400 text-xs mt-1 px-1">{loginErrors.password.message as string}</p>}
                    </div>

                    <div className="flex justify-end">
                      <a href="#" className="text-xs text-neon-blue hover:underline">Forgot password?</a>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full bg-[#4CA3FF] hover:bg-[#3B8BE6] text-white font-bold py-3.5 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    onSubmit={handleRegSubmit(onRegister)}
                    className="space-y-4"
                  >
                    <div>
                      <input {...registerReg('email')} type="email" placeholder="Email" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all" />
                      {regErrors.email && <p className="text-red-400 text-xs mt-1 px-1">{regErrors.email.message as string}</p>}
                    </div>

                    <div>
                      <input {...registerReg('username')} type="text" placeholder="Username" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all" />
                      {regErrors.username && <p className="text-red-400 text-xs mt-1 px-1">{regErrors.username.message as string}</p>}
                    </div>

                    <div>
                      <input {...registerReg('telegramUsername')} type="text" placeholder="Telegram Username (Optional)" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all" />
                      {regErrors.telegramUsername && <p className="text-red-400 text-xs mt-1 px-1">{regErrors.telegramUsername.message as string}</p>}
                    </div>

                    <div>
                      <div className="relative">
                        <input {...registerReg('password')} type={showPassword ? 'text' : 'password'} placeholder="Password" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all pr-12" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {regErrors.password && <p className="text-red-400 text-xs mt-1 px-1">{regErrors.password.message as string}</p>}
                    </div>

                    <div>
                      <input {...registerReg('couponCode')} type="text" placeholder="Coupon Code (Optional)" className="w-full bg-[#13131A] border border-transparent focus:border-neon-blue/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-muted focus:outline-none transition-all uppercase" />
                      {regErrors.couponCode && <p className="text-red-400 text-xs mt-1 px-1">{regErrors.couponCode.message as string}</p>}
                    </div>

                    <label className="flex items-start gap-3 mt-4 mb-4 cursor-pointer">
                      <div className="relative flex items-center pt-0.5">
                        <input {...registerReg('terms')} type="checkbox" className="peer w-5 h-5 appearance-none rounded bg-[#13131A] border border-border-strong checked:bg-neon-blue checked:border-neon-blue transition-colors cursor-pointer" />
                        <svg className="absolute w-3 h-3 top-1.5 left-1 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-xs text-secondary leading-snug">
                        I confirm that I have read and fully agree with <a href="#" className="text-[#00D4FF] hover:underline">Conditions of the Vault Sweeps website User Agreement</a>
                      </span>
                    </label>
                    {regErrors.terms && <p className="text-red-400 text-xs -mt-2 px-1 mb-2">{regErrors.terms.message as string}</p>}

                    <button type="submit" disabled={isLoading} className="w-full bg-[#4CA3FF] hover:bg-[#3B8BE6] text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign Up'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="mt-6 text-center text-sm text-secondary">
                {view === 'login' ? (
                  <>Don't have an account? <button onClick={() => switchView('register')} className="text-[#00D4FF] font-bold hover:underline">Sign Up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => switchView('login')} className="text-[#00D4FF] font-bold hover:underline">Sign In</button></>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
