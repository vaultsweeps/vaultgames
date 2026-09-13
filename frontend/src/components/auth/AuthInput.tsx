import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  rightElement?: ReactNode
  error?: string
  label: string
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ icon, rightElement, error, label, className = '', ...props }, ref) => {
    return (
      <div className="mb-5 group">
        <label className="block text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2 ml-1">
          {label}
        </label>
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-300 pointer-events-none z-10">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full h-[52px] bg-[#0a0e17] text-white rounded-xl text-sm
              border border-slate-700/50 
              focus:outline-none focus:border-cyan-500/50 focus:bg-[#0c121e] focus:shadow-[0_0_20px_rgba(34,211,238,0.08)]
              transition-all duration-300
              placeholder:text-slate-600 font-medium
              ${icon ? 'pl-12' : 'pl-4'}
              ${rightElement ? 'pr-12' : 'pr-4'}
              ${error ? '!border-red-500/50 focus:!border-red-500/50 !shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}
              ${className}
            `}
            style={{
              boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.4)',
            }}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors duration-200 z-10">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-red-400 text-[11px] mt-1.5 ml-1 flex items-center gap-1.5 font-medium">
            <span className="w-1 h-1 rounded-full bg-red-400" />
            {error}
          </p>
        )}
      </div>
    )
  }
)
AuthInput.displayName = 'AuthInput'
