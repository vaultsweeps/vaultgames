/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  compress: true,
  images: {
    // Serve WebP/AVIF automatically to supported browsers
    formats: ['image/avif', 'image/webp'],
    // Responsive sizes for common breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: ['localhost', 'nexus-gaming.com', 'via.placeholder.com'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' }
    ],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'vaultsweeps.vercel.app',
        '*.vercel.app',
        process.env.NEXT_PUBLIC_APP_URL || ''
      ].filter(Boolean)
    },
    optimizePackageImports: ['lucide-react', 'framer-motion'],
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
  // Remove X-Powered-By header for security
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      {
        // API responses - no caching
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' }
        ],
      },
    ]
  },
}

module.exports = nextConfig
