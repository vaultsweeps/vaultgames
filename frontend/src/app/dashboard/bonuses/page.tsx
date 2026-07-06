'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Clock, Check, ChevronDown, ChevronUp, Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusesApi } from '@/lib/api'

const COLORS = ['#00D4FF', '#7B2FFF', '#00FFC8', '#FF2D9B', '#FFD700', '#00FF88']
const TYPE_BADGE: Record<string, string> = {
  welcome: 'NEW PLAYER',
  deposit: 'DEPOSIT BONUS',
  referral: 'REFER & EARN',
  vip: 'EXCLUSIVE',
  seasonal: 'LIMITED TIME',
  cashback: 'DAILY CASHBACK',
}

interface Bonus {
  id: string
  type: string
  title: string
  description: string
  percentage: number | null
  amount: number | null
  maxBonus: number | null
  minDeposit: number | null
  requirements: string | null
  terms: string | null
  isActive: boolean
  expiresAt: string | null
}

function BonusCard({ bonus, color }: { bonus: Bonus; color: string }) {
  const [expanded, setExpanded] = useState(false)

  const badge = TYPE_BADGE[bonus.type] || bonus.type.toUpperCase()
  const isVip = bonus.type === 'vip'

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
              {badge}
            </span>
            <h3 className="font-display font-bold text-lg text-white mt-2">{bonus.title}</h3>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            {bonus.percentage != null && (
              <div className="font-display font-black text-3xl" style={{ color }}>{bonus.percentage}%</div>
            )}
            {bonus.amount != null && !bonus.percentage && (
              <div className="font-display font-black text-3xl" style={{ color }}>${bonus.amount}</div>
            )}
            {!bonus.percentage && !bonus.amount && (
              <div className="font-display font-black text-2xl text-muted">CUSTOM</div>
            )}
            {bonus.maxBonus != null && (
              <div className="text-xs text-muted">up to ${bonus.maxBonus}</div>
            )}
          </div>
        </div>

        {bonus.description && (
          <p className="text-secondary text-sm leading-relaxed mb-4">{bonus.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {bonus.minDeposit != null && (
            <div className="glass rounded-lg p-3">
              <p className="text-xs text-muted mb-1">Min. Deposit</p>
              <p className="text-white text-sm font-medium">${bonus.minDeposit}</p>
            </div>
          )}
          {bonus.maxBonus != null && (
            <div className="glass rounded-lg p-3">
              <p className="text-xs text-muted mb-1">Max Bonus</p>
              <p className="text-white text-sm font-medium">${bonus.maxBonus}</p>
            </div>
          )}
        </div>

        {bonus.expiresAt && (
          <div className="flex items-center gap-2 text-xs text-orange-400 mb-4">
            <Clock className="w-3 h-3" /> Expires: {new Date(bonus.expiresAt).toLocaleDateString()}
          </div>
        )}

        {(bonus.requirements || bonus.terms) && (
          <>
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors mb-3 w-full">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide' : 'Show'} Terms & Requirements
            </button>

            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 space-y-2">
                {bonus.requirements && (
                  <div className="glass rounded-lg p-3">
                    <p className="text-xs font-mono text-neon-blue uppercase tracking-wider mb-1">Requirements</p>
                    <p className="text-secondary text-xs">{bonus.requirements}</p>
                  </div>
                )}
                {bonus.terms && (
                  <div className="glass rounded-lg p-3">
                    <p className="text-xs font-mono text-neon-blue uppercase tracking-wider mb-1">Terms & Conditions</p>
                    <p className="text-secondary text-xs">{bonus.terms}</p>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}

        <div className="w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 cursor-default mt-4">
          <Check className="w-4 h-4" /> System Auto-Applied
        </div>
      </div>
    </motion.div>
  )
}

export default function BonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)
  const fetchBonuses = async () => {
    setLoading(true)
    try {
      const res = await bonusesApi.getAll()
      setBonuses(res.data.data || [])
    } catch {
      toast.error('Failed to load bonuses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBonuses() }, [])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">BONUSES & PROMOTIONS</h2>
          <p className="text-secondary text-sm mt-1">Claim exclusive bonuses and boost your gaming experience.</p>
        </div>
        <button onClick={fetchBonuses} className="glass border border-border-strong rounded-xl px-3 py-2 text-secondary hover:text-white transition-all flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card p-6 h-64 animate-pulse">
              <div className="h-3 w-20 bg-white/10 rounded mb-4" />
              <div className="h-5 w-40 bg-white/10 rounded mb-3" />
              <div className="h-16 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : bonuses.length === 0 ? (
        <div className="glass-card py-20 text-center">
          <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-muted">No active bonuses at the moment. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {bonuses.map((bonus, i) => (
              <BonusCard
                key={bonus.id}
                bonus={bonus}
                color={COLORS[i % COLORS.length]}
              />
          ))}
        </div>
      )}
    </div>
  )
}
