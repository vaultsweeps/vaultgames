'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Eye, Ban, UserCheck, RefreshCw, Check } from 'lucide-react'
import { adminApi } from '@/lib/api'
import Link from 'next/link'


type User = {
  id: string
  username: string
  email: string
  role: string
  isVerified: boolean
  isActive: boolean
  isBanned: boolean
  createdAt: string
  lastLogin?: string
  deposits?: { amount: number }[]
  totalDeposited?: number
  _count?: { deposits?: number }
  profile?: { telegramUsername?: string; messengerUsername?: string; fullName?: string }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers()
      setUsers(res.data.data)
    } catch { toast.error('Failed to load users') } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter(u =>
    (filter === 'all' || (filter === 'banned' ? u.isBanned : filter === 'unverified' ? !u.isVerified : filter === 'active' ? u.isActive && !u.isBanned : true)) &&
    (u.username.includes(search) || u.email.includes(search))
  )

  const handleAction = async (userId: string, action: string) => {
    try {
      if (action === 'ban') await adminApi.banUser(userId)
      else if (action === 'suspend' || action === 'activate') await adminApi.suspendUser(userId)
      else if (action === 'verify') await adminApi.verifyUser(userId)
      await fetchUsers()
      setSelectedUser(null)
      toast.success(`User ${action} successful!`)
    } catch {
      toast.error('Action failed')
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">USER MANAGEMENT</h2>
          <p className="text-slate-400 text-sm">Manage platform users and their accounts.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchUsers} className="glass border border-white/10 rounded-xl px-3 py-2 text-slate-400 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-neon-blue font-bold text-lg font-display">{users.length}</p>
            <p className="text-xs text-slate-500">Total Users</p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-red-400 font-bold text-lg font-display">{users.filter(u => u.isBanned).length}</p>
            <p className="text-xs text-slate-500">Banned</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="input-neon pl-10" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-neon bg-dark-800 w-full sm:w-40">
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>User</th><th>Status</th><th>Verified</th><th>Deposits</th><th>Telegram</th><th>Messenger</th><th>Last Login</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">Loading users...</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      user.isBanned ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                        : user.isActive ? 'badge-approved' : 'badge-pending'
                    }`}>
                      {user.isBanned ? 'BANNED' : user.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs ${user.isVerified ? 'text-green-400' : 'text-orange-400'}`}>
                      {user.isVerified ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td className="text-slate-300">{user._count?.deposits ?? 0}</td>
                  <td className="text-xs">
                    {user.profile?.telegramUsername
                      ? <a href={`https://t.me/${user.profile.telegramUsername.replace('@','')}`} target="_blank" rel="noreferrer" className="text-neon-blue hover:underline">{user.profile.telegramUsername}</a>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="text-xs">
                    {user.profile?.messengerUsername
                      ? <a href={`https://m.me/${user.profile.messengerUsername}`} target="_blank" rel="noreferrer" className="text-neon-blue hover:underline">{user.profile.messengerUsername}</a>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="text-xs text-slate-500">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td className="text-xs text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedUser(user)}
                        className="w-7 h-7 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-neon-blue border border-white/10 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!user.isVerified && (
                        <button onClick={() => handleAction(user.id, 'verify')}
                          className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
                          title="Manually Verify User">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!user.isBanned ? (
                        <button onClick={() => handleAction(user.id, 'ban')}
                          className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => handleAction(user.id, 'unban')}
                          className="w-7 h-7 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-all">
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white text-2xl font-bold">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white">{selectedUser.username}</h3>
                <p className="text-slate-400 text-sm">{selectedUser.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                ['Status', selectedUser.isBanned ? 'Banned' : selectedUser.isActive ? 'Active' : 'Suspended'],
                ['Verified', selectedUser.isVerified ? 'Yes' : 'No'],
                ['Total Deposits', selectedUser.deposits?.toString() ?? '0'],
                ['Total Deposited', `$${selectedUser.totalDeposited ?? 0}`],
                ['Last Login', selectedUser.lastLogin ?? 'Never'],
                ['Joined', selectedUser.createdAt],
              ].map(([k, v]) => (
                <div key={k} className="glass rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="text-sm text-white font-medium">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/users/${selectedUser.id}`} className="flex-1 py-2.5 bg-neon-blue/10 border border-neon-blue/20 rounded-xl text-neon-blue text-sm hover:bg-neon-blue/20 transition-all text-center">
                Full Profile
              </Link>
              {!selectedUser.isBanned ? (
                <>
                  <button onClick={() => handleAction(selectedUser.id, selectedUser.isActive ? 'suspend' : 'activate')}
                    className="flex-1 py-2.5 glass border border-white/10 rounded-xl text-yellow-400 text-sm hover:bg-yellow-400/5 transition-all">
                    {selectedUser.isActive ? 'Suspend' : 'Activate'}
                  </button>
                  <button onClick={() => handleAction(selectedUser.id, 'ban')}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm hover:bg-red-500/20 transition-all">
                    Ban User
                  </button>
                </>
              ) : (
                <button onClick={() => handleAction(selectedUser.id, 'unban')}
                  className="flex-1 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm hover:bg-green-500/20 transition-all">
                  Unban User
                </button>
              )}
            </div>
            <button onClick={() => setSelectedUser(null)} className="w-full mt-2 glass rounded-xl py-2.5 text-slate-400 text-sm border border-white/10 transition-all hover:text-white">Close</button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
