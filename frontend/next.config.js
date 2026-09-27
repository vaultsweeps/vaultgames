/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
    // No remote host is allowlisted for the optimizer: game thumbnails are an admin-typed URL from whatever
    // CDN/blog host the source image happened to be on (verified against the live catalogue — 14 distinct
    // hosts today, e.g. wp-content blogs, S3, postimg, image proxies — with no fixed set, since admins add
    // games regularly). Those are rendered with `unoptimized` instead (see FeaturedGames.tsx, games/[id] and
    // dashboard/games), so they still display from any host; only the previous wildcard, which let anyone use
    // /_next/image?url=<any https URL> as a free image proxy, is removed.
    remotePatterns: [
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
        process.env.NEXT_PUBLIC_APP_URL || ''
      ].filter(Boolean)
    },
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
  env: {
    // In production, fall back to the real backend (VPS behind api.vaultsweeps.com) if the env var isn't set
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (isProd
      ? 'https://api.vaultsweeps.com/api'
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
        // Baseline security headers on every response.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Sensors the site never uses stay off, even if injected content asks for them
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), bluetooth=(), serial=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // The enforced, nonce-based Content-Security-Policy is set in src/middleware.ts instead of here —
          // a nonce must be generated per REQUEST, which this static header list cannot do.
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
        // Private API responses — never cache. Public routes are handled separately
        // by the backend's Cache-Control headers set in routes/public.ts.
        source: '/api/((?!public/).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ],
      },
    ]
  },
}

module.exports = nextConfig
