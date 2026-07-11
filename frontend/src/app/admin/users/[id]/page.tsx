'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminApi } from '@/lib/api'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Gift, AlertCircle, Gamepad2, Ticket } from 'lucide-react'

export default function UserDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  
  // Void Balance state
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidAmount, setVoidAmount] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    if (id) {
      fetchDetails()
    }
  }, [id])

  const fetchDetails = async () => {
    try {
      const res = await adminApi.getUserDetails(id as string)
      if (res.data.success) {
        setData(res.data.data)
      } else {
        toast.error('Failed to load user details')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error loading details')
    } finally {
      setLoading(false)
    }
  }

  const handleVoidBalance = async () => {
    const amount = parseFloat(voidAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount to void')
    if (amount > data.walletBalance) return toast.error('Cannot void more than the current balance')
      
    setVoiding(true)
    try {
      const res = await adminApi.voidUserBalance(id as string, { amount, reason: voidReason })
      if (res.data.success) {
        toast.success(`Successfully voided $${amount.toFixed(2)} from balance`)
        setShowVoidModal(false)
        setVoidAmount('')
        setVoidReason('')
        fetchDetails() // Refresh data
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to void balance')
    } finally {
      setVoiding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!data || !data.user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">User not found</h2>
        <button onClick={() => router.back()} className="text-neon-blue hover:underline">Go Back</button>
      </div>
    )
  }

  const { user, walletBalance, stats } = data

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 glass rounded-lg hover:bg-white/5 transition-colors text-white">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            User Profile: {user.username}
          </h1>
          <p className="text-slate-400 mt-1">Detailed activity and statistics</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-t border-t-neon-blue/30">
          <div className="flex items-center gap-3 text-neon-blue mb-2">
            <Wallet size={20} />
            <h3 className="font-semibold text-sm">Central Wallet</h3>
          </div>
          <p className="text-3xl font-bold text-white">${walletBalance.toFixed(2)}</p>
          <button 
            onClick={() => setShowVoidModal(true)}
            className="mt-3 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-1.5 px-3 rounded transition-colors w-full"
          >
            Void Balance
          </button>
        </div>
        
        <div className="glass-card p-5 border-t border-t-green-500/30">
          <div className="flex items-center gap-3 text-green-400 mb-2">
            <TrendingUp size={20} />
            <h3 className="font-semibold text-sm">Total Deposited</h3>
          </div>
          <p className="text-3xl font-bold text-white">${stats.totalDeposited.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.totalDepositsCount} transactions</p>
        </div>

        <div className="glass-card p-5 border-t border-t-red-500/30">
          <div className="flex items-center gap-3 text-red-400 mb-2">
            <TrendingDown size={20} />
            <h3 className="font-semibold text-sm">Total Cashout</h3>
          </div>
          <p className="text-3xl font-bold text-white">${stats.totalWithdrawn.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.totalWithdrawalsCount} transactions</p>
        </div>

        <div className="glass-card p-5 border-t border-t-purple-500/30">
          <div className="flex items-center gap-3 text-purple-400 mb-2">
            <Gift size={20} />
            <h3 className="font-semibold text-sm">Net Profit (System)</h3>
          </div>
          <p className={`text-3xl font-bold ${stats.netProfit > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {stats.netProfit > 0 ? `-$${Math.abs(stats.netProfit).toFixed(2)}` : `+$${Math.abs(stats.netProfit).toFixed(2)}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">From perspective of the house</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Base Info */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-bold text-white mb-4">Account Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-400">Email</span>
                <span className="text-white">{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-400">Joined</span>
                <span className="text-white">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-400">Role</span>
                <span className="text-white capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-400">Status</span>
                <span className={user.isBanned ? 'text-red-400' : user.isActive ? 'text-green-400' : 'text-yellow-400'}>
                  {user.isBanned ? 'Banned' : user.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>
          </div>

          {/* Connected Games */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Gamepad2 size={18} /> Connected Games</h3>
            {user.providerUsers && user.providerUsers.length > 0 ? (
              <div className="space-y-3">
                {user.providerUsers.map((pu: any) => (
                  <div key={pu.id} className="p-3 bg-white/5 rounded-lg border border-border-subtle">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-white">{pu.provider.name}</span>
                    </div>
                    <div className="text-sm text-slate-400">In-game username: <span className="text-neon-blue">{pu.accountName}</span></div>
                    <div className="text-xs text-slate-500 mt-1 text-right">Added {new Date(pu.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-sm italic">No game accounts connected yet.</div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* History */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg rounded-bl-lg font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 rounded-tr-lg rounded-br-lg font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* Combine and sort deposits and withdrawals */}
                  {[
                    ...(user.deposits?.map((d: any) => ({ ...d, type: 'Deposit' })) || []),
                    ...(user.withdrawals?.map((w: any) => {
                      const isVoid = w.accountInfo === 'Admin Void' || w.adminNotes?.startsWith('Admin Void')
                      return { ...w, type: isVoid ? 'Admin Void' : 'Cashout' }
                    }) || [])
                  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15).map((tx: any) => {
                    const isVoid = tx.type === 'Admin Void'
                    const voidReason = tx.adminNotes?.replace(/^Admin Void:\s*/i, '').trim()
                    return (
                      <tr key={`${tx.type}-${tx.id}`} className={`hover:bg-white/5 transition-colors ${isVoid ? 'bg-orange-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            tx.type === 'Deposit' ? 'bg-green-500/10 text-green-400' :
                            isVoid ? 'bg-orange-500/10 text-orange-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">${tx.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {isVoid ? (
                            <div>
                              <span className="text-orange-400 font-medium text-xs">Admin Void</span>
                              {voidReason && (
                                <p className="text-slate-500 text-xs mt-0.5 italic">"{voidReason}"</p>
                              )}
                            </div>
                          ) : (
                            tx.paymentMethod?.name || tx.accountInfo || 'Unknown'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`capitalize text-xs font-medium ${
                            isVoid ? 'text-orange-400' :
                            tx.status === 'approved' || tx.status === 'paid' ? 'text-green-400' :
                            tx.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                          }`}>
                            {isVoid ? 'Voided' : tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    )
                  })}

                  {(!user.deposits?.length && !user.withdrawals?.length) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bonuses */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Gift size={18} /> Recent Bonuses</h3>
              <div className="space-y-2">
                {user.bonusClaims && user.bonusClaims.length > 0 ? user.bonusClaims.map((claim: any) => (
                  <div key={claim.id} className="p-3 bg-white/5 rounded-lg border border-border-subtle flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold text-white">{claim.bonus?.title || 'Unknown Bonus'}</div>
                      <div className="text-xs text-slate-400">{new Date(claim.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-green-400 font-bold">${claim.amount}</div>
                  </div>
                )) : <div className="text-slate-500 text-sm italic">No bonuses claimed.</div>}
              </div>
            </div>

            {/* Support Tickets */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Ticket size={18} /> Support Tickets</h3>
              <div className="space-y-2">
                {user.tickets && user.tickets.length > 0 ? user.tickets.map((ticket: any) => (
                  <div key={ticket.id} className="p-3 bg-white/5 rounded-lg border border-border-subtle">
                    <div className="text-sm font-semibold text-white truncate" title={ticket.subject}>{ticket.subject}</div>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        ticket.status === 'open' ? 'bg-yellow-500/20 text-yellow-400' : 
                        ticket.status === 'closed' || ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : <div className="text-slate-500 text-sm italic">No tickets opened.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Void Balance Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#15192b] border border-border-subtle rounded-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Void User Balance
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Amount to Deduct ($)</label>
                <input 
                  type="number" 
                  value={voidAmount}
                  onChange={(e) => setVoidAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black/50 border border-border-subtle rounded-lg px-3 py-2 text-white outline-none focus:border-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">Current balance: ${data.walletBalance.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Reason / Notes (Optional)</label>
                <input 
                  type="text" 
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Fraudulent deposit reversal"
                  className="w-full bg-black/50 border border-border-subtle rounded-lg px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border-subtle bg-white/5 flex gap-2 justify-end">
              <button 
                onClick={() => setShowVoidModal(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                disabled={voiding}
              >
                Cancel
              </button>
              <button 
                onClick={handleVoidBalance}
                disabled={voiding || !voidAmount}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {voiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
