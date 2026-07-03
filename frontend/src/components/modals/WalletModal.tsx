import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ManualCashoutModal from './ManualCashoutModal'
import ZappayDepositModal from './ZappayDepositModal'
import { depositApi, withdrawalApi } from '@/lib/api'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  balance: number
}

const paymentMethods = [
  { id: 'zappay', name: 'Zappay', icon: 'Z', badge: 'Active', color: 'bg-indigo-500' },
  { id: 'crypto', name: 'Cryptocurrency', icon: '₿', badge: '+15%', tag: '+5', color: 'bg-orange-500', soon: true },
  { id: 'chime', name: 'Chime', icon: 'C', badge: 'No fee', color: 'bg-emerald-500', soon: true },
  { id: 'cashapp', name: 'CashApp Pay', icon: '$', badge: 'No fee', color: 'bg-green-500', soon: true },
  { id: 'paypal', name: 'PayPal', icon: 'P', badge: 'No fee', color: 'bg-blue-500', soon: true },
  { id: 'apple', name: 'Apple Pay', icon: '', badge: '-5%', color: 'bg-slate-100 text-black', soon: true },
  { id: 'google', name: 'Google Pay', icon: 'G', badge: '-5%', color: 'bg-white text-black', soon: true },
  { id: 'card', name: 'Debit Card', icon: '💳', badge: '-10%', color: 'bg-blue-600', soon: true },
]

type TxItem = {
  id: string
  kind: 'deposit' | 'cashout'
  method: string
  amount: number
  status: string
  rejectionReason?: string | null
  date: string
}

const METHOD_COLOR: Record<string, string> = {
  chime: 'bg-emerald-500', cashapp: 'bg-green-500', paypal: 'bg-blue-500',
  zappay: 'bg-indigo-500', crypto: 'bg-orange-500', default: 'bg-slate-500'
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'text-emerald-400', success: 'text-emerald-400',
  pending: 'text-amber-400', processing: 'text-amber-400',
  rejected: 'text-red-400', canceled: 'text-red-400',
  closed: 'text-red-400', failed: 'text-red-400'
}

