'use client'
import { useAuthStore } from '@/store/authStore'
import { getTelegramUrl } from '@/lib/telegram'
import { getSmsUrl } from '@/lib/sms'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, MessageCircle, Send, Zap, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Game {
  id: string
  name: string
  [key: string]: any
}

export default function PlayWithAgentModal({
  game,
  onClose,
  settings,
}: {
  game: Game
  onClose: () => void
  settings: any
}) {
  const telegramUrl = getTelegramUrl(settings?.telegram_url || process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/vaultsweeps", useAuthStore.getState().user)
  const messengerUrl = settings?.facebook_url || process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://m.me/vaultsweeps'
  const [smsUrl, setSmsUrl] = useState('')

  useEffect(() => {
    setSmsUrl(getSmsUrl())
  }, [])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-background border border-border-subtle rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 to-cyan-900/20" />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Play with Agent</h2>
                  <p className="text-secondary text-sm">{game.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-secondary hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 pt-2 space-y-5">
            <div className="bg-surface rounded-2xl p-4 border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-white text-sm font-semibold">How it works</p>
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                This game is played directly with one of our live agents. Contact us via <span className="text-white font-medium">SMS</span>, <span className="text-white font-medium">Telegram</span> or <span className="text-white font-medium">Messenger</span>, mention the game name, and an agent will set up your session immediately.
              </p>
            </div>

            <p className="text-center text-xs text-muted">Choose your preferred platform to get started:</p>

            {/* SMS */}
            {smsUrl && (
              <a
                href={`${smsUrl}?body=I%20want%20to%20play%20${encodeURIComponent(game.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl border border-[#4ade80]/20 bg-[#4ade80]/5 hover:bg-[#4ade80]/10 hover:border-[#4ade80]/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform relative overflow-hidden bg-[#4ade80]/20">
                  <MessageSquare className="w-6 h-6 text-[#4ade80] relative z-10" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">SMS Us</p>
                  </div>
                  <p className="text-secondary text-xs">Fastest response · Usually &lt; 2 min</p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                  ⚡ Fastest
                </span>
              </a>
            )}

            {/* Telegram */}
            <a
              href={`${telegramUrl}?text=I%20want%20to%20play%20${encodeURIComponent(game.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-2xl border border-[#2AABEE]/20 bg-[#2AABEE]/5 hover:bg-[#2AABEE]/10 hover:border-[#2AABEE]/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#2AABEE]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Send className="w-6 h-6 text-[#2AABEE]" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Telegram</p>
                <p className="text-secondary text-xs">Usually &lt; 5 min</p>
              </div>
            </a>

            {/* Messenger */}
            <a
              href={`${messengerUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-2xl border border-[#1877F2]/20 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 hover:border-[#1877F2]/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#1877F2]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-[#1877F2]" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Facebook Messenger</p>
                <p className="text-secondary text-xs">Chat with a live agent on Messenger</p>
              </div>
            </a>

            <button
              onClick={onClose}
              className="w-full glass rounded-2xl py-3 text-secondary hover:text-white border border-border-strong transition-all text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
