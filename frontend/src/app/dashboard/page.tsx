'use client'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreditCard, ArrowUpCircle, Gamepad2, Gift, HelpCircle, ChevronRight, Clock, Users2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { depositApi, withdrawalApi } from '@/lib/api'
import { Card, cardClass, cn, IconTile, SectionHeading, Skeleton, StatusBadge, EmptyState, TONES, type Tone } from '@/components/dashboard/ui'

const QUICK_ACTIONS: { href: string; icon: typeof CreditCard; label: string; desc: string; tone: Tone }[] = [
  { href: '/dashboard/deposits',  icon: CreditCard,    label: 'Make Deposit',    desc: 'Add funds',          tone: 'cyan' },
  { href: '/dashboard/cashouts',  icon: ArrowUpCircle, label: 'Request Cashout', desc: 'Withdraw winnings',  tone: 'purple' },
  { href: '/dashboard/games',     icon: Gamepad2,      label: 'Browse Games',    desc: 'Download & play',    tone: 'green' },
  { href: '/dashboard/bonuses',   icon: Gift,          label: 'Claim Bonus',     desc: 'Promotions',         tone: 'pink' },
  { href: '/dashboard/invite',    icon: Users2,        label: 'Invite & Earn',   desc: 'Earn 50% referral',  tone: 'gold' },
]

function WhatsAppIcon({ size = 22, style }: { size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 1.762.466 3.41 1.274 4.845L2 22l5.29-1.26A9.953 9.953 0 0012.004 22C17.523 22 22 17.523 22 12.004 22 6.477 17.523 2 12.004 2zm0 18.009a8 8 0 01-4.085-1.126l-.292-.174-3.14.748.78-3.064-.19-.31A7.979 7.979 0 014 12.004C4 7.582 7.582 4 12.004 4 16.42 4 20 7.582 20 12.004c0 4.422-3.58 8.005-7.996 8.005z"/>
    </svg>
  )
}

// Lucide icons vs the shared IconTile prop type (propTypes invariance on size/strokeWidth). Remove once ui.tsx accepts LucideIcon.
const asIcon = (i: unknown): any => i

