import { MetadataRoute } from 'next'

const BASE_URL = 'https://vaultsweeps.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://nexsus-c053.onrender.com/api' : 'http://localhost:5000/api')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Base static routes - strictly public marketing pages
  const routes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/games`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/bonuses`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/cashout-rules`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Try to fetch games for dynamic sitemap generation
  try {
    const res = await fetch(`${API_URL}/public/games/featured`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      if (data && data.data && Array.isArray(data.data)) {
        const gameRoutes: MetadataRoute.Sitemap = data.data.map((game: any) => ({
          url: `${BASE_URL}/games/${game.id}`,
          lastModified: new Date(), // using current date as fallback
          changeFrequency: 'weekly',
          priority: 0.7,
        }))
        routes.push(...gameRoutes)
      }
    }
  } catch (error) {
    console.error('Failed to fetch games for sitemap:', error)
  }

  return routes
}
