import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import NavigationLoader from '@/components/ui/NavigationLoader'
import FrustrationDetector from '@/components/ui/FrustrationDetector'
import { Orbitron, Inter, JetBrains_Mono } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-orbitron', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'Vault Sweeps — Premium Gaming Platform',
  description: 'The ultimate gaming destination. Download games, claim bonuses, and join millions of players on Vault Sweeps.',
  keywords: 'gaming platform, game downloads, esports, online gaming, bonuses',
  openGraph: {
    title: 'Vault Sweeps',
    description: 'Premium Gaming Platform',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/favicon.png', sizes: '180x180', type: 'image/png' },
    shortcut: '/favicon.ico',
  },
  robots: 'index, follow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`bg-background text-primary antialiased transition-colors duration-300 ${orbitron.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
        <ThemeProvider>
          {/* Global navigation progress loader — shown on every route change */}
          <Suspense fallback={null}>
            <NavigationLoader />
          </Suspense>
          <FrustrationDetector />
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