const linkPill = 'inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-semibold text-sky-400 transition-all hover:brightness-125 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'
const linkPillStyle = { background: TONES.cyan.bg, boxShadow: `inset 0 0 0 1px ${TONES.cyan.ring}` }

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Run all independent data fetches in parallel, avoiding waterfall
        // Using allSettled ensures one failure doesn't crash everything else
        const results = await Promise.allSettled([
          depositApi.getAll({ limit: 5 }),
          withdrawalApi.getAll({ limit: 5 })
        ]);

        if (!mounted) return;

        let deps: any[] = [];
        let withs: any[] = [];

        // Safely extract deposit data if successful
        if (results[0].status === 'fulfilled' && results[0].value.data?.data) {
          deps = results[0].value.data.data.map((d: any) => ({
            id: d.id,
            type: 'deposit',
            amount: d.amount,
            status: d.status,
            method: d.paymentMethod?.name || 'Unknown',
            date: new Date(d.createdAt).toISOString().split('T')[0],
            timestamp: new Date(d.createdAt).getTime()
          }));
        }

        // Safely extract withdrawal data if successful
        if (results[1].status === 'fulfilled' && results[1].value.data?.data) {
          withs = results[1].value.data.data.map((w: any) => ({
            id: w.id,
            type: 'cashout',
            amount: w.amount,
            status: w.status,
            method: w.paymentMethod?.name || 'Unknown',
            date: new Date(w.createdAt).toISOString().split('T')[0],
            timestamp: new Date(w.createdAt).getTime()
          }));
        }

        const combined = [...deps, ...withs]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5);

        setTransactions(combined);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }

    return () => { mounted = false; };
  }, [user]);

  return (
    <div className="space-y-8 pb-6">
      {/* Welcome */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="ds-card relative overflow-hidden p-5 sm:p-8"
      >
        <div aria-hidden className="absolute -top-20 -right-12 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 70%)' }} />
        <div aria-hidden className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)' }} />
        <div className="relative min-w-0">
          <p className="text-[14px] sm:text-[15px] font-medium text-secondary mb-2">Welcome back,</p>
          <h2 className="font-brand font-bold text-2xl min-[400px]:text-[28px] sm:text-4xl tracking-wide text-primary leading-tight truncate max-w-full" title={user?.username}>
            {user?.username?.toUpperCase()}
          </h2>
          <div className="mt-4 h-[3px] w-12 rounded-full" style={{ background: 'var(--ds-accent)' }} />
          <p className="mt-4 text-[14px] sm:text-[15px] text-secondary leading-relaxed">Manage your deposits, cashouts, games, and more.</p>
        </div>
      </motion.section>

      {/* Quick Actions */}
      <section>
        <SectionHeading title="Quick Actions" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {QUICK_ACTIONS.map((action, i) => {
            const t = TONES[action.tone]
            const isLast = i === QUICK_ACTIONS.length - 1
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn('min-w-0', isLast && 'max-sm:col-span-2')}>
                <Link
                  href={action.href}
                  className={cn(
                    cardClass({ interactive: true, padded: false }),
                    'group h-full flex flex-col gap-3.5 p-4 sm:p-5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                    isLast && 'max-sm:flex-row max-sm:items-center max-sm:gap-4'
                  )}
                  style={{ backgroundImage: `radial-gradient(140px 90px at 0% 0%, ${t.bg}, transparent 75%)` }}
                >
                  <IconTile icon={asIcon(action.icon)} tone={action.tone} size="md" className="transition-transform duration-200 group-hover:scale-105" />
                  <div className="min-w-0">
                    <p className="text-[15px] sm:text-base font-semibold text-primary leading-snug">{action.label}</p>
                    <p className="mt-0.5 text-[13px] text-secondary leading-snug">{action.desc}</p>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Recent Transactions */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <SectionHeading
          className="flex-wrap"
          title="Recent Transactions"
          action={
            <div className="flex items-center gap-2">
              <Link href="/dashboard/deposits" className={linkPill} style={linkPillStyle}>Deposits</Link>
              <Link href="/dashboard/cashouts" className={linkPill} style={linkPillStyle}>Cashouts</Link>
            </div>
          }
        />
        <Card padded={false} className="overflow-hidden">
          {loading ? (
            <div className="p-4 sm:p-5 space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-[60px]" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState icon={asIcon(Clock)} title="No transactions yet" text="Your deposits and cashouts will show up here." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <IconTile
                      icon={asIcon(tx.type === 'deposit' ? CreditCard : ArrowUpCircle)}
                      tone={tx.type === 'deposit' ? 'green' : 'orange'}
                      size="sm"
                      className="!rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-primary truncate">{tx.method}</p>
                      <p className="text-[13px] text-muted mt-0.5 truncate">
                        {tx.type === 'deposit' ? 'Deposit' : 'Cashout'} · {tx.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className={`text-[15px] font-bold tabular-nums leading-none ${tx.type === 'deposit' ? 'text-green-400' : 'text-orange-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.section>

      {/* Support CTA */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <SectionHeading title="Need help?" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <a
            href="https://wa.me/16824829914"
            target="_blank"
            rel="noreferrer"
            className={cn(cardClass({ interactive: true, padded: false }), 'group h-full flex items-center gap-3.5 p-4 sm:p-5 active:scale-[0.97]')}
          >
            <IconTile icon={WhatsAppIcon} tone="green" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-primary leading-snug">WhatsApp Support</p>
              <p className="text-[13px] text-secondary mt-0.5 leading-snug">+1 (682) 482-9914 · Fast response</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
          </a>
          <Link href="/dashboard/support" className={cn(cardClass({ interactive: true, padded: false }), 'group h-full flex items-center gap-3.5 p-4 sm:p-5 active:scale-[0.97]')}>
            <IconTile icon={asIcon(HelpCircle)} tone="cyan" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-primary leading-snug">Support Ticket</p>
              <p className="text-[13px] text-secondary mt-0.5 leading-snug">Open a ticket in-app</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button onClick={() => {
              const el = document.querySelector('[aria-label="wallet-trigger"]') as HTMLElement;
              if (el) el.click();
            }} className={cn(cardClass({ interactive: true, padded: false }), 'group h-full w-full flex items-center gap-3.5 p-4 sm:p-5 text-left active:scale-[0.97]')}>
            <IconTile icon={asIcon(ArrowUpCircle)} tone="orange" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-primary leading-snug">Crypto Withdrawal</p>
              <p className="text-[13px] text-secondary mt-0.5 leading-snug">Manual LTC & TRX Request</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.section>
    </div>
  )
}
