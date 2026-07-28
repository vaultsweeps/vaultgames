import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import dynamic from 'next/dynamic'
import HeroSlider from '@/components/home/HeroSlider'
import QuickLinks from '@/components/home/QuickLinks'
import FeaturedGames from '@/components/home/FeaturedGames'

// Lazy-load heavy below-the-fold components to reduce initial JS bundle
const HomePageClient = dynamic(() => import('@/components/home/HomePageClient'))
const Footer = dynamic(() => import('@/components/layout/Footer'))

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-12">
        <HeroSlider />
        <QuickLinks />
        <FeaturedGames />
        <Suspense fallback={null}>
          <HomePageClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
