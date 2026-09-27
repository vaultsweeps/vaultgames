import { NextRequest, NextResponse } from 'next/server'

// Enforced, nonce-based CSP. Replaces the old static Content-Security-Policy-Report-Only header in
// next.config.js: a nonce has to be generated per REQUEST, which a static header list in next.config.js
// cannot do, so this moved here — Next.js's own documented pattern for nonce-based CSP under the App Router.
//
// Origins allowed below and why (checked against the actual code, not guessed):
//   - Firebase Auth (email/password is local; phone verification uses invisible reCAPTCHA + Google's
//     identity toolkit — frontend/src/app/verify/page.tsx, frontend/src/lib/firebase.ts):
//       script-src:  https://www.gstatic.com, https://www.google.com (recaptcha script)
//       frame-src:   https://www.google.com (recaptcha iframe), https://*.firebaseapp.com (auth popups/redirects)
//       connect-src: https://*.googleapis.com, https://www.google-analytics.com, https://*.firebaseio.com
//   - Supabase Realtime (frontend/src/lib/supabase.ts — chat/withdrawal live updates):
//       connect-src: https://*.supabase.co, wss://*.supabase.co
//   - The API itself (frontend/src/lib/api.ts calls NEXT_PUBLIC_API_URL directly, cross-origin):
//       connect-src: the Render backend + the production custom domain
//   - style-src keeps 'unsafe-inline': framer-motion (used throughout frontend/src/components) sets
//     inline `style="..."` attributes at runtime as its core animation mechanism — a nonce only covers
//     <style> elements, not inline style ATTRIBUTES set via JS, so there is no nonce-based way to keep
//     these working. This is a scoped, investigated exception (CSS cannot execute script), not a shortcut —
//     script-src, the actual XSS vector, does NOT get the same exception.
//   - img-src stays broad (https: + data:): game thumbnails are an admin-typed URL from whatever CDN/blog
//     host the source image happened to be on (14 distinct real hosts today, see AZ-10/next.config.js fix),
//     so there is no fixed list to allowlist here without breaking legitimate, frequently-changing images.

const isProd = process.env.NODE_ENV === 'production'
const API_ORIGINS = ['https://nexsus-c053.onrender.com', 'https://vaultsweeps.com', 'https://www.vaultsweeps.com']

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    // Next.js's own dev-time refresh/eval-based source maps need this; production builds do not.
    ...(isProd ? [] : [`'unsafe-eval'`]),
    'https://www.gstatic.com',
    'https://www.google.com',
  ]

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${API_ORIGINS.join(' ')} https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://www.google-analytics.com https://*.firebaseio.com`,
    `frame-src 'self' https://www.google.com https://*.firebaseapp.com`,
    `frame-ancestors 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    ...(isProd ? [`upgrade-insecure-requests`] : []),
  ].join('; ')

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  // Skip static assets and image-optimizer requests — no HTML is served there, so no CSP/nonce is needed,
  // and generating one per asset request would defeat static-asset caching.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.png|icon.png).*)'],
}
