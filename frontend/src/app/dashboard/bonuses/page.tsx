'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Clock, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusesApi } from '@/lib/api'
import { Card, PageHeader, Button, Badge, IconTile, EmptyState, Skeleton, GiftIcon, TONES, type Tone } from '@/components/dashboard/ui'

const TYPE_BADGE: Record<string, { label: string; tone: Tone }> = {
  welcome: { label: 'Welcome', tone: 'gold' },
  deposit: { label: 'Deposit', tone: 'cyan' },
  referral: { label: 'Referral', tone: 'green' },
  vip: { label: 'VIP', tone: 'purple' },
  seasonal: { label: 'Seasonal', tone: 'orange' },
  cashback: { label: 'Cashback', tone: 'blue' },
}

// Gold that stays readable on both dark and light surfaces.
const GOLD_TEXT = 'color-mix(in srgb, #F59E0B 80%, var(--text-primary))'

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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
      <span className="text-secondary">{label}</span>
      <span className="font-semibold text-primary tabular-nums">{value}</span>
    </div>
  )
}

function BonusCard({ bonus }: { bonus: Bonus }) {
  const [expanded, setExpanded] = useState(false)

  const badge = TYPE_BADGE[bonus.type] || { label: bonus.type.charAt(0).toUpperCase() + bonus.type.slice(1), tone: 'slate' as Tone }
  const isWelcome = bonus.type === 'welcome'

  const hasFigure = bonus.percentage != null || (bonus.amount != null && !bonus.percentage)
  const figureLabel = bonus.percentage != null
    ? (isWelcome ? 'match of your deposit' : bonus.maxBonus != null ? `match up to $${bonus.maxBonus}` : 'bonus')
    : bonus.maxBonus != null ? `bonus up to $${bonus.maxBonus}` : 'bonus credit'

  const hasMeta = bonus.minDeposit != null || bonus.maxBonus != null || !!bonus.expiresAt

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <Card className="relative overflow-hidden h-full flex flex-col !p-5 sm:!p-6">
        {isWelcome && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
            style={{ background: 'radial-gradient(120% 70% at 100% 0%, rgba(251,191,36,0.13) 0%, transparent 60%)' }} />
        )}

        <div className="relative flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3">
            {isWelcome
              ? <div className="w-16 h-16 -mt-1 -ml-1 flex-shrink-0"><GiftIcon /></div>
              : <IconTile icon={Gift} tone="gold" size="md" />}
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>

          <h3 className="mt-4 text-[17px] sm:text-lg font-semibold text-primary leading-snug break-words">{bonus.title}</h3>

          <div className="mt-3">
            {hasFigure ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: GOLD_TEXT }}>
                  {bonus.percentage != null ? `${bonus.percentage}%` : `$${bonus.amount}`}
                </span>
                <span className="text-[13px] text-secondary">{figureLabel}</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[26px] font-bold leading-none text-muted">CUSTOM</span>
                {bonus.maxBonus != null && <span className="text-[13px] text-secondary">up to ${bonus.maxBonus}</span>}
              </div>
            )}
          </div>

          {bonus.description && (
            <p className="mt-3 text-secondary text-[14px] leading-relaxed">{bonus.description}</p>
          )}

          {hasMeta && (
            <div className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-border-subtle">
              {bonus.minDeposit != null && <MetaRow label="Min. deposit" value={`$${bonus.minDeposit}`} />}
              {bonus.maxBonus != null && <MetaRow label="Max bonus" value={isWelcome ? 'Same as your deposit' : `$${bonus.maxBonus}`} />}
              {bonus.expiresAt && (
                <div className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="inline-flex items-center gap-1.5 text-secondary">
                    <Clock className="w-4 h-4" style={{ color: TONES.orange.fg }} /> Expires
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: TONES.orange.fg }}>
                    {new Date(bonus.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {(bonus.requirements || bonus.terms) && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="mt-3 -mx-1 px-1 min-h-[40px] w-[calc(100%+8px)] flex items-center justify-between gap-2 rounded-xl text-[13px] font-medium text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              >
                <span>{expanded ? 'Hide' : 'Show'} Terms &amp; Requirements</span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 overflow-hidden">
                  {bonus.requirements && (
                    <div className="rounded-2xl bg-surface-elevated border border-border-subtle p-3.5">
                      <p className="text-[13px] font-semibold text-primary mb-1">Requirements</p>
                      <p className="text-secondary text-[13px] leading-relaxed break-words">{bonus.requirements}</p>
                    </div>
                  )}
                  {bonus.terms && (
                    <div className="rounded-2xl bg-surface-elevated border border-border-subtle p-3.5">
                      <p className="text-[13px] font-semibold text-primary mb-1">Terms &amp; Conditions</p>
                      <p className="text-secondary text-[13px] leading-relaxed break-words">{bonus.terms}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          <div className="mt-auto pt-5">
            <div
              className="w-full h-11 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 cursor-default select-none"
              style={{ background: TONES.green.bg, color: TONES.green.fg, boxShadow: `inset 0 0 0 1px ${TONES.green.ring}` }}
            >
              <Check className="w-4 h-4" /> System Auto-Applied
            </div>
          </div>
        </div>
      </Card>
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
    <div>
      <PageHeader
        title="Bonuses"
        subtitle="Claim exclusive bonuses and boost your gaming experience."
        actions={
          <Button variant="secondary" size="sm" onClick={fetchBonuses}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" aria-busy="true">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="!p-5 sm:!p-6 h-[340px]">
              <div className="flex items-start justify-between">
                <Skeleton className="w-11 h-11" />
                <Skeleton className="w-20 h-6 !rounded-full" />
              </div>
              <Skeleton className="mt-5 h-5 w-2/3" />
              <Skeleton className="mt-4 h-9 w-1/3" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-6 h-11 w-full" />
            </Card>
          ))}
        </div>
      ) : bonuses.length === 0 ? (
        <Card>
          <EmptyState icon={Gift} title="No active bonuses" text="No active bonuses at the moment. Check back soon!" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {bonuses.map(bonus => (
            <BonusCard key={bonus.id} bonus={bonus} />
          ))}
        </div>
      )}
    </div>
  )
}
