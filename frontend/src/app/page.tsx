import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSlider from '@/components/home/HeroSlider'
import StatsSection from '@/components/home/StatsSection'
import FeaturedGames from '@/components/home/FeaturedGames'
import HomePageClient from '@/components/home/HomePageClient'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main>
        <HeroSlider />
        <StatsSection />
        <FeaturedGames />
        <Suspense fallback={null}>
          <HomePageClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
