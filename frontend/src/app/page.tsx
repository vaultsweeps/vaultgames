import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSlider from '@/components/home/HeroSlider'
import QuickLinks from '@/components/home/QuickLinks'
import FeaturedGames from '@/components/home/FeaturedGames'
import HomePageClient from '@/components/home/HomePageClient'

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
