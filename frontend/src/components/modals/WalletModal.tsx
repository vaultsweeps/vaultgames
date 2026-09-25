'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
const ManualCashoutModal = dynamic(() => import('./ManualCashoutModal'), { ssr: false })
const ChimePayPalDepositModal = dynamic(() => import('./ChimePayPalDepositModal'), { ssr: false })
const CryptoDepositModal = dynamic(() => import('./CryptoDepositModal'), { ssr: false })
const GgusOnePayModal = dynamic(() => import('./GgusOnePayModal'), { ssr: false })
import { depositApi, withdrawalApi } from '@/lib/api'
import { getSmsUrl } from '@/lib/sms'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  balance: number
}

type PaymentMethodType = {
  id: string;
  name: string;
  icon: string;
  badge?: string;
  tag?: string;
  color: string;
  soon?: boolean;
  logoUrl?: string;
  ggusPreset?: string;
}

const paymentMethods: PaymentMethodType[] = [
  { id: 'crypto',      name: 'Cryptocurrency',  icon: '₿',  badge: 'Bonus +20%', tag: '+5', color: 'bg-orange-500' },
  { id: 'chime-group', name: 'Chime',           icon: 'C',  badge: 'No fee',     color: 'bg-emerald-500' },
  { id: 'cashapp-group', name: 'CashApp Pay',   icon: '$',  badge: 'No fee',     color: 'bg-green-500' },
  { id: 'paypal',      name: 'PayPal',          icon: 'P',  badge: 'No fee',     color: 'bg-blue-500' },
  { id: 'applepay',    name: 'Apple Pay',       icon: '',                       color: 'bg-black',      ggusPreset: 'applepay', logoUrl: 'https://i.pinimg.com/originals/ae/85/92/ae859253f4141e38711d2c159a53649e.jpg' },
  { id: 'googlepay',   name: 'Google Pay',      icon: 'G',                       color: 'bg-white text-black', ggusPreset: 'googlepay' },
  { id: 'card',        name: 'Debit Card',      icon: '💳',                      color: 'bg-blue-600',   ggusPreset: 'card' },
  { id: 'ggusonepay',  name: 'Payment Apps',    icon: '⚡', badge: 'Fast & Auto', color: 'bg-purple-500' },
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
  chime: 'bg-emerald-500', chime2: 'bg-teal-500', cashapp: 'bg-green-500', paypal: 'bg-blue-500',
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
    <div className={`border-b border-border-subtle last:border-0 ${isRejected && tx.rejectionReason ? 'cursor-pointer' : ''}`}
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
          <p className="text-muted text-xs">{dateStr}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold text-sm">${tx.amount.toFixed(2)}</p>
          <p className={`text-xs capitalize font-medium flex items-center gap-1 justify-end ${STATUS_COLOR[tx.status.toLowerCase()] || 'text-secondary'}`}>
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
  const [depositMethod, setDepositMethod] = useState<'chime' | 'chime2' | 'paypal' | 'cashapp' | 'cashapp2' | 'crypto' | 'ggusonepay' | null>(null)
  const [subDepositGroup, setSubDepositGroup] = useState<'chime' | 'cashapp' | null>(null)
  const [ggusPreset, setGgusPreset] = useState<string | undefined>(undefined)
  const [paymentMethodId, setPaymentMethodId] = useState<string>('')
  const [history, setHistory] = useState<TxItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Single source-of-truth for body scroll lock — this component owns it
  useEffect(() => {
    const anyOpen = isOpen || cashoutMethod !== null || depositMethod !== null
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen, cashoutMethod, depositMethod])

  // When wallet closes, also close any open sub-modals
  useEffect(() => {
    if (!isOpen) {
      setCashoutMethod(null)
      setDepositMethod(null)
      setSubDepositGroup(null)
    }
  }, [isOpen])

  // Fetch ggusonepay payment method id as soon as wallet opens
  useEffect(() => {
    if (!isOpen) return
    // Use known DB id immediately as fallback, then confirm from API
    setPaymentMethodId('cmsxko7jy0000134e9967nabt')
    depositApi.getPaymentMethods().then(res => {
      const methods = res.data.data || []
      const ggus = methods.find((m: any) => m.code === 'ggusonepay')
      if (ggus) setPaymentMethodId(ggus.id)
    }).catch(console.error)
  }, [isOpen])

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
            initial={{ opacity: 0, pointerEvents: 'none' }}
            animate={{ opacity: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-[28px] overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] relative"
              style={{ backgroundColor: '#131521', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Subtle Ambient Lighting (Performance Optimized) */}
              <div className="absolute top-[-50px] left-[10%] w-[80%] h-[150px] pointer-events-none rounded-full" style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />
              <div className="absolute bottom-[-50px] right-[10%] w-[80%] h-[150px] pointer-events-none rounded-full" style={{ background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.15) 0%, transparent 70%)' }} />

              {/* Header */}
              <div className="p-6 pb-2 flex justify-between items-center relative z-10">
                <h2 className="text-white font-bold text-[22px] tracking-wide">Wallet</h2>
                <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full transition-colors bg-white/5 hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
                <p className="text-white/50 text-[13px] absolute top-[3.25rem] left-6 max-w-[250px]">
                  Deposit and cash out your funds
                </p>
              </div>

              <div className="p-6 flex-1 overflow-y-auto mt-4 relative z-10">
                {/* Balance Card */}
                <div className="bg-[#1C1F2E] rounded-[24px] p-6 flex flex-col items-center justify-center mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                  <p className="text-white/50 text-sm mb-1.5 font-medium tracking-wide">Balance</p>
                  <div className="flex items-baseline gap-1.5 relative z-10">
                    <span className="text-[#2AC3FF] font-bold text-3xl">$</span>
                    <span className="text-white font-black text-[42px] tracking-tight">{balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex justify-between border-b border-white/10 mb-6 px-4">
                  {['deposit', 'cashout', 'history'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`pb-3 px-3 capitalize text-[15px] font-bold transition-colors relative ${
                        activeTab === tab ? 'text-white' : 'text-white/50 hover:text-white/80'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#2AC3FF] rounded-t-full shadow-[0_0_10px_rgba(42,195,255,0.5)]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="px-1 pb-4">
                  {activeTab === 'deposit' && (
                    <>
                      {/* Main Methods Grid */}
                      {!subDepositGroup && (
                      <div className="grid grid-cols-2 gap-4">
                        {paymentMethods.map((method) => {
                          // Special card for Payment Apps with overlapping icons
                          if (method.id === 'ggusonepay') {
                            return (
                              <button
                                key={method.id}
                                onClick={() => setDepositMethod('ggusonepay')}
                                className="p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[110px] border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5"
                              >
                                <div className="flex justify-between items-start mb-auto w-full relative z-10">
                                  <div className="flex" style={{ gap: '-8px' }}>
                                    {[
                                      { bg: 'bg-green-500', label: '$', z: 3 },
                                      { bg: 'bg-sky-500',   label: 'Z', z: 2 },
                                      { bg: 'bg-blue-700',  label: 'P', z: 1 },
                                      { bg: 'bg-slate-600', label: '+4', z: 0 },
                                    ].map((a, i) => (
                                      <div
                                        key={i}
                                        className={`w-9 h-9 rounded-full ${a.bg} flex items-center justify-center text-white font-bold text-xs border-2 border-[#1C1F2E] shadow-md`}
                                        style={{ zIndex: a.z, marginLeft: i === 0 ? 0 : -10 }}
                                      >{a.label}</div>
                                    ))}
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Fast &amp; Auto
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                                  <span className="text-white font-bold text-[15px] tracking-wide">{method.name}</span>
                                </div>
                              </button>
                            )
                          }
                          // Special card for Cryptocurrency
                          if (method.id === 'crypto') {
                            return (
                              <button
                                key={method.id}
                                onClick={() => setDepositMethod('crypto')}
                                className="p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[110px] border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5"
                              >
                                <div className="flex justify-between items-start mb-auto w-full relative z-10">
                                  <div className="w-10 h-10 rounded-full bg-[#F7931A] flex items-center justify-center text-white font-bold text-[20px] shadow-[0_0_12px_rgba(247,147,26,0.3)]">
                                    ₿
                                  </div>
                                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FFB800] text-black shadow-[0_0_10px_rgba(255,184,0,0.2)]">
                                    Bonus +20%
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                                  <span className="text-white font-bold text-[15px] tracking-wide">{method.name}</span>
                                </div>
                              </button>
                            )
                          }
                          return (
                          <button
                            key={method.id}
                            onClick={() => {
                              if (!method.soon) {
                                if (method.id === 'chime-group') {
                                  setSubDepositGroup('chime')
                                  return
                                }
                                if (method.id === 'cashapp-group') {
                                  setSubDepositGroup('cashapp')
                                  return
                                }
                                // Sub-modal opens at z-[300], above this overlay at z-[200]
                                if ((method as any).ggusPreset) {
                                  // Apple Pay, Google Pay, Debit Card — open GgusOnePay with preset
                                  setGgusPreset((method as any).ggusPreset)
                                  setDepositMethod('ggusonepay')
                                } else {
                                  setGgusPreset(undefined)
                                  setDepositMethod(method.id as any)
                                }
                              } else {
                                toast.error('This method is coming soon!')
                              }
                            }}
                            className={`p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[110px] border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] ${
                              method.soon ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-auto w-full relative z-10">
                              <div className={`w-10 h-10 rounded-full ${method.color} flex items-center justify-center font-bold ${method.color.includes('text-') ? '' : 'text-white'} text-lg shadow-lg overflow-hidden`}>
                                {(method as any).logoUrl
                                  ? <img src={(method as any).logoUrl} alt={method.name} className="w-full h-full object-cover" />
                                  : method.icon
                                }
                              </div>
                              {method.badge && !method.soon && (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                                  method.badge.includes('+') ? 'bg-[#FFB800] text-black border-transparent shadow-[0_0_10px_rgba(255,184,0,0.2)]' :
                                  method.badge.includes('-') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {method.badge}
                                </span>
                              )}
                              {method.soon && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
                                  Soon
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                              <span className="text-white font-bold text-[15px] tracking-wide">{method.name}</span>
                            </div>
                          </button>
                          )

                        })}
                      </div>
                      )}
                      
                      {/* Sub-menu for Chime Group */}
                      {subDepositGroup === 'chime' && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          <button 
                            onClick={() => setSubDepositGroup(null)}
                            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-2 text-sm font-medium"
                          >
                            <ArrowDownLeft className="w-4 h-4 rotate-45" /> Back to methods
                          </button>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { id: 'chime', name: 'Chime 1', color: 'bg-emerald-500', icon: 'C' },
                              { id: 'chime2', name: 'Chime 2', color: 'bg-teal-500', icon: 'C' }
                            ].map(method => (
                              <button
                                key={method.id}
                                onClick={() => setDepositMethod(method.id as any)}
                                className="p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[110px] border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5"
                              >
                                <div className="flex justify-between items-start mb-auto w-full relative z-10">
                                  <div className={`w-10 h-10 rounded-full ${method.color} flex items-center justify-center font-bold text-white text-lg shadow-lg`}>
                                    {method.icon}
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    No fee
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                                  <span className="text-white font-bold text-[15px] tracking-wide">{method.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      
                      {/* Sub-menu for CashApp Group */}
                      {subDepositGroup === 'cashapp' && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          <button 
                            onClick={() => setSubDepositGroup(null)}
                            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-2 text-sm font-medium"
                          >
                            <ArrowDownLeft className="w-4 h-4 rotate-45" /> Back to methods
                          </button>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { id: 'cashapp', name: 'CashApp 1', color: 'bg-green-500', icon: '$' },
                              { id: 'cashapp2', name: 'CashApp 2', color: 'bg-lime-500', icon: '$' }
                            ].map(method => (
                              <button
                                key={method.id}
                                onClick={() => setDepositMethod(method.id as any)}
                                className="p-4 rounded-[20px] flex flex-col relative transition-all text-left w-full h-[110px] border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5"
                              >
                                <div className="flex justify-between items-start mb-auto w-full relative z-10">
                                  <div className={`w-10 h-10 rounded-full ${method.color} flex items-center justify-center font-bold text-white text-lg shadow-lg`}>
                                    {method.icon}
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    No fee
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 relative z-10 mt-3">
                                  <span className="text-white font-bold text-[15px] tracking-wide">{method.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      <div className="mt-4">
                        <a href={getSmsUrl()} target="_blank" rel="noopener noreferrer" className="w-full block font-bold py-4 rounded-[16px] text-center text-[15px] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border border-blue-400/50 hover:scale-[1.01]">
                          Contact us for more option
                        </a>
                      </div>
                    </>
                  )}

                  {activeTab === 'cashout' && (
                    <div className="py-2 space-y-6">
                      <div>
                        <h3 className="text-white/50 text-[13px] font-bold mb-3 px-2 uppercase tracking-wider">Cash methods</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setCashoutMethod('chime')} className="p-5 rounded-[20px] flex flex-col items-center justify-center gap-3 transition-all border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white text-[22px] shadow-[0_0_15px_rgba(16,185,129,0.4)]">C</div>
                            <span className="text-white font-bold text-[15px] tracking-wide">Chime</span>
                          </button>
                          <button onClick={() => setCashoutMethod('cashapp')} className="p-5 rounded-[20px] flex flex-col items-center justify-center gap-3 transition-all border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5">
                            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-[22px] shadow-[0_0_15px_rgba(34,197,94,0.4)]">$</div>
                            <span className="text-white font-bold text-[15px] tracking-wide">CashApp</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white/50 text-[13px] font-bold mb-3 px-2 mt-2 uppercase tracking-wider">Cryptocurrency</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <button onClick={() => setCashoutMethod('crypto_ltc' as any)} className="p-5 rounded-[20px] flex flex-col items-center justify-center gap-2 transition-all border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5">
                            <div className="w-12 h-12 rounded-full bg-[#345D9D] flex items-center justify-center font-bold text-white text-[22px] italic shadow-[0_0_15px_rgba(52,93,157,0.5)]">
                              Ł
                            </div>
                            <div className="text-center mt-1">
                              <span className="text-white font-bold text-[15px] tracking-wide block">Litecoin</span>
                              <span className="text-white/50 text-[11px] block mt-0.5">Mainnet</span>
                            </div>
                          </button>
                          <button onClick={() => setCashoutMethod('crypto_trx' as any)} className="p-5 rounded-[20px] flex flex-col items-center justify-center gap-2 transition-all border bg-[#1C1F2E] border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-[#23273A] hover:border-white/10 hover:-translate-y-0.5">
                            <div className="w-12 h-12 rounded-full bg-[#E51C23] flex items-center justify-center font-bold text-white text-[22px] shadow-[0_0_15px_rgba(229,28,35,0.4)]">
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 12h18"/><path d="M12 3v18"/><path d="M3 12l9-9 9 9-9 9-9-9z"/></svg>
                            </div>
                            <div className="text-center mt-1">
                              <span className="text-white font-bold text-[15px] tracking-wide block">USDT</span>
                              <span className="text-white/50 text-[11px] block mt-0.5">TRC-20</span>
                            </div>
                          </button>
                        </div>
                        <div className="mt-4">
                          <a href={getSmsUrl()} target="_blank" rel="noopener noreferrer" className="w-full block font-bold py-4 rounded-[16px] text-center text-[15px] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border border-blue-400/50 hover:scale-[1.01]">
                            Contact us for more option
                          </a>
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
                          <p className="text-muted text-sm mb-3">No transactions yet.</p>
                          <button onClick={() => setActiveTab('deposit')} className="text-[#2AC3FF] text-sm hover:underline">Make your first deposit →</button>
                        </div>
                      ) : (
                        <div className="-mx-2">
                          {history.map(tx => <TxRow key={`${tx.kind}-${tx.id}`} tx={tx} />)}
                          <div className="pt-3 text-center">
                            <Link href="/dashboard/deposits" onClick={onClose} className="text-xs text-muted hover:text-white transition-colors">
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
      />

      <ChimePayPalDepositModal
        isOpen={depositMethod === 'chime' || depositMethod === 'chime2' || depositMethod === 'paypal' || depositMethod === 'cashapp' || depositMethod === 'cashapp2'}
        onClose={() => setDepositMethod(null)}
        method={depositMethod === 'chime' ? 'chime' : depositMethod === 'chime2' ? 'chime2' : depositMethod === 'paypal' ? 'paypal' : depositMethod === 'cashapp' ? 'cashapp' : depositMethod === 'cashapp2' ? 'cashapp2' : null}
      />
      <CryptoDepositModal
        isOpen={depositMethod === 'crypto'}
        onClose={() => setDepositMethod(null)}
      />
      <GgusOnePayModal
        isOpen={depositMethod === 'ggusonepay'}
        onClose={() => {
          setDepositMethod(null)
          setGgusPreset(undefined)
          onClose() // maybe close wallet too if it redirects
        }}
        paymentMethodId={paymentMethodId}
        preset={ggusPreset}
        onSuccess={() => {
          setDepositMethod(null)
          setGgusPreset(undefined)
        }}
      />
    </>
  )
}
