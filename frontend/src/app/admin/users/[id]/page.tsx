'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminApi } from '@/lib/api'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Gift, AlertCircle, Gamepad2, Ticket, PlusCircle, Phone, Send, User, UserX, Users } from 'lucide-react'
import Link from 'next/link'
import { Badge, Button, Card, EmptyState, IconTile, PageHeader, SectionHeading, StatusBadge, cn, type Tone } from '@/components/dashboard/ui'

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

  // Add Balance state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addReason, setAddReason] = useState('')
  const [adding, setAdding] = useState(false)

  // Sunday Freeplay (customer requests it on Signal; staff grant it here)
  const [freeplay, setFreeplay] = useState<any>(null)
  const [grantingFreeplay, setGrantingFreeplay] = useState(false)

  useEffect(() => {
    if (id) {
      fetchDetails()
      fetchFreeplay()
    }
  }, [id])

  const fetchFreeplay = async () => {
    try {
      const res = await adminApi.getUserSundayFreeplay(id as string)
      setFreeplay(res.data.data)
    } catch {
      setFreeplay(null)
    }
  }

  const handleGrantFreeplay = async () => {
    if (!confirm(`Grant $${freeplay?.amount ?? 3} Sunday Freeplay to ${data?.user?.username}?`)) return
    setGrantingFreeplay(true)
    try {
      const res = await adminApi.grantUserSundayFreeplay(id as string)
      toast.success(res.data.message || 'Sunday Freeplay granted')
      fetchFreeplay()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to grant Freeplay')
      fetchFreeplay()
    } finally {
      setGrantingFreeplay(false)
    }
  }

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
        fetchDetails()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to void balance')
    } finally {
      setVoiding(false)
    }
  }

  const handleAddBalance = async () => {
    const amount = parseFloat(addAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount to add')
    setAdding(true)
    try {
      const res = await adminApi.addUserBalance(id as string, { amount, reason: addReason })
      if (res.data.success) {
        toast.success(`Successfully added $${amount.toFixed(2)} to balance`)
        setShowAddModal(false)
        setAddAmount('')
        setAddReason('')
        fetchDetails()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add balance')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-sky-400/25 border-t-sky-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!data || !data.user) {
    return (
      <Card>
        <EmptyState icon={UserX} title="User not found" text="This account may have been removed."
          action={<Button variant="secondary" onClick={() => router.back()}>Go Back</Button>} />
      </Card>
    )
  }

  const { user, walletBalance, stats, referrals } = data

  const ticketTone = (status: string): Tone =>
    status === 'open' ? 'gold' : status === 'closed' || status === 'resolved' ? 'green' : 'blue'

  return (
    <div className="pb-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <button onClick={() => router.back()} aria-label="Go back"
          className="mt-0.5 w-11 h-11 flex-shrink-0 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-primary hover:brightness-125 active:scale-95 transition">
          <ArrowLeft size={20} />
        </button>
        <PageHeader className="flex-1 min-w-0"
          title={<span className="break-words">User Profile: {user.username}</span>}
          subtitle="Detailed activity and statistics" />
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        <Card className="!p-4 sm:!p-5 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Wallet} tone="cyan" size="sm" />
            <h3 className="font-semibold text-[14px] text-secondary">Central wallet</h3>
          </div>
          <p className="text-[28px] font-bold text-primary leading-none tabular-nums truncate">${walletBalance.toFixed(2)}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="success" size="sm" className="flex-1" onClick={() => setShowAddModal(true)}>
              <PlusCircle className="w-4 h-4" /> Add
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={() => setShowVoidModal(true)}>
              Void
            </Button>
          </div>
        </Card>

        <Card className="!p-4 sm:!p-5 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={TrendingUp} tone="green" size="sm" />
            <h3 className="font-semibold text-[14px] text-secondary">Total deposited</h3>
          </div>
          <p className="text-[28px] font-bold text-primary leading-none tabular-nums truncate">${stats.totalDeposited.toFixed(2)}</p>
          <p className="text-[13px] text-muted mt-3">{stats.totalDepositsCount} transactions</p>
        </Card>

        <Card className="!p-4 sm:!p-5 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={TrendingDown} tone="red" size="sm" />
            <h3 className="font-semibold text-[14px] text-secondary">Total cashout</h3>
          </div>
          <p className="text-[28px] font-bold text-primary leading-none tabular-nums truncate">${stats.totalWithdrawn.toFixed(2)}</p>
          <p className="text-[13px] text-muted mt-3">{stats.totalWithdrawalsCount} transactions</p>
        </Card>

        <Card className="!p-4 sm:!p-5 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Gift} tone="purple" size="sm" />
            <h3 className="font-semibold text-[14px] text-secondary">Net profit (system)</h3>
          </div>
          <p className={cn('text-[28px] font-bold leading-none tabular-nums truncate', stats.netProfit > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {stats.netProfit > 0 ? `-$${Math.abs(stats.netProfit).toFixed(2)}` : `+$${Math.abs(stats.netProfit).toFixed(2)}`}
          </p>
          <p className="text-[13px] text-muted mt-3">From perspective of the house</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6 min-w-0">
          {/* Sunday Freeplay */}
          <Card className="!p-4 sm:!p-6">
            <SectionHeading title={<span className="flex items-center gap-2"><Gift size={18} className="text-muted" /> Sunday Freeplay</span>} />
            {freeplay ? (
              <>
                <ul className="space-y-2 text-[14px]">
                  {[
                    ['Account active', freeplay.checks.accountActive],
                    [`$${freeplay.minDeposit}+ deposited in last 7 days ($${freeplay.recentDeposits.toFixed(2)})`, freeplay.checks.depositRequirementMet],
                    ['Not yet claimed this week', freeplay.checks.notClaimedThisWeek],
                  ].map(([label, ok]) => (
                    <li key={label as string} className="flex items-start justify-between gap-3">
                      <span className="text-secondary">{label}</span>
                      {ok ? <Badge tone="green" dot>Yes</Badge> : <Badge tone="red" dot>No</Badge>}
                    </li>
                  ))}
                </ul>
                <Button variant="success" size="sm" className="w-full mt-4" onClick={handleGrantFreeplay}
                  disabled={!freeplay.eligible || grantingFreeplay}>
                  <Gift className="w-4 h-4" />
                  {grantingFreeplay ? 'Granting...' : freeplay.eligible ? `Grant $${freeplay.amount} Freeplay` : 'Not eligible this week'}
                </Button>
                <p className="text-xs text-muted mt-2">Added to their Bonus Balance. One per user per week (Sun–Sat, New York time).</p>
              </>
            ) : (
              <p className="text-muted text-[14px] italic">Freeplay status unavailable.</p>
            )}
          </Card>

          {/* Contact Info */}
          <Card className="!p-4 sm:!p-6">
            <SectionHeading title="Contact information" />
            <div className="divide-y divide-[var(--border-subtle)]">
              <div className="flex items-start gap-3 py-3 first:pt-0">
                <User className="w-4 h-4 text-muted mt-1 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">Full name</p>
                  <p className="text-primary text-[14px] break-words">{user.profile?.fullName || <span className="text-muted italic">Not provided</span>}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Phone className="w-4 h-4 text-muted mt-1 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">Phone number</p>
                  <p className="text-primary text-[14px] break-words">{user.profile?.phone || <span className="text-muted italic">Not provided</span>}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <Phone className="w-4 h-4 text-muted mt-1 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">Sign-up mobile (unverified)</p>
                  <p className="text-primary text-[14px] break-words">{user.profile?.signupPhone || <span className="text-muted italic">Not provided</span>}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3 last:pb-0">
                <Send className="w-4 h-4 text-muted mt-1 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">Telegram</p>
                  {user.profile?.telegramUsername ? (
                    <a href={`https://t.me/${user.profile.telegramUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 text-[14px] transition-colors break-all">
                      @{user.profile.telegramUsername.replace('@', '')}
                    </a>
                  ) : <p className="text-muted italic text-[14px]">Not provided</p>}
                </div>
              </div>
            </div>
          </Card>

          {/* Base Info */}
          <Card className="!p-4 sm:!p-6">
            <SectionHeading title="Account info" />
            <div className="divide-y divide-[var(--border-subtle)] text-[14px]">
              <div className="flex justify-between gap-4 py-3 first:pt-0">
                <span className="text-secondary flex-shrink-0">Email</span>
                <span className="text-primary text-right break-all min-w-0">{user.email}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-secondary">Joined</span>
                <span className="text-primary">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-secondary">Role</span>
                <span className="text-primary capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between items-center gap-4 py-3 last:pb-0">
                <span className="text-secondary">Status</span>
                {user.isBanned ? <Badge tone="red" dot>Banned</Badge> : user.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gold" dot>Suspended</Badge>}
              </div>
            </div>
          </Card>

          {/* Connected Games */}
          <Card className="!p-4 sm:!p-6">
            <SectionHeading title={<span className="flex items-center gap-2"><Gamepad2 size={18} className="text-muted" /> Connected games</span>} />
            {user.providerUsers && user.providerUsers.length > 0 ? (
              <div className="space-y-2.5">
                {user.providerUsers.map((pu: any) => (
                  <div key={pu.id} className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle">
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-semibold text-primary text-[14px] truncate">{pu.provider.name}</span>
                      {pu.balance !== undefined && (
                        <span className="text-emerald-400 font-bold tabular-nums">${pu.balance.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="text-[13px] text-secondary break-words">In-game username: <span className="text-sky-400">{pu.accountName}</span></div>
                    <div className="text-xs text-muted mt-1 text-right">Added {new Date(pu.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted text-[14px] italic">No game accounts connected yet.</div>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          {/* History */}
          <Card padded={false} className="overflow-hidden">
            <div className="p-4 sm:p-6 pb-0 sm:pb-0"><SectionHeading title="Recent transactions" /></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] min-w-[560px] [&_th]:whitespace-nowrap">
                <thead className="bg-surface-elevated text-muted text-xs">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 sm:px-6 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
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
                      <tr key={`${tx.type}-${tx.id}`} className={cn('hover:bg-[var(--ds-hover)] transition-colors', isVoid && 'bg-orange-500/5')}>
                        <td className="px-4 sm:px-6 py-3.5">
                          <Badge tone={tx.type === 'Deposit' ? 'green' : isVoid ? 'orange' : 'red'}>{tx.type}</Badge>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-primary tabular-nums">${tx.amount.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-secondary">
                          {isVoid ? (
                            <div>
                              <span className="text-orange-400 font-medium text-[13px]">Admin Void</span>
                              {voidReason && (
                                <p className="text-muted text-xs mt-0.5 italic">"{voidReason}"</p>
                              )}
                            </div>
                          ) : (
                            tx.paymentMethod?.name || tx.accountInfo || 'Unknown'
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {isVoid ? (
                            <Badge tone="orange" dot>Voided</Badge>
                          ) : (
                            <StatusBadge status={tx.status} />
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-muted text-[13px] whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    )
                  })}

                  {(!user.deposits?.length && !user.withdrawals?.length) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Referrals: who referred this user, who they referred, and what each paid */}
          <Card className="!p-4 sm:!p-6">
            <SectionHeading title={<span className="flex items-center gap-2"><Users size={18} className="text-muted" /> Referrals</span>} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle">
                <p className="text-xs text-muted mb-1">Referred by</p>
                {referrals?.referredBy ? (
                  <>
                    <Link href={`/admin/users/${referrals.referredBy.id}`} className="text-primary font-semibold hover:underline break-all">{referrals.referredBy.username}</Link>
                    <p className="text-xs text-secondary mt-0.5">
                      {referrals.referredBy.reward
                        ? `Earned them $${Number(referrals.referredBy.reward.amount).toFixed(2)} (${referrals.referredBy.reward.status})`
                        : 'No reward paid yet'}
                    </p>
                  </>
                ) : <p className="text-secondary">Nobody</p>}
              </div>
              <div className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle">
                <p className="text-xs text-muted mb-1">People referred</p>
                <p className="text-primary font-bold text-lg tabular-nums">{referrals?.referred?.length ?? 0}</p>
              </div>
              <div className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle">
                <p className="text-xs text-muted mb-1">Total referral earnings</p>
                <p className="text-emerald-400 font-bold text-lg tabular-nums">${Number(referrals?.totalEarned || 0).toFixed(2)}</p>
              </div>
            </div>

            {referrals?.referred && referrals.referred.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[14px] min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="px-1 py-2 font-medium">Referred user</th>
                      <th className="px-1 py-2 font-medium">Joined</th>
                      <th className="px-1 py-2 font-medium">Deposited</th>
                      <th className="px-1 py-2 font-medium">Reward</th>
                      <th className="px-1 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.referred.map((r: any) => (
                      <tr key={r.id} className="border-t border-border-subtle">
                        <td className="px-1 py-2.5"><Link href={`/admin/users/${r.id}`} className="text-primary font-semibold hover:underline break-all">{r.username}</Link></td>
                        <td className="px-1 py-2.5 text-secondary whitespace-nowrap">{new Date(r.joinedAt).toLocaleDateString()}</td>
                        <td className="px-1 py-2.5 tabular-nums">${Number(r.totalDeposited).toFixed(2)}</td>
                        <td className="px-1 py-2.5 tabular-nums font-semibold">{r.reward ? `$${Number(r.reward.amount).toFixed(2)}` : '—'}</td>
                        <td className="px-1 py-2.5">
                          {r.reward
                            ? <StatusBadge status={r.reward.status} />
                            : <span className="text-muted text-xs">{r.totalDeposited > 0 ? 'Not paid' : 'Awaiting first deposit'}</span>}
                          {r.reward?.flagReason && <p className="text-[11px] text-amber-400 mt-0.5">{String(r.reward.flagReason).replace(/_/g, ' ')}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-secondary text-sm italic">This user hasn&apos;t referred anyone.</p>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Bonuses */}
            <Card className="!p-4 sm:!p-6 min-w-0">
              <SectionHeading title={<span className="flex items-center gap-2"><Gift size={18} className="text-muted" /> Recent bonuses</span>} />
              <div className="space-y-2.5">
                {user.bonusClaims && user.bonusClaims.length > 0 ? user.bonusClaims.map((claim: any) => (
                  <div key={claim.id} className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-primary truncate">{claim.bonus?.title || 'Unknown Bonus'}</div>
                      <div className="text-xs text-muted">{new Date(claim.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-emerald-400 font-bold tabular-nums">${claim.amount}</div>
                  </div>
                )) : <div className="text-muted text-[14px] italic">No bonuses claimed.</div>}
              </div>
            </Card>

            {/* Support Tickets */}
            <Card className="!p-4 sm:!p-6 min-w-0">
              <SectionHeading title={<span className="flex items-center gap-2"><Ticket size={18} className="text-muted" /> Support tickets</span>} />
              <div className="space-y-2.5">
                {user.tickets && user.tickets.length > 0 ? user.tickets.map((ticket: any) => (
                  <div key={ticket.id} className="p-3.5 bg-surface-elevated rounded-2xl border border-border-subtle">
                    <div className="text-[14px] font-semibold text-primary truncate" title={ticket.subject}>{ticket.subject}</div>
                    <div className="flex justify-between items-center gap-2 mt-2">
                      <Badge tone={ticketTone(ticket.status)} className="capitalize">{ticket.status}</Badge>
                      <span className="text-xs text-muted">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : <div className="text-muted text-[14px] italic">No tickets opened.</div>}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Void Balance Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog" aria-modal="true" aria-label="Void user balance"
            className="ds-card w-full max-w-sm overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-border-subtle flex items-center gap-3">
              <IconTile icon={AlertCircle} tone="red" size="sm" />
              <h3 className="font-bold text-primary text-lg">Void user balance</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-secondary mb-2">Amount to Deduct ($)</label>
                <input
                  type="number"
                  value={voidAmount}
                  onChange={(e) => setVoidAmount(e.target.value)}
                  placeholder="0.00"
                  className="ds-input"
                />
                <p className="text-xs text-muted mt-1.5">Current balance: ${data.walletBalance.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-secondary mb-2">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Fraudulent deposit reversal"
                  className="ds-input"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border-subtle flex gap-2.5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowVoidModal(false)} disabled={voiding}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleVoidBalance} disabled={voiding || !voidAmount}
                className="!bg-red-600 !text-white !border-red-600 hover:!bg-red-500">
                {voiding ? 'Voiding...' : 'Confirm Void'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Balance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog" aria-modal="true" aria-label="Add balance to wallet"
            className="ds-card w-full max-w-sm overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="p-5 border-b border-border-subtle flex items-center gap-3">
              <IconTile icon={PlusCircle} tone="green" size="sm" />
              <h3 className="font-bold text-primary text-lg">Add balance to wallet</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5">
                <p className="text-xs text-emerald-400 font-semibold">Current balance</p>
                <p className="text-primary font-bold text-2xl tabular-nums">${data.walletBalance.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-secondary mb-2">Amount to Add ($)</label>
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="ds-input"
                />
                {addAmount && parseFloat(addAmount) > 0 && (
                  <p className="text-xs text-emerald-400 mt-1.5">New balance will be: ${(data.walletBalance + parseFloat(addAmount)).toFixed(2)}</p>
                )}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-secondary mb-2">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="e.g. Failed deposit #DEP-12345 reimbursement"
                  className="ds-input"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border-subtle flex gap-2.5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)} disabled={adding}>
                Cancel
              </Button>
              <Button variant="success" size="sm" onClick={handleAddBalance} disabled={adding || !addAmount || parseFloat(addAmount) <= 0}
                className="!bg-emerald-600 !text-white !border-emerald-600 hover:!bg-emerald-500">
                <PlusCircle className="w-4 h-4" />
                {adding ? 'Adding...' : 'Add Balance'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
