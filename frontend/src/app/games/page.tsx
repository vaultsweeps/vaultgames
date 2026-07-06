// src/app/games/page.tsx
'use client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import FeaturedGames from '@/components/home/FeaturedGames'
import { motion } from 'framer-motion'

export default function GamesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-8 px-4 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <p className="font-mono text-xs tracking-[0.3em] text-neon-blue uppercase mb-3">Library</p>
          <h1 className="font-display font-bold text-5xl text-white">GAMES <span className="gradient-text">CATALOG</span></h1>
          <p className="text-secondary mt-3 max-w-xl mx-auto">Browse and download our complete collection of premium games.</p>
        </motion.div>
      </div>
      <FeaturedGames />
      <Footer />
    </div>
  )
}
