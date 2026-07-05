'use client'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreditCard, ArrowUpCircle, Gamepad2, Gift, HelpCircle, ChevronRight, Clock, CheckCircle, XCircle, Users2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { depositApi, withdrawalApi } from '@/lib/api'

const QUICK_ACTIONS = [
  { href: '/dashboard/deposits', icon: CreditCard, label: 'Make Deposit', desc: 'Add funds to your account', color: '#00D4FF' },
  { href: '/dashboard/cashouts', icon: ArrowUpCircle, label: 'Request Cashout', desc: 'Withdraw your winnings', color: '#7B2FFF' },
  { href: '/dashboard/games', icon: Gamepad2, label: 'Browse Games', desc: 'Download & play games', color: '#00FFC8' },
  { href: '/dashboard/bonuses', icon: Gift, label: 'Claim Bonus', desc: 'Available promotions', color: '#FF2D9B' },
  { href: '/dashboard/invite', icon: Users2, label: 'Invite & Earn', desc: 'Refer friends, earn 50%', color: '#FFD700' },
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
    const fetchTransactions = async () => {
      try {
        const [depRes, withRes] = await Promise.all([
          depositApi.getAll({ limit: 5 }),
          withdrawalApi.getAll({ limit: 5 })
        ])
        
        const deps = (depRes.data?.data || []).map((d: any) => ({
          id: d.id,
          type: 'deposit',
          amount: d.amount,
          status: d.status,
          method: d.paymentMethod?.name || 'Unknown',
          date: new Date(d.createdAt).toISOString().split('T')[0],
          timestamp: new Date(d.createdAt).getTime()
        }))
        
        const withs = (withRes.data?.data || []).map((w: any) => ({
          id: w.id,
          type: 'cashout',
          amount: w.amount,
          status: w.status,
          method: w.paymentMethod?.name || 'Unknown',
          date: new Date(w.createdAt).toISOString().split('T')[0],
          timestamp: new Date(w.createdAt).getTime()
        }))
        
        const combined = [...deps, ...withs]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5)
          
        setTransactions(combined)
      } catch (err) {
        console.error('Failed to fetch transactions', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTransactions()
  }, [])

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-10" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <p className="text-slate-500 text-sm mb-1">Welcome back,</p>
            <h2 className="font-display font-bold text-3xl text-white mb-2">{user?.username?.toUpperCase()}</h2>
            <p className="text-slate-400 text-sm">Manage your deposits, cashouts, games, and more from your dashboard.</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-display font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={action.href} className="block glass-card p-5 hover:border-neon-blue/30 transition-all group hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <p className="text-white text-sm font-medium mb-1">{action.label}</p>
                <p className="text-slate-500 text-xs">{action.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-slate-400 uppercase tracking-wider">Recent Transactions</h3>
          <div className="flex gap-3">
            <Link href="/dashboard/deposits" className="text-xs text-neon-blue hover:underline">Deposits</Link>
            <Link href="/dashboard/cashouts" className="text-xs text-neon-blue hover:underline">Cashouts</Link>
          </div>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td><div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div></td>
                      <td><div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div></td>
                      <td><div className="h-4 w-24 bg-slate-800 rounded animate-pulse"></div></td>
                      <td><div className="h-5 w-16 bg-slate-800 rounded-full animate-pulse"></div></td>
                      <td><div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div></td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-slate-500">No recent transactions.</td></tr>
                ) : transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`text-xs font-mono ${tx.type === 'deposit' ? 'text-green-400' : 'text-orange-400'}`}>
                        {tx.type === 'deposit' ? '+ DEPOSIT' : '- CASHOUT'}
                      </span>
                    </td>
                    <td className="text-white font-medium">${tx.amount.toFixed(2)}</td>
                    <td>{tx.method}</td>
                    <td><StatusBadge status={tx.status} /></td>
                    <td className="text-xs text-slate-600">{tx.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {RECENT_TRANSACTIONS.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No transactions yet</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Support CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Link href="/dashboard/support" className="block glass-card p-5 hover:border-neon-blue/20 transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-neon-blue/10 border border-neon-blue/20 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-neon-blue" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Need Help?</p>
                <p className="text-slate-500 text-xs">Open a support ticket or contact us directly</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-neon-blue transition-colors" />
          </div>
        </Link>
      </motion.div>
    </div>
  )
}
