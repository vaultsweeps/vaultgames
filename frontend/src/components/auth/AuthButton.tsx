import { ButtonHTMLAttributes, ReactNode } from 'react'

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  children: ReactNode
}

export function AuthButton({ isLoading, loadingText = 'Processing...', children, className = '', disabled, ...props }: AuthButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        relative w-full h-[52px] rounded-xl font-display font-bold tracking-widest text-sm uppercase overflow-hidden
        transition-all duration-300 active:scale-[0.98] group
        disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
        ${className}
      `}
      {...props}
    >
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #9333ea 100%)',
        }}
      />
      {/* Hover Light Sweep */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #a855f7 100%)',
        }}
      />
      
      {/* Inner highlights & shadows for realistic button depth */}
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: 'inset 0 1.5px 1px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)' }} />
      <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center gap-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shadow-sm" />
            <span className="opacity-90">{loadingText}</span>
          </>
        ) : children}
      </div>
    </button>
  )
}
