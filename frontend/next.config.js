/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  images: {
    domains: ['localhost', 'nexus-gaming.com', 'via.placeholder.com'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' }
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'vaultsweeps.vercel.app',
        '*.vercel.app',
        process.env.NEXT_PUBLIC_APP_URL || ''
      ].filter(Boolean)
    }
  },
  env: {
    // In production, fall back to the Render backend if the env var isn't set
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (isProd
      ? 'https://nexsus-c053.onrender.com/api'
      : 'http://localhost:5000/api'),
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Vault Sweeps',
    NEXT_PUBLIC_TELEGRAM_URL: process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/nexusgaming',
    NEXT_PUBLIC_FACEBOOK_URL: process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://m.me/nexusgaming'
  },
  // Optimize for Vercel production builds
  poweredByHeader: false,
}

module.exports = nextConfig
