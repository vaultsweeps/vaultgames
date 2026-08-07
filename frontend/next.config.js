/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  compress: true,
  // Target modern browsers to eliminate legacy JS polyfills
  // This avoids the 'Legacy JavaScript' Lighthouse warning
  ...(isProd && {
    compiler: {
      // Remove console.logs in production
      removeConsole: { exclude: ['error', 'warn'] }
    }
  }),
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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://162.0.214.206:5000/api/:path*' // Proxy to VPS backend
      }
    ]
  },
  // Remove X-Powered-By header for security
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Baseline security headers on every response.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          {
            // Report-Only: browsers log violations to the console but never
            // block anything, so this can't break the app. It's a starting
            // point for eventually graduating to an enforcing policy once
            // violation reports confirm the source list is complete —
            // fonts are self-hosted via next/font, but framer-motion/gsap
            // inline styles and the Next.js runtime bootstrap script need
            // 'unsafe-inline' until this is upgraded to a nonce-based policy.
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
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
        // Private routes - completely block indexing
        source: '/dashboard/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        source: '/login',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        source: '/register',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        source: '/reset-password/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        source: '/forgot-password',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
      {
        // API responses - no caching and no indexing
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
    ]
  },
}

module.exports = nextConfig
