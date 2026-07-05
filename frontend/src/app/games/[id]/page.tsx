'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { Download, ArrowLeft, RefreshCw, Copy, Eye, EyeOff, PlusCircle, ArrowUpCircle, AlertCircle, Key, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GameTransferModal from '@/components/modals/GameTransferModal'
import ChooseGameModal from '@/components/modals/ChooseGameModal'
import Loader from '@/components/ui/Loader'
import { publicApi, gamesApi, providerApi, authApi } from '@/lib/api'
import Cookies from 'js-cookie'
import { useAuthStore } from '@/store/authStore'

interface Game {
  id: string
  name: string
  thumbnailUrl: string | null
}

interface ProviderAccount {
  accountName: string | null
  balance: number
  hasAccount: boolean
}

export default function GameDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [game, setGame] = useState<Game | null>(null)
  const [account, setAccount] = useState<ProviderAccount | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [chooseGameOpen, setChooseGameOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [transferType, setTransferType] = useState<'deposit' | 'cashout'>('deposit')
  const [walletBalance, setWalletBalance] = useState<number>(0)
  
  const [password, setPassword] = useState('Default123!')
  const [showPassword, setShowPassword] = useState(false)
  
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (account?.accountName && id) {
      const savedPwd = localStorage.getItem(`game_pwd_${id}_${account.accountName}`)
      if (savedPwd) setPassword(savedPwd)
    }
  }, [account?.accountName, id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch game details first for instant rendering
        const gameRes = await publicApi.getGameDetails(id as string)
        setGame(gameRes.data.data)
        setLoading(false) // Unblock UI immediately

        // Fetch user-specific data in background ONLY if authenticated
        let accRes = { data: { data: null as any } }
        let txRes = { data: { data: [] as any[] } }
        let balRes = { data: { data: { balance: 0 } } }

        if (isAuthenticated) {
          const results = await Promise.all([
            providerApi.getAccount(id as string).catch(() => ({ data: { data: null } })),
            providerApi.getTransactions(id as string).catch(() => ({ data: { data: [] } })),
            authApi.getBalance().catch(() => ({ data: { data: { balance: 0 } } }))
          ])
          accRes = results[0]
          txRes = results[1]
          balRes = results[2]
        }
        
        if (accRes.data?.data) {
          if (accRes.data.data.isMaintenance) {
            setMaintenanceModalOpen(true)
          } else {
            setAccount(accRes.data.data)
          }
        }
        
        if (txRes.data?.data) {
          setTransactions(txRes.data.data)
        }
        
        if (balRes.data?.data?.balance !== undefined) {
          setWalletBalance(balRes.data.data.balance)
        }
      } catch (err: any) {
        console.error(err)
        if (!game) {
          toast.error('Failed to load game details')
          router.push('/games')
        }
      }
    }
    
    if (id) {
      fetchData()
    }
  }, [id, isAuthenticated])


  const handleDownload = async () => {
    const token = Cookies.get('vaultsweeps_token')
    if (!token) return router.push('/login')

    setDownloading(true)
    try {
      const res = await gamesApi.download(id as string)
      const downloadUrl = res.data.data?.downloadUrl
      if (downloadUrl) {
        window.open(downloadUrl, '_blank')
        toast.success('Download started successfully!')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to download game')
    } finally {
      setDownloading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!confirm('Are you sure you want to reset your game password? You will be logged out of the game client.')) return
    
    setResetting(true)
    try {
      const res = await providerApi.resetPassword(id as string)
      const newPwd = res.data.data.newPassword
      setPassword(newPwd)
      if (account?.accountName) {
        localStorage.setItem(`game_pwd_${id}_${account.accountName}`, newPwd)
      }
      setShowPassword(true)
      toast.success('Password reset successfully!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  const handleProvision = async () => {
    setProvisioning(true)
    try {
      await providerApi.createAccount(id as string)
      toast.success('Game account created! Loading credentials...')
      // Re-fetch account data
      const accRes = await providerApi.getAccount(id as string)
      if (accRes.data?.data) {
        setAccount(accRes.data.data)
        setLastUpdate(new Date())
      }
    } catch (err: any) {
      if (err?.response?.status === 503 || err?.response?.data?.message?.includes('No active game provider')) {
        setMaintenanceModalOpen(true)
      } else {
        toast.error(err?.response?.data?.message || 'Failed to create game account. Please contact support.')
      }
    } finally {
      setProvisioning(false)
    }
  }

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy text')
    }
  }

  const handleRefreshBalance = async () => {
    setIsRefreshing(true)
    try {
      const [accRes, balRes] = await Promise.all([
        providerApi.getAccount(id as string),
        authApi.getBalance()
      ])
      
      if (accRes.data?.data) {
        setAccount(accRes.data.data)
        setLastUpdate(new Date())
      }
      if (balRes.data?.data) {
        setWalletBalance(balRes.data.data.balance)
      }
      toast.success('Balance synced successfully!')
    } catch (e) {
      toast.error('Failed to sync balance')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTransfer = async (amount: number, type: 'recharge' | 'withdraw') => {
    try {
      await providerApi.transfer({ gameId: id as string, amount, type })
      toast.success(type === 'recharge' ? 'Funds added to game successfully!' : 'Cashed out successfully!')
      
      // Refresh Data
      const [accRes, balRes, txRes] = await Promise.all([
        providerApi.getAccount(id as string),
        authApi.getBalance(),
        providerApi.getTransactions(id as string)
      ])
      
      if (accRes.data?.data) setAccount(accRes.data.data)
      if (balRes.data?.data) setWalletBalance(balRes.data.data.balance)
      if (txRes.data?.data) setTransactions(txRes.data.data)
      
      setLastUpdate(new Date())
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Transfer failed')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <Navbar />
      <div className="pt-32 pb-20 flex-grow flex items-center justify-center">
        <Loader fullScreen={false} />
      </div>
    </div>
  )

  if (!game) return null

  const isMasked = password === '********'

  return (
    <div className="min-h-screen bg-[#0F1219] flex flex-col font-sans">
      <Navbar />
      
      <div className="flex-1 pt-24 pb-24 px-4 max-w-lg mx-auto w-full space-y-4">
        
        <Link href="/games" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Top Game Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1A1E29] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-lg border border-white/5">
          <div className="w-full sm:w-1/2 h-32 rounded-xl overflow-hidden relative bg-black/40">
            {game.thumbnailUrl && <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover" />}
          </div>
          <div className="w-full sm:w-1/2 flex flex-col justify-center">
            <h2 className="text-white font-bold text-lg mb-3 truncate">{game.name}</h2>
            <button 
              onClick={handleDownload} 
              disabled={downloading}
              className="bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3 px-4 rounded-xl w-full flex items-center justify-center gap-2 transition-all disabled:opacity-70"
            >
              {downloading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
              Download
            </button>
          </div>
        </motion.div>

        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-[#1A1E29] rounded-2xl p-5 shadow-lg border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-3xl font-black text-white">${account?.balance?.toFixed(2) || '0.00'}</p>
              <p className="text-slate-400 text-sm mt-1">Game Balance</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div className="mr-2">
                <p className="text-lg font-bold text-[#2AC3FF]">${walletBalance.toFixed(2)}</p>
                <p className="text-slate-400 text-xs">Wallet</p>
              </div>
              <button 
                onClick={handleRefreshBalance} 
                disabled={isRefreshing}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => { setTransferType('deposit'); setTransferModalOpen(true); }}
              className="bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-3.5 rounded-xl flex-1 flex items-center justify-center gap-2 transition-all"
            >
              <PlusCircle className="w-5 h-5" /> Add Cash
            </button>
            <button 
              onClick={() => { setTransferType('cashout'); setTransferModalOpen(true); }}
              className="bg-[#252A36] hover:bg-[#2F3543] text-white font-bold py-3.5 rounded-xl flex-1 flex items-center justify-center gap-2 transition-all border border-white/5"
            >
              <ArrowUpCircle className="w-5 h-5" /> Cash Out
            </button>
          </div>
        </motion.div>

        {/* Credentials Card */}
        {account?.hasAccount ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1A1E29] rounded-2xl p-5 shadow-lg border border-white/5 space-y-3">
            
            {/* Username */}
            <div className="bg-[#13161F] rounded-xl p-4 flex justify-between items-center border border-white/5">
              <span className="text-slate-300 font-mono text-sm">{account.accountName}</span>
              <button onClick={() => copyToClipboard(account.accountName!)} className="text-slate-500 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Password */}
            <div className="bg-[#13161F] rounded-xl p-4 flex justify-between items-center border border-white/5">
              <span className="text-slate-300 font-mono text-sm">{showPassword ? password : '••••••••'}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowPassword(!showPassword)} className="transition-colors text-slate-500 hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copyToClipboard(password)} className="transition-colors text-slate-500 hover:text-white">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button 
              onClick={handleResetPassword} 
              disabled={resetting}
              className="w-full bg-[#1A1E29] hover:bg-[#252A36] border border-white/10 text-white py-3.5 rounded-xl mt-2 transition-all font-medium disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Reset password'}
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1A1E29] rounded-2xl p-6 shadow-lg border border-white/5">
            {!isAuthenticated ? (
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Please sign in to view your game credentials.</p>
                <Link href="/login" className="mt-4 inline-block bg-[#2AC3FF] text-white text-sm font-bold px-6 py-2.5 rounded-xl">Sign In</Link>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-4 mb-6 text-left w-full">
                  <div className="w-10 h-10 rounded-full bg-[#2AC3FF] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(42,195,255,0.4)]">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-white text-lg font-medium leading-tight">
                    You don't have an account, get your<br />access right now
                  </p>
                </div>
                
                <button
                  onClick={handleProvision}
                  disabled={provisioning}
                  className="w-full bg-[#2AC3FF] hover:bg-[#1CA0D9] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-60 text-lg shadow-lg shadow-[#2AC3FF]/20"
                >
                  {provisioning ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 
                      Getting access...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Key className="w-5 h-5" /> Get access
                    </span>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Transactions Card */}
        {account?.hasAccount && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-[#1A1E29] rounded-2xl p-5 shadow-lg border border-white/5">
            <div className="flex justify-between text-xs font-medium text-slate-500 mb-4 px-2">
              <span>ID</span>
              <span className="text-center">Amount</span>
              <span className="text-right">Status / Date</span>
            </div>

            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">No recent transactions</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-[#13161F] rounded-xl p-3.5 flex justify-between items-center border border-white/5">
                    <span className="text-slate-400 font-mono text-xs uppercase w-20 truncate" title={tx.id}>#{tx.id.slice(-6)}</span>
                    <span className="text-white font-bold text-sm w-20 text-center">${tx.amount.toFixed(2)}</span>
                    <div className="text-right w-24">
                      <p className={`text-xs font-medium mb-0.5 ${
                        tx.status === 'success' ? 'text-green-400' : 
                        tx.status === 'failed' ? 'text-red-400' : 'text-orange-400'
                      }`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </p>
                      <p className="text-slate-500 text-[10px]">{new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

      </div>
      
      <Footer />

      {account?.hasAccount && (
        <GameTransferModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          type={transferType}
          gameName={game.name}
          gameThumbnail={game.thumbnailUrl}
          accountName={account.accountName || ''}
          gameBalance={account.balance || 0}
          walletBalance={walletBalance}
          startAmount={transactions.find(t => t.type === 'recharge' && t.status === 'success')?.amount || 5}
          onTransfer={handleTransfer}
          onChangeGame={() => {
            setTransferModalOpen(false)
            setChooseGameOpen(true)
          }}
        />
      )}

      <ChooseGameModal 
        isOpen={chooseGameOpen} 
        onClose={() => setChooseGameOpen(false)} 
      />

      {/* Maintenance Modal */}
      {maintenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1A1E29] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
            <div className="text-center mb-6 mt-2">
              <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold text-white mb-2">Coming Soon!</h3>
              <p className="text-slate-400 text-sm">
                This game is currently under maintenance or being integrated. It will be available very soon!
              </p>
            </div>
            <button onClick={() => setMaintenanceModalOpen(false)} className="w-full bg-[#252A36] hover:bg-[#2F3543] border border-white/10 text-white font-bold py-3 rounded-xl transition-colors">
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
