import { ReactNode } from 'react'

export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050914] relative overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-cyan-500/30">
      {/* Deep atmospheric radial lights */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />
      
      {/* Subtle overlay texture (optional, minimal grid/grain) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-[0.03] pointer-events-none" />

      {/* Floating subtle light motes (CSS-based for performance) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-cyan-400/20 rounded-full blur-[2px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[60%] right-[20%] w-3 h-3 bg-purple-400/20 rounded-full blur-[3px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-[25%] left-[30%] w-1.5 h-1.5 bg-blue-400/20 rounded-full blur-[1px] animate-pulse" style={{ animationDuration: '3s' }} />
      </div>

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
