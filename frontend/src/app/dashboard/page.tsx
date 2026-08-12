'use client'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreditCard, ArrowUpCircle, Gamepad2, Gift, HelpCircle, ChevronRight, Clock, CheckCircle, XCircle, Users2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { depositApi, withdrawalApi } from '@/lib/api'

const QUICK_ACTIONS = [
  { href: '/dashboard/deposits',  icon: CreditCard,    label: 'Make Deposit',    desc: 'Add funds',          color: '#00D4FF' },
  { href: '/dashboard/cashouts',  icon: ArrowUpCircle, label: 'Request Cashout', desc: 'Withdraw winnings',   color: '#7B2FFF' },
  { href: '/dashboard/games',     icon: Gamepad2,      label: 'Browse Games',    desc: 'Download & play',    color: '#00FFC8' },
  { href: '/dashboard/bonuses',   icon: Gift,          label: 'Claim Bonus',     desc: 'Promotions',         color: '#FF2D9B' },
  { href: '/dashboard/invite',    icon: Users2,        label: 'Invite & Earn',   desc: 'Earn 50% referral',  color: '#FFD700' },
]

const RECENT_TRANSACTIONS = [
  { id: '1', type: 'deposit', amount: 100, status: 'approved', method: 'Bitcoin', date: '2024-01-15' },
  { id: '2', type: 'cashout', amount: 50, status: 'pending', method: 'Bank Transfer', date: '2024-01-14' },
  { id: '3', type: 'deposit', amount: 200, status: 'approved', method: 'USDT', date: '2024-01-13' },
  { id: '4', type: 'cashout', amount: 75, status: 'paid', method: 'Bank Transfer', date: '2024-01-12' },
]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected',
    paid: 'badge-paid', processing: 'badge-pending', failed: 'badge-rejected'
  }
  return <span className={`${map[status] || 'badge-pending'} text-xs px-2 py-0.5 rounded-full font-mono`}>{status}</span>
}

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
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-10" />
          <div className="absolute right-0 top-0 w-48 h-48 bg-neon-blue/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <p className="text-muted text-xs mb-1">Welcome back,</p>
            <h2 className="font-display font-bold text-xl sm:text-3xl text-white mb-1 truncate max-w-full">{user?.username?.toUpperCase()}</h2>
            <p className="text-secondary text-xs sm:text-sm">Manage your deposits, cashouts, games, and more.</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-display font-bold text-sm text-secondary uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={action.href} className="block glass-card p-3 sm:p-5 hover:border-neon-blue/30 transition-all group hover:-translate-y-1">
                <div className="w-9 h-9 rounded-xl mb-2 sm:mb-3 flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                  <action.icon className="w-4 h-4" style={{ color: action.color }} />
                </div>
                <p className="text-white text-xs sm:text-sm font-medium mb-0.5 leading-tight">{action.label}</p>
                <p className="text-muted text-[10px] sm:text-xs hidden sm:block">{action.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-secondary uppercase tracking-wider">Recent Transactions</h3>
          <div className="flex gap-3">
            <Link href="/dashboard/deposits" className="text-xs text-neon-blue hover:underline">Deposits</Link>
            <Link href="/dashboard/cashouts" className="text-xs text-neon-blue hover:underline">Cashouts</Link>
          </div>
        </div>
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center">
              <Clock className="w-7 h-7 mx-auto mb-2 text-slate-700" />
              <p className="text-muted text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'deposit' ? 'bg-green-500/15' : 'bg-orange-500/15'
                    }`}>
                      {tx.type === 'deposit'
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <ArrowUpCircle className="w-4 h-4 text-orange-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium truncate">{tx.method}</p>
                      <p className="text-muted text-[10px]">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-sm font-bold ${tx.type === 'deposit' ? 'text-green-400' : 'text-orange-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Support CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="https://wa.me/16824829914"
            target="_blank"
            rel="noreferrer"
            className="block glass-card p-4 hover:border-green-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 1.762.466 3.41 1.274 4.845L2 22l5.29-1.26A9.953 9.953 0 0012.004 22C17.523 22 22 17.523 22 12.004 22 6.477 17.523 2 12.004 2zm0 18.009a8 8 0 01-4.085-1.126l-.292-.174-3.14.748.78-3.064-.19-.31A7.979 7.979 0 014 12.004C4 7.582 7.582 4 12.004 4 16.42 4 20 7.582 20 12.004c0 4.422-3.58 8.005-7.996 8.005z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">WhatsApp Support</p>
                <p className="text-muted text-xs">+1 (682) 482-9914 · Fast response</p>
              </div>
            </div>
          </a>
          <Link href="/dashboard/support" className="block glass-card p-4 hover:border-neon-blue/20 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-neon-blue/10 border border-neon-blue/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-5 h-5 text-neon-blue" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">Support Ticket</p>
                <p className="text-muted text-xs">Open a ticket in-app</p>
              </div>
            </div>
          </Link>
          <button onClick={() => {
              const el = document.querySelector('[aria-label="wallet-trigger"]') as HTMLElement;
              if (el) el.click();
            }} className="block glass-card p-4 hover:border-orange-500/20 transition-all group text-left">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <ArrowUpCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">Crypto Withdrawal</p>
                <p className="text-muted text-xs">Manual LTC & TRX Request</p>
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
