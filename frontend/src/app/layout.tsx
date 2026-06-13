import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'NexusGaming — Premium Gaming Platform',
  description: 'The ultimate gaming destination. Download games, claim bonuses, and join millions of players on NexusGaming.',
  keywords: 'gaming platform, game downloads, esports, online gaming, bonuses',
  openGraph: {
    title: 'NexusGaming',
    description: 'Premium Gaming Platform',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
  themeColor: '#00D4FF',
  icons: { icon: '/favicon.ico' },
  robots: 'index, follow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-dark-900 text-slate-200 antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <div className="scan-line" />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'rgba(10,15,30,0.95)',
                color: '#e2e8f0',
                border: '1px solid rgba(0,212,255,0.2)',
                backdropFilter: 'blur(10px)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#00FF88', secondary: '#030712' } },
              error: { iconTheme: { primary: '#FF4444', secondary: '#030712' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