function TxRow({ tx }: { tx: TxItem }) {
  const [expanded, setExpanded] = useState(false)
  const isRejected = ['rejected', 'canceled', 'closed', 'failed'].includes(tx.status.toLowerCase())
  const methodKey = tx.method.toLowerCase().replace(' ', '')
  const color = METHOD_COLOR[methodKey] || METHOD_COLOR.default
  const initial = tx.method.charAt(0).toUpperCase()
  const dateStr = new Date(tx.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`border-b border-white/5 last:border-0 ${isRejected && tx.rejectionReason ? 'cursor-pointer' : ''}`}
      onClick={() => isRejected && tx.rejectionReason && setExpanded(p => !p)}>
      <div className="flex items-center gap-3 py-3 px-1">
        <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center font-bold text-white text-sm flex-shrink-0`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white text-sm font-medium truncate">{tx.method}</p>
            {tx.kind === 'deposit'
              ? <ArrowDownLeft className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              : <ArrowUpRight className="w-3 h-3 text-amber-400 flex-shrink-0" />}
          </div>
          <p className="text-slate-500 text-xs">{dateStr}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold text-sm">${tx.amount.toFixed(2)}</p>
          <p className={`text-xs capitalize font-medium flex items-center gap-1 justify-end ${STATUS_COLOR[tx.status.toLowerCase()] || 'text-slate-400'}`}>
            {isRejected && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
          </p>
        </div>
        {isRejected && tx.rejectionReason && (
          <div className="flex-shrink-0 text-slate-600">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        )}
      </div>
      {expanded && tx.rejectionReason && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="mx-1 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-xs font-semibold mb-0.5">Reason for rejection</p>
              <p className="text-red-300/80 text-xs">{tx.rejectionReason}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default function WalletModal({ isOpen, onClose, balance }: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'cashout' | 'history'>('deposit')
  const [cashoutMethod, setCashoutMethod] = useState<'chime' | 'cashapp' | null>(null)
  const [depositMethod, setDepositMethod] = useState<'zappay' | null>(null)
  const [history, setHistory] = useState<TxItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Single source-of-truth for body scroll lock
  useEffect(() => {
    const anyOpen = isOpen || cashoutMethod !== null || depositMethod !== null
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen, cashoutMethod, depositMethod])

  // Fetch history when History tab is opened
  useEffect(() => {
    if (activeTab !== 'history' || !isOpen) return
    setHistoryLoading(true)
    Promise.all([
      depositApi.getAll({ limit: 10 }).then(r => (r.data.data || []).map((d: any): TxItem => ({
        id: d.id, kind: 'deposit',
        method: d.paymentMethod?.name || d.currency || 'Deposit',
        amount: d.amount, status: d.status,
        rejectionReason: d.rejectionReason || null,
        date: d.createdAt
      }))).catch(() => [] as TxItem[]),
      withdrawalApi.getAll({ limit: 10 }).then(r => (r.data.data || []).map((w: any): TxItem => ({
        id: w.id, kind: 'cashout',
        method: w.paymentMethodStr || 'Cashout',
        amount: w.amount, status: w.status,
        rejectionReason: w.rejectionReason || null,
        date: w.createdAt
      }))).catch(() => [] as TxItem[])
    ]).then(([deposits, cashouts]) => {
      const combined = [...deposits, ...cashouts].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setHistory(combined)
    }).finally(() => setHistoryLoading(false))
  }, [activeTab, isOpen])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="wallet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0F1219] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 pb-0 flex justify-between items-center relative">
                <h2 className="text-white font-bold text-xl">Wallet</h2>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <p className="text-slate-400 text-xs absolute top-12 left-5 max-w-[250px]">
                  Deposit and cash out your funds in your wallet
                </p>
              </div>

              <div className="p-5 flex-1 overflow-y-auto mt-6">
                {/* Balance Card */}
                <div className="bg-[#1A1E29] rounded-2xl p-6 flex flex-col items-center justify-center mb-6 shadow-inner border border-white/5">
                  <p className="text-slate-400 text-sm mb-1">Balance</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[#2AC3FF] font-bold text-3xl">$</span>
                    <span className="text-white font-black text-4xl">{balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex justify-between border-b border-white/5 mb-5 px-4">
                  {['deposit', 'cashout', 'history'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`pb-3 px-2 capitalize text-sm font-bold transition-colors relative ${
                        activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="px-2 pb-4">
                  {activeTab === 'deposit' && (
                    <div className="grid grid-cols-2 gap-3">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => {
                            if (!method.soon) {
                              // Sub-modal opens at z-[300], above this overlay at z-[200]
                              setDepositMethod(method.id as 'zappay')
                            } else {
                              toast.error('This method is coming soon!')
                            }
                          }}
                          className={`bg-[#1A1E29] rounded-2xl p-4 flex flex-col transition-all border border-white/5 relative overflow-hidden text-left
                            ${method.soon ? 'opacity-50 cursor-not-allowed hover:bg-[#1A1E29]' : 'hover:bg-[#252A36] hover:-translate-y-1'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className={`w-8 h-8 rounded-full ${method.color} flex items-center justify-center font-bold text-sm shadow-lg`}>
                              {method.icon}
                            </div>
                            {method.badge && !method.soon && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                method.badge.includes('+') ? 'bg-yellow-500/20 text-yellow-500' :
                                method.badge.includes('-') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {method.badge}
                              </span>
                            )}
                            {method.soon && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#252A36] text-slate-400">
                                Soon
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-auto">
                            <span className="text-white font-medium text-sm">{method.name}</span>
                          </div>
                          {method.tag && !method.soon && (
                            <div className="absolute top-4 left-10 bg-[#2AC3FF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              {method.tag}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeTab === 'cashout' && (
                    <div className="py-2 space-y-6">
                      <div>
                        <h3 className="text-slate-400 text-sm font-medium mb-3 px-2">Cash methods</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => setCashoutMethod('chime')} className="bg-[#1A1E29] hover:bg-[#252A36] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white text-xl">C</div>
                            <span className="text-white font-bold text-sm">Chime</span>
                          </button>
                          <button onClick={() => setCashoutMethod('cashapp')} className="bg-[#1A1E29] hover:bg-[#252A36] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-xl">$</div>
                            <span className="text-white font-bold text-sm">CashApp</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-slate-400 text-sm font-medium mb-3 px-2">Cryptocurrency</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#1A1E29] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-white text-xl">₿</div>
                            <div className="text-center">
                              <span className="text-white font-bold text-sm block">Bitcoin</span>
                              <span className="text-slate-500 text-[10px] block">BTC Network</span>
                            </div>
                            <span className="bg-[#252A36] text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full mt-1">Soon</span>
                          </div>
                          <div className="bg-[#1A1E29] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xl">⬨</div>
                            <div className="text-center">
                              <span className="text-white font-bold text-sm block">Ethereum</span>
                              <span className="text-slate-500 text-[10px] block">ERC-20</span>
                            </div>
                            <span className="bg-[#252A36] text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full mt-1">Soon</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div>
                      {historyLoading ? (
                        <div className="space-y-3 py-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                              <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 bg-white/10 rounded w-24" />
                                <div className="h-2.5 bg-white/5 rounded w-16" />
                              </div>
                              <div className="space-y-1.5">
                                <div className="h-3 bg-white/10 rounded w-12" />
                                <div className="h-2.5 bg-white/5 rounded w-16" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : history.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-slate-500 text-sm mb-3">No transactions yet.</p>
                          <button onClick={() => setActiveTab('deposit')} className="text-[#2AC3FF] text-sm hover:underline">Make your first deposit →</button>
                        </div>
                      ) : (
                        <div className="-mx-2">
                          {history.map(tx => <TxRow key={`${tx.kind}-${tx.id}`} tx={tx} />)}
                          <div className="pt-3 text-center">
                            <Link href="/dashboard/deposits" onClick={onClose} className="text-xs text-slate-500 hover:text-white transition-colors">
                              View full history →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-modals are rendered at z-[300], safely above this modal's z-[200] overlay */}
      <ManualCashoutModal
        isOpen={cashoutMethod !== null}
        onClose={() => setCashoutMethod(null)}
        method={cashoutMethod as any}
        balance={balance}
      />
      <ZappayDepositModal
        isOpen={depositMethod !== null}
        onClose={() => setDepositMethod(null)}
      />
    </>
  )
}
