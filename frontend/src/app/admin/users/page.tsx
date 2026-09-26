'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Eye, Ban, UserCheck, RefreshCw, Check, Download, Phone, Send, User, Users, ShieldOff, X } from 'lucide-react'
import { adminApi } from '@/lib/api'
import Link from 'next/link'
import { Badge, Button, Card, EmptyState, IconTile, PageHeader, Skeleton, buttonClass, cn } from '@/components/dashboard/ui'

type UserProfile = {
  fullName?: string
  phone?: string
  telegramUsername?: string
  telegramId?: string
}

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
  profile?: UserProfile
  _count?: { deposits: number }
}

const ICON_BTN = 'w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'

const UserStatus = ({ user }: { user: User }) =>
  user.isBanned ? <Badge tone="red" dot>Banned</Badge> : user.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="orange" dot>Suspended</Badge>

const Avatar = ({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) => (
  <div className={cn('rounded-full flex items-center justify-center text-white font-bold flex-shrink-0', size === 'lg' ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-sm')}
    style={{ background: 'var(--ds-accent)' }}>
    {name.charAt(0).toUpperCase()}
  </div>
)

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [exporting, setExporting] = useState(false)

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
    (u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.phone?.includes(search) ||
      u.profile?.telegramUsername?.toLowerCase().includes(search.toLowerCase()))
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await adminApi.exportUsersXLS()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `users-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Users exported successfully!')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const rowActions = (user: User) => (
    <div className="flex gap-2">
      <button onClick={() => setSelectedUser(user)}
        className={cn(ICON_BTN, 'bg-surface-elevated border-border-strong text-secondary hover:text-primary')}
        title="Quick View" aria-label="Quick view">
        <Eye className="w-4 h-4" />
      </button>
      {!user.isVerified && (
        <button onClick={() => handleAction(user.id, 'verify')}
          className={cn(ICON_BTN, 'bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20')}
          title="Manually Verify User" aria-label="Verify user">
          <Check className="w-4 h-4" />
        </button>
      )}
      {!user.isBanned ? (
        <button onClick={() => handleAction(user.id, 'ban')}
          className={cn(ICON_BTN, 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20')}
          title="Ban User" aria-label="Ban user">
          <Ban className="w-4 h-4" />
        </button>
      ) : (
        <button onClick={() => handleAction(user.id, 'unban')}
          className={cn(ICON_BTN, 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20')}
          title="Unban User" aria-label="Unban user">
          <UserCheck className="w-4 h-4" />
        </button>
      )}
    </div>
  )

  const telegramLink = (user: User) => user.profile?.telegramUsername ? (
    <a
      href={`https://t.me/${user.profile.telegramUsername.replace('@', '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] text-sky-400 hover:text-sky-300 transition-colors"
    >
      <Send className="w-3.5 h-3.5 flex-shrink-0" />
      <span>@{user.profile.telegramUsername.replace('@', '')}</span>
    </a>
  ) : null

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="User management"
          subtitle="Manage platform users, view contact info, and export data."
          actions={
            <>
              <Button variant="success" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export XLS'}
              </Button>
              <Button variant="secondary" size="sm" onClick={fetchUsers} aria-label="Refresh users" className="!px-3">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          }
        />
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5 max-w-xl">
        <div className="ds-card p-4 flex items-center gap-3 min-w-0">
          <IconTile icon={Users} tone="cyan" size="md" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary leading-none tabular-nums">{users.length}</p>
            <p className="text-[13px] text-secondary mt-1.5">Total users</p>
          </div>
        </div>
        <div className="ds-card p-4 flex items-center gap-3 min-w-0">
          <IconTile icon={ShieldOff} tone="red" size="md" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary leading-none tabular-nums">{users.filter(u => u.isBanned).length}</p>
            <p className="text-[13px] text-secondary mt-1.5">Banned</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input type="text" placeholder="Search by name, email, phone, telegram..." value={search} onChange={e => setSearch(e.target.value)} className="ds-input pl-11" aria-label="Search users" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="ds-input w-full sm:w-44" aria-label="Filter users">
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {/* Desktop table */}
      <Card padded={false} className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[960px] [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3.5 [&_th]:bg-[var(--bg-surface-elevated)] [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact info</th>
                <th>Telegram</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Deposits</th>
                <th>Last login</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted">No users found</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={user.username} />
                      <div className="min-w-0 max-w-[220px]">
                        <p className="text-primary text-[14px] font-semibold truncate">{user.username}</p>
                        <p className="text-[13px] text-muted truncate">{user.email}</p>
                        {user.profile?.fullName && (
                          <p className="text-[13px] text-secondary truncate">{user.profile.fullName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.profile?.phone ? (
                      <div className="flex items-center gap-1.5 text-[13px] text-secondary whitespace-nowrap">
                        <Phone className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                        <span>{user.profile.phone}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-muted italic">No phone</span>
                    )}
                  </td>
                  <td>
                    {telegramLink(user) || <span className="text-[13px] text-muted italic">—</span>}
                  </td>
                  <td><UserStatus user={user} /></td>
                  <td>
                    <span className={cn('text-[13px] font-medium', user.isVerified ? 'text-emerald-400' : 'text-orange-400')}>
                      {user.isVerified ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td className="text-secondary tabular-nums">{user._count?.deposits ?? 0}</td>
                  <td className="text-[13px] text-muted whitespace-nowrap">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td className="text-[13px] text-muted whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>{rowActions(user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [0, 1, 2].map(i => <Skeleton key={i} className="h-[150px] !rounded-[20px]" />)
        ) : filtered.length === 0 ? (
          <Card><EmptyState icon={Users} title="No users found" text="Try a different search or filter." /></Card>
        ) : filtered.map(user => (
          <Card key={user.id} className="!p-4">
            <div className="flex items-start gap-3">
              <Avatar name={user.username} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-primary text-[15px] font-semibold truncate">{user.username}</p>
                  <UserStatus user={user} />
                </div>
                <p className="text-[13px] text-muted truncate">{user.email}</p>
                {user.profile?.fullName && <p className="text-[13px] text-secondary truncate">{user.profile.fullName}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-secondary">
              {user.profile?.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted" />{user.profile.phone}</span>}
              {telegramLink(user)}
              <span className={user.isVerified ? 'text-emerald-400' : 'text-orange-400'}>{user.isVerified ? '✓ Verified' : '✗ Unverified'}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between gap-3">
              <div className="text-xs text-muted min-w-0">
                <p>{user._count?.deposits ?? 0} deposits</p>
                <p className="truncate">Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</p>
              </div>
              {rowActions(user)}
            </div>
          </Card>
        ))}
      </div>

      {/* User quick-view modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setSelectedUser(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="User details"
            className="ds-card max-w-md w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-4 mb-5">
              <Avatar name={selectedUser.username} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-xl text-primary truncate">{selectedUser.username}</h3>
                <p className="text-secondary text-[14px] truncate">{selectedUser.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedUser(null)} aria-label="Close"
                className="w-10 h-10 -mr-2 self-start rounded-xl flex items-center justify-center text-secondary hover:text-primary hover:bg-[var(--ds-hover)] transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contact Info */}
            <div className="bg-surface-elevated rounded-2xl p-4 mb-4 space-y-2.5 border border-border-subtle">
              <p className="text-[13px] font-semibold text-primary mb-1">Contact information</p>
              <div className="flex items-center gap-2 text-[14px]">
                <User className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="text-secondary">Full name:</span>
                <span className="text-primary min-w-0 break-words">{selectedUser.profile?.fullName || <span className="text-muted italic">Not provided</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-[14px]">
                <Phone className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="text-secondary">Phone:</span>
                <span className="text-primary min-w-0 break-words">{selectedUser.profile?.phone || <span className="text-muted italic">Not provided</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-[14px]">
                <Send className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="text-secondary">Telegram:</span>
                {selectedUser.profile?.telegramUsername ? (
                  <a href={`https://t.me/${selectedUser.profile.telegramUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 transition-colors min-w-0 break-all">
                    @{selectedUser.profile.telegramUsername.replace('@', '')}
                  </a>
                ) : selectedUser.profile?.telegramId ? (
                  <span className="text-primary min-w-0 break-all">ID: {selectedUser.profile.telegramId} <span className="text-muted text-xs">(no username)</span></span>
                ) : <span className="text-muted italic">Not linked</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {[
                ['Status', selectedUser.isBanned ? 'Banned' : selectedUser.isActive ? 'Active' : 'Suspended'],
                ['Verified', selectedUser.isVerified ? 'Yes' : 'No'],
                ['Deposits', selectedUser._count?.deposits?.toString() ?? '0'],
                ['Joined', new Date(selectedUser.createdAt).toLocaleDateString()],
                ['Last Login', selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : 'Never'],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface-elevated border border-border-subtle rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="text-[14px] text-primary font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col min-[420px]:flex-row flex-wrap gap-2.5">
              <Link href={`/admin/users/${selectedUser.id}`} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'flex-1 !text-sky-400')}>
                Full Profile
              </Link>
              {!selectedUser.isBanned ? (
                <>
                  <button onClick={() => handleAction(selectedUser.id, selectedUser.isActive ? 'suspend' : 'activate')}
                    className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'flex-1 !text-amber-400')}>
                    {selectedUser.isActive ? 'Suspend' : 'Activate'}
                  </button>
                  <button onClick={() => handleAction(selectedUser.id, 'ban')}
                    className={cn(buttonClass({ variant: 'danger', size: 'sm' }), 'flex-1')}>
                    Ban User
                  </button>
                </>
              ) : (
                <button onClick={() => handleAction(selectedUser.id, 'unban')}
                  className={cn(buttonClass({ variant: 'success', size: 'sm' }), 'flex-1')}>
                  Unban User
                </button>
              )}
            </div>
            <button onClick={() => setSelectedUser(null)} className={cn(buttonClass({ variant: 'ghost', size: 'sm', full: true }), 'mt-2.5')}>Close</button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
