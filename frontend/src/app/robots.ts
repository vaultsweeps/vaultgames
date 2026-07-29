import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/login',
        '/register',
        '/reset-password/',
        '/forgot-password',
        '/verify/',
        '/verify-email/',
        '/api/',
        '/vip',
      ],
    },
    sitemap: 'https://vaultsweeps.com/sitemap.xml',
  }
}
