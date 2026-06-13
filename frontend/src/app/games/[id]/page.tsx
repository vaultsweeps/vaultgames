'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { Download, Star, ArrowLeft, Gamepad2, Info, Share2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { publicApi, gamesApi } from '@/lib/api'
import Cookies from 'js-cookie'

interface Game {
  id: string
  name: string
  category: string
  version: string
  downloadCount: number
  rating: number
  thumbnailUrl: string | null
  isFeatured: boolean
  description: string
}

export default function GameDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await publicApi.getGameDetails(id as string)
        setGame(res.data.data)
      } catch (err) {
        toast.error('Failed to load game details')
        router.push('/games')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchGame()
  }, [id, router])

  const handleDownload = async () => {
    const token = Cookies.get('nexus_token')
    if (!token) {
      toast.error('Please login to download games')
      router.push('/login')
      return
    }

    setDownloading(true)
    try {
      // Get download URL from backend and register download count
      const res = await gamesApi.download(id as string)
      const downloadUrl = res.data.data?.downloadUrl
      
      if (downloadUrl) {
        // Redirect to actual download link
        window.open(downloadUrl, '_blank')
        toast.success('Download started successfully!')
      } else {
        toast.success('Download registered, but no URL provided.')
      }
      
      // Update local download count
      setGame(prev => prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to download game')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading game details...</div>
      </div>
    </div>
  )

  if (!game) return null

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <Navbar />
      
      <div className="flex-1 pt-24 pb-20 px-4 max-w-6xl mx-auto w-full">
        <Link href="/games" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Image & Quick Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 space-y-6">
            <div className="glass-card overflow-hidden aspect-[4/5] relative flex items-center justify-center bg-gradient-to-br from-blue-900/20 to-purple-900/20">
              <div className="absolute inset-0 cyber-grid opacity-20" />
              {game.thumbnailUrl ? (
                <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover relative z-10" />
              ) : (
                <Gamepad2 className="w-24 h-24 text-slate-600 relative z-10" />
              )}
              {game.isFeatured && (
                <div className="absolute top-4 left-4 z-20 bg-neon-blue/20 border border-neon-blue/40 rounded-full px-3 py-1 text-xs font-mono text-neon-blue backdrop-blur-md">
                  FEATURED
                </div>
              )}
            </div>

            <button 
              onClick={handleDownload} 
              disabled={downloading}
              className="btn-neon w-full py-4 text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {downloading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Preparing Download...</>
              ) : (
                <><Download className="w-5 h-5" /> Download Game</>
              )}
            </button>
          </motion.div>

          {/* Right Column: Details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono px-3 py-1 rounded-full text-purple-400 bg-purple-400/10 border border-purple-400/20">
                  {game.category}
                </span>
                <span className="text-xs font-mono text-slate-500">v{game.version}</span>
              </div>
              <h1 className="font-display font-bold text-4xl sm:text-5xl text-white mb-4">{game.name}</h1>
              
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="font-bold text-lg">{game.rating}</span>
                  <span className="text-slate-500">/ 5.0</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Download className="w-4 h-4" />
                  <span>{game.downloadCount.toLocaleString()} downloads</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-lg font-display font-bold text-white mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-neon-blue" /> About this Game
                </h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {game.description || "No description available for this game."}
                </p>
              </div>
            </div>

            <div className="glass-card p-6 bg-blue-500/5 border-blue-500/20 flex gap-4 items-start">
              <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-medium mb-1">System Requirements</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Downloads are provided in standard executable formats. Make sure your system meets the basic requirements for 3D gaming. A dedicated GPU is highly recommended for optimal performance.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
