'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X } from 'lucide-react'
import { publicApi } from '@/lib/api'

export default function ExpandableContactFab() {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    publicApi.getSettings().then(res => {
      setSettings(res.data?.data || {})
    }).catch(() => {})
  }, [])

  const currentHour = new Date().getHours()
  const isDayShift = currentHour >= 4 && currentHour < 16
  const signalUrl = isDayShift ? settings.signal_day_url : settings.signal_night_url

  const toggleOpen = () => setIsOpen(!isOpen)

  return (
    <div className="relative pointer-events-auto z-50">
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-3">
            {signalUrl && (
              <motion.a 
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                href={signalUrl} target="_blank" rel="noopener noreferrer"
                className="w-11 h-11 bg-gradient-to-br from-[#3a76f0] to-[#2563eb] rounded-full flex items-center justify-center shadow-lg relative border border-white/10 hover:scale-110 transition-transform"
              >
                <svg viewBox="0 0 48 48" className="w-5 h-5 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12a12 12 0 1 0 7.39 21.39l3.14 1.06-1.06-3.14A12 12 0 0 0 24 12z" fill="white"/>
                  <path d="M19 23h10M19 27h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center z-10" style={{ background: signalUrl.includes('Vaulter') ? '#f59e0b' : '#6366f1' }}>
                  {signalUrl.includes('Vaulter') ? 'D' : 'N'}
                </span>
              </motion.a>
            )}
            
            <motion.a 
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              href={settings.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || '#'} target="_blank" rel="noopener noreferrer"
              className="w-11 h-11 bg-[#2EA6E6] rounded-full flex items-center justify-center shadow-lg border border-white/10 hover:scale-110 transition-transform"
            >
              <Send className="w-5 h-5 text-white" />
            </motion.a>

            <motion.a 
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              href={settings.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || '#'} target="_blank" rel="noopener noreferrer"
              className="w-11 h-11 bg-[#0084FF] rounded-full flex items-center justify-center shadow-lg border border-white/10 hover:scale-110 transition-transform"
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </motion.a>
          </div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleOpen}
        className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white shadow-xl shadow-blue-500/30 border border-white/10 active:scale-95 transition-transform"
      >
        <MessageCircle className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90 opacity-0 absolute' : 'rotate-0 opacity-100'}`} />
        <X className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0 absolute'}`} />
      </button>
    </div>
  )
}
