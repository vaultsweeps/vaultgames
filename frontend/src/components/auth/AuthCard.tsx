import { ReactNode } from 'react'

export function AuthCard({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div
      className={`relative w-full rounded-[2rem] p-8 sm:p-10 lg:p-12 ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(3, 7, 18, 0.98) 100%)',
        boxShadow: `
          inset 0 1px 1px rgba(255, 255, 255, 0.1),
          inset 0 0 60px rgba(139, 92, 246, 0.03),
          0 20px 40px rgba(0, 0, 0, 0.6),
          0 1px 3px rgba(0, 0, 0, 0.3)
        `,
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      {/* Subtle top reflection simulating an acrylic edge */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-[2rem]"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)' }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
