'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import apiClient from '@/lib/api'
import toast from 'react-hot-toast'
import PremiumWheel from '@/components/wheel/PremiumWheel'

export default function WheelPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/wheel/status')
      if (res.data.success) {
        setStatus(res.data.data)
      }
    } catch (error: any) {
      toast.error('Failed to load wheel status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 border border-white/10 shadow-2xl p-8 lg:p-12">
        {/* Abstract Background Rays */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          background: 'repeating-conic-gradient(from 0deg, transparent 0deg 15deg, #ffffff 15deg 30deg)'
        }} />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          
          {/* Left Content */}
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <div>
              <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight drop-shadow-lg mb-4">
                SPIN THE <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">WHEEL</span>
              </h1>
              <p className="text-lg text-slate-300 max-w-md mx-auto lg:mx-0">
                Get prizes every day in the win-win lottery wheel of luck! Win cash bonuses and percentage matches on your recent deposits.
              </p>
            </div>

            {/* Eligibility Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/10 shadow-inner inline-block text-left"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {status?.hasMetDepositGoal ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                  )}
                  <span className={`text-sm ${status?.hasMetDepositGoal ? 'text-slate-200' : 'text-slate-400'}`}>
                    You have made deposits of $50+ within 24 hours 
                    <span className="block text-xs text-sky-400">Current: ${status?.depositTotal?.toFixed(2) || '0.00'}</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  {!status?.nextSpinTime ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-500 shrink-0" />
                  )}
                  <span className={`text-sm ${!status?.nextSpinTime ? 'text-slate-200' : 'text-slate-400'}`}>
                    {!status?.nextSpinTime ? (
                      "You haven't spun the wheel in 48 hours"
                    ) : (
                      <>
                        Available again on:<br />
                        <span className="text-sky-400 font-medium">
                          {new Date(status.nextSpinTime).toLocaleString()}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Content - The Wheel */}
          <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center">
             <PremiumWheel 
               prizes={status?.prizes || []} 
               canSpin={status?.canSpin} 
               onSpinComplete={fetchStatus}
             />
          </div>

        </div>
      </div>
    </div>
  )
}
