'use client'
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { HelpCircle } from 'lucide-react'

export default function FrustrationDetector() {
  const clickTimes = useRef<number[]>([])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const now = Date.now()
      clickTimes.current.push(now)
      
      // Keep only clicks within the last 3 seconds
      clickTimes.current = clickTimes.current.filter(t => now - t < 3000)

      // If user clicks 5 or more times in 3 seconds, they are frustrated
      if (clickTimes.current.length >= 5) {
        // Prevent multiple toasts showing up at the same time
        toast.dismiss('frustration-toast')
        
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[#11111A] shadow-[0_0_40px_rgba(0,212,255,0.15)] rounded-2xl pointer-events-auto flex flex-col sm:flex-row ring-1 ring-[#00D4FF]/40 border border-[#00D4FF]/30 overflow-hidden relative group`}>
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00D4FF]/10 via-transparent to-transparent opacity-50" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00D4FF] to-[#7B2FFF]" />
            
            <div className="flex-1 p-5 sm:p-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-[#00D4FF]/10 flex items-center justify-center ring-2 ring-[#00D4FF]/20 group-hover:scale-110 group-hover:bg-[#00D4FF]/20 transition-all duration-300">
                    <HelpCircle className="h-6 w-6 text-[#00D4FF]" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white font-display tracking-wide flex items-center gap-2">
                    Need Help? 
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4FF]"></span>
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm text-secondary leading-relaxed">
                    It seems you might be stuck. Our support team is online <span className="text-[#00D4FF] font-medium">24/7</span> and ready to assist you right away!
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex sm:flex-col border-t sm:border-t-0 sm:border-l border-border-strong bg-[#0B0B11] sm:w-32 relative z-10">
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  window.open(process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/vaultsweeps', '_blank')
                }}
                className="w-full flex-1 flex flex-row sm:flex-col items-center justify-center gap-1.5 sm:gap-1 text-sm font-bold text-[#00D4FF] hover:text-white hover:bg-[#00D4FF]/10 transition-colors border-r sm:border-r-0 sm:border-b border-border-strong py-4 sm:py-0"
              >
                <span>Live Chat</span>
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full flex-1 flex items-center justify-center text-sm font-bold text-muted hover:text-white hover:bg-white/5 transition-colors py-4 sm:py-0"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 10000, id: 'frustration-toast', position: 'bottom-center' })
        
        // Clear queue to prevent spam
        clickTimes.current = []
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
