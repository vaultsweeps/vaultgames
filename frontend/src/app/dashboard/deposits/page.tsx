'use client'
import { useState, useEffect, Suspense, Fragment, ReactNode } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, History, Loader2, ChevronRight, ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react'
import { depositApi, publicApi } from '@/lib/api'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import {
  cn, Card, cardClass, PageHeader, SectionHeading, Button, Badge, StatusBadge, TabBar, EmptyState, Field, Skeleton, IconTile, BrandIcon,
} from '@/components/dashboard/ui'

const ChimePayPalDepositModal = dynamic(() => import('@/components/modals/ChimePayPalDepositModal'), { ssr: false })
const CryptoDepositModal = dynamic(() => import('@/components/modals/CryptoDepositModal'), { ssr: false })
const GgusOnePayModal = dynamic(() => import('@/components/modals/GgusOnePayModal'), { ssr: false })

// Method icon/color map
const METHOD_META: Record<string, { icon: string; color: string; desc: string; logoUrl?: string }> = {
  cashapp:    { icon: '💸', color: '#00D632', desc: 'Send via Cash App — fast & easy' },
  chime:      { icon: '🏦', color: '#00CFAA', desc: 'Deposit via Chime 1 ($Luis-Feliciano-9012)' },
  chime2:     { icon: '🏦', color: '#0EA5E9', desc: 'Deposit via Chime 2 ($Brenda-Taylor-245)' },
  crypto:     { icon: '₿',  color: '#F7931A', desc: 'USDT, BTC, ETH & 100+ cryptocurrencies' },
  bitcoin:    { icon: '₿',  color: '#F7931A', desc: 'Bitcoin payments' },
  usdt:       { icon: '₮',  color: '#26A17B', desc: 'Tether stablecoin (TRC20)' },
  bank:       { icon: '🏙️', color: '#00D4FF', desc: 'Bank wire transfer' },
  apple:      { icon: '', color: '#000000', desc: 'Apple Pay — tap & pay instantly', logoUrl: 'https://i.pinimg.com/originals/ae/85/92/ae859253f4141e38711d2c159a53649e.jpg' },
  card:       { icon: '💳', color: '#2563EB', desc: 'Debit card — pay securely' },
  venmo:      { icon: '💸', color: '#3D95CE', desc: 'Send via Venmo — fast & easy' },
  dollarpay:  { icon: '💵', color: '#22C55E', desc: 'Instant deposit via DollarPay secure link — auto-credited' },
  default:    { icon: '💳', color: '#7B2FFF', desc: 'Digital payment' },
}

function getMeta(code: string) {
  return METHOD_META[code?.toLowerCase()] || METHOD_META.default
}

/* Overlapping round "coin" chips used by the multi-method cards. */
function Cluster({ items }: { items: { bg: string; node: ReactNode }[] }) {
  return (
    <div className="flex items-center" aria-hidden>
      {items.map((a, i) => (
        <span
          key={i}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] leading-none"
          style={{ background: a.bg, zIndex: items.length - i, marginLeft: i === 0 ? 0 : -10, boxShadow: '0 0 0 2.5px var(--bg-surface)' }}
        >
          {a.node}
        </span>
      ))}
    </div>
  )
}

/**
 * Shared payment-method card anatomy (Deposits + Cashouts):
 * icon tile top-left · chevron (or "Soon" badge) top-right · title · one-line description · optional metadata.
 */
function MethodCard({ onClick, tile, title, desc, meta, soon, featured, badge }: {
  onClick: () => void
  tile: ReactNode
  title: ReactNode
  desc: ReactNode
  meta?: ReactNode
  soon?: boolean
  featured?: boolean
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={soon || undefined}
      className={cn(
        cardClass({ interactive: !soon }),
        'group relative w-full h-full min-w-0 min-h-[112px] flex flex-col text-left overflow-hidden !p-3.5 sm:!p-5',
        soon && 'cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'
      )}
      style={{
        ...(featured ? { backgroundImage: 'linear-gradient(150deg, rgba(247,147,26,0.14) 0%, rgba(247,147,26,0.03) 45%, transparent 75%)' } : null),
        ...(soon ? { opacity: 0.55 } : null),
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
        {tile}
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          {badge}
          {soon ? (
            <Badge tone="slate">Soon</Badge>
          ) : (
            !badge && <ChevronRight className="hidden sm:block w-5 h-5 text-muted transition-all group-hover:text-primary group-hover:translate-x-0.5" strokeWidth={2} />
          )}
        </div>
      </div>
      <h3 className="mt-auto text-[15px] sm:text-[17px] font-bold sm:font-semibold text-primary leading-snug tracking-tight line-clamp-2 break-words">{title}</h3>
      <p className="hidden sm:block mt-1 text-[13.5px] text-secondary leading-snug line-clamp-2 break-words">{desc}</p>
      {meta && <p className="hidden sm:block pt-3 text-[12.5px] text-muted tabular-nums">{meta}</p>}
    </button>
  )
}

function DepositsContent() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [methods, setMethods] = useState<any[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState(1)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositHistory, setDepositHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [chimePayPalMethod, setChimePayPalMethod] = useState<'chime'|'chime2'|'paypal'|'cashapp'|'cashapp2'|'venmo'|null>(null)
  const [subGroup, setSubGroup] = useState<'chime' | 'cashapp' | null>(null)
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false)
  const [ggusOnePayModalOpen, setGgusOnePayModalOpen] = useState(false)
  const [ggusOnePayPreset, setGgusOnePayPreset] = useState<string | undefined>(undefined)
  const searchParams = useSearchParams()

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await depositApi.getAll()
      setDepositHistory(res.data.data)
    } catch { } finally {
      setHistoryLoading(false)
    }
  }

  // Handle NOWPayments return URL params
  useEffect(() => {
    const payment = searchParams.get('payment')
    if (payment === 'success') {
      toast.success('Payment submitted! Waiting for blockchain confirmation...')
      setTab('history')
    } else if (payment === 'cancelled') {
      toast.error('Payment was cancelled. You can try again.')
    }
  }, [])

  useEffect(() => {
    setHistoryLoading(true)
    setLoadingMethods(true)
    Promise.all([
      depositApi.getAll(),
      depositApi.getPaymentMethods()
    ]).then(([histRes, methRes]) => {
      setDepositHistory(histRes.data.data)
      setMethods(methRes.data.data || [])
    }).catch(() => {
      setMethods([])
    }).finally(() => {
      setHistoryLoading(false)
      setLoadingMethods(false)
    })
  }, [])

  const handleSubmit = async () => {
    if (!selectedMethod || !depositAmount) return toast.error('Please complete all fields')
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount')
    if (amount < selectedMethod.minAmount) return toast.error(`Minimum deposit is $${selectedMethod.minAmount}`)
    if (amount > selectedMethod.maxAmount) return toast.error(`Maximum deposit is $${selectedMethod.maxAmount}`)
    setIsSubmitting(true)
    try {
      if (selectedMethod.code?.toLowerCase() === 'crypto') {
        setCryptoModalOpen(true)
        setIsSubmitting(false)
        return
      }

      const res = await depositApi.create({ amount, paymentMethodId: selectedMethod.id })
      const data = res.data?.data

      if (data?.redirectRequired && data?.paymentUrl) {
        toast.success('Redirecting to payment gateway...')
        window.location.href = data.paymentUrl
        return
      }

      setStep(3)
      await fetchHistory()
      toast.success('Deposit request created!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit deposit')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedMethod(null)
    setDepositAmount('')
  }

  return (
    <div className="pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Deposits"
          subtitle="Fund your account to access platform features."
          actions={
            <TabBar
              tabs={[
                { id: 'new', label: 'New Deposit', icon: <Plus className="w-4 h-4" /> },
                { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
              ]}
              active={tab}
              onChange={setTab}
            />
          }
        />
      </motion.div>

      {tab === 'new' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* STEP 1 — Select Method */}
          {step === 1 && (
            <div>
              <SectionHeading title="Select payment method" />
              {loadingMethods ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={`meth-skel-${i}`} className="h-[168px]" />
                  ))}
                </div>
              ) : methods.length === 0 ? (
                <Card>
                  <EmptyState icon={CreditCard} title="No deposit methods available" text="Please contact support." />
                </Card>
              ) : (
                (() => {
                  const workingCodes = ['chime', 'chime2', 'paypal', 'venmo', 'cashapp', 'cashapp2', 'crypto', 'ggusonepay', 'applepay', 'googlepay', 'card', 'apple', 'debitcard']
                  const codeOf = (m: any) => String(m.code || '').toLowerCase()
                  const list = methods.filter(m => m.code !== 'zappay' && !m.name?.toLowerCase().includes('zappay'))
                  const chimeGroup = list.filter(m => ['chime', 'chime2'].includes(codeOf(m)))
                  const cashappGroup = list.filter(m => ['cashapp', 'cashapp2'].includes(codeOf(m)))
                  const cryptoMethods = list.filter(m => codeOf(m) === 'crypto')
                  const paypalMethods = list.filter(m => codeOf(m) === 'paypal')
                  const venmoMethods = list.filter(m => codeOf(m) === 'venmo')
                  const ggusMethod = list.find(m => codeOf(m) === 'ggusonepay')
                  const CORE = ['chime', 'chime2', 'cashapp', 'cashapp2', 'crypto', 'paypal', 'venmo', 'ggusonepay']
                  const others = list
                    .filter(m => !CORE.includes(codeOf(m)))
                    .sort((x, y) => Number(!workingCodes.includes(codeOf(x))) - Number(!workingCodes.includes(codeOf(y))))

                  const openDirect = (m: any) => {
                    if (['chime', 'chime2', 'paypal', 'cashapp', 'cashapp2', 'venmo'].includes(codeOf(m))) {
                      setChimePayPalMethod(codeOf(m) as 'chime' | 'chime2' | 'paypal' | 'cashapp' | 'cashapp2' | 'venmo')
                    } else {
                      // dollarpay and crypto go through the amount step
                      setSelectedMethod(m)
                      setStep(2)
                    }
                  }

                  const renderMethod = (m: any) => {
                    const meta = getMeta(m.code)
                    const isSoon = !workingCodes.includes(codeOf(m))
                    return (
                      <MethodCard key={m.id}
                        soon={isSoon}
                        onClick={() => {
                          if (isSoon) {
                            toast.error('This method is coming soon!')
                            return
                          }
                          openDirect(m)
                        }}
                        tile={<BrandIcon kind={m.code || m.name} className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                        badge={!isSoon && ['chime', 'chime2', 'paypal', 'cashapp', 'cashapp2', 'venmo'].includes(codeOf(m)) ? (
                          <Badge tone="green" className="!text-[11px] !px-1.5 sm:!px-2 !py-1">No fee</Badge>
                        ) : undefined}
                        title={m.name}
                        desc={meta.desc}
                        meta={!isSoon ? <>Min: ${m.minAmount} · Max: ${m.maxAmount.toLocaleString()}</> : undefined}
                      />
                    )
                  }

                  const renderGroup = (key: 'chime' | 'cashapp', group: any[], title: string, desc: string) => (
                    <MethodCard key={`group-${key}`}
                      onClick={() => (group.length === 1 ? openDirect(group[0]) : setSubGroup(key))}
                      tile={<BrandIcon kind={key} className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                      badge={<Badge tone="green" className="!text-[11px] !px-1.5 sm:!px-2 !py-1">No fee</Badge>}
                      title={title}
                      desc={desc}
                    />
                  )

                  const gridCls = 'grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'

                  // Sub-menu: Chime 1 / Chime 2  ·  CashApp 1 / CashApp 2
                  if (subGroup) {
                    const group = subGroup === 'chime' ? chimeGroup : cashappGroup
                    return (
                      <div className="space-y-4">
                        <button
                          type="button"
                          onClick={() => setSubGroup(null)}
                          className="inline-flex items-center gap-1.5 h-10 -ml-2 px-2 rounded-xl text-[14px] font-medium text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back to methods
                        </button>
                        <div className={gridCls}>{group.map(renderMethod)}</div>
                      </div>
                    )
                  }

                  const openGgusWith = (preset?: string) => {
                    if (!ggusMethod) return
                    setSelectedMethod(ggusMethod)
                    setGgusOnePayPreset(preset)
                    setGgusOnePayModalOpen(true)
                  }

                  return (
                    <div className={gridCls}>
                      {cryptoMethods.map(m => (
                        <MethodCard key={m.id}
                          featured
                          onClick={() => {
                            setSelectedMethod(m)
                            setCryptoModalOpen(true)
                          }}
                          tile={<BrandIcon kind="crypto" className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                          badge={
                            <span className="text-[11px] font-bold px-1.5 sm:px-2 py-1 rounded-full whitespace-nowrap text-black" style={{ background: '#FFB800', boxShadow: '0 0 10px rgba(255,184,0,0.25)' }}>+20% Bonus</span>
                          }
                          title="Cryptocurrency"
                          desc={<>BTC, ETH, USDT &amp; 100+ coins</>}
                        />
                      ))}

                      {chimeGroup.length > 0 && renderGroup('chime', chimeGroup, 'Chime', 'Send via Chime — fast & easy')}
                      {cashappGroup.length > 0 && renderGroup('cashapp', cashappGroup, 'CashApp Pay', 'Send via Cash App — fast & easy')}
                      {paypalMethods.map(renderMethod)}
                      {venmoMethods.map(renderMethod)}

                      {ggusMethod && (
                        <Fragment>
                          <MethodCard
                            onClick={() => openGgusWith('applepay')}
                            tile={<BrandIcon kind="applepay" className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                            title="Apple Pay"
                            desc={<>Tap &amp; pay instantly with Apple Pay</>}
                          />
                          <MethodCard
                            onClick={() => openGgusWith('googlepay')}
                            tile={<BrandIcon kind="googlepay" className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                            title="Google Pay"
                            desc="Fast checkout with Google Pay"
                          />
                          <MethodCard
                            onClick={() => openGgusWith('card')}
                            tile={<BrandIcon kind="card" className="!w-10 !h-10 sm:!w-12 sm:!h-12" />}
                            title="Debit Card"
                            desc="Pay securely with your debit card"
                          />
                          <MethodCard
                            onClick={() => openGgusWith(undefined)}
                            tile={
                              <Cluster items={[
                                { bg: '#22C55E', node: '$' },
                                { bg: '#0EA5E9', node: 'Z' },
                                { bg: '#1D4ED8', node: 'P' },
                                { bg: '#475569', node: <span className="text-[12px]">+4</span> },
                              ]} />
                            }
                            title="Payment Apps"
                            desc={<>CashApp, Apple Pay, Google Pay &amp; more</>}
                          />
                        </Fragment>
                      )}

                      {others.map(renderMethod)}
                    </div>
                  )
                })()
              )}
            </div>
          )}

          {/* STEP 2 — Enter Amount */}
          {step === 2 && selectedMethod && (() => {
            return (
              <Card className="max-w-lg space-y-5 !p-5 sm:!p-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 h-10 -ml-2 px-2 rounded-xl text-[14px] font-medium text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="flex items-center gap-3.5 min-w-0">
                  <BrandIcon kind={selectedMethod.code || selectedMethod.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-primary leading-snug truncate">{selectedMethod.name}</p>
                    <p className="text-[13px] text-muted tabular-nums">Min: ${selectedMethod.minAmount} · Max: ${selectedMethod.maxAmount.toLocaleString()}</p>
                  </div>
                </div>

                {selectedMethod.instructions && (
                  <p className="text-[13.5px] leading-relaxed text-secondary bg-surface-elevated rounded-2xl p-3.5 border border-border-subtle break-words">
                    {selectedMethod.instructions}
                  </p>
                )}

                <Field label="Deposit Amount (USD)">
                  <div className="relative">
                    <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-[26px] font-bold text-muted leading-none">$</span>
                    <input
                      type="number" inputMode="decimal" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder={`Min $${selectedMethod.minAmount}`}
                      className="ds-input !h-16 !pl-10 !pr-4 !text-[28px] !font-bold tabular-nums"
                      min={selectedMethod.minAmount}
                      max={selectedMethod.maxAmount}
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 250, 500].map(amt => {
                    const on = depositAmount === String(amt)
                    return (
                      <button key={amt} type="button" onClick={() => setDepositAmount(String(amt))}
                        aria-pressed={on}
                        className={cn(
                          'h-11 rounded-xl text-[14px] font-semibold tabular-nums border transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                          on ? 'text-primary border-transparent' : 'bg-surface-elevated border-border-subtle text-secondary hover:text-primary hover:border-border-strong'
                        )}
                        style={on ? { background: 'rgba(56,189,248,0.16)', boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.45)' } : undefined}>
                        ${amt}
                      </button>
                    )
                  })}
                </div>

                <Button variant="primary" size="md" full onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Continue to payment'}
                </Button>
              </Card>
            )
          })()}

          {/* STEP 3 — Success */}
          {step === 3 && selectedMethod && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="max-w-lg text-center !p-6 sm:!p-8">
                <IconTile icon={CheckCircle2} tone="green" size="lg" className="mx-auto mb-4 !rounded-full" />
                <h3 className="text-xl font-bold text-primary tracking-tight mb-2">
                  Payment request created
                </h3>
                <p className="text-secondary text-[14px] leading-relaxed mb-6">
                  Your deposit request for <span className="text-primary font-semibold">${depositAmount}</span> via {selectedMethod.name} has been submitted.
                </p>
                <div className="rounded-2xl bg-surface-elevated border border-border-subtle p-4 text-left mb-5 space-y-3 text-[14px]">
                  <div className="flex justify-between items-center gap-3"><span className="text-muted">Method</span><span className="text-primary font-medium truncate">{selectedMethod.name}</span></div>
                  <div className="flex justify-between items-center gap-3"><span className="text-muted">Amount</span><span className="text-primary font-semibold tabular-nums">${depositAmount}</span></div>
                  <div className="flex justify-between items-center gap-3"><span className="text-muted">Status</span><StatusBadge status="pending" /></div>
                </div>
                <p className="text-[13px] text-muted mb-5">
                  Our team will review and approve your deposit within 1–24 hours.
                </p>
                <div className="flex flex-col-reverse min-[420px]:flex-row gap-3">
                  <Button variant="secondary" full onClick={() => setTab('history')} className="min-[420px]:flex-1">View History</Button>
                  <Button variant="primary" full onClick={resetForm} className="min-[420px]:flex-1">New Deposit</Button>
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card padded={false} className="overflow-hidden">
            {/* Column header (desktop only) */}
            <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_110px_130px_110px] gap-4 px-6 py-3.5 border-b border-border-subtle text-[13px] font-medium text-muted">
              <span>Reference</span><span>Method</span><span className="text-right">Amount</span><span>Status</span><span className="text-right">Date</span>
            </div>

            {historyLoading ? (
              <div className="divide-y divide-border-subtle">
                {Array(5).fill(0).map((_, i) => (
                  <div key={`skel-tx-${i}`} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32 !rounded-md" />
                      <Skeleton className="h-3 w-24 !rounded-md" />
                    </div>
                    <Skeleton className="h-6 w-20 !rounded-full" />
                  </div>
                ))}
              </div>
            ) : depositHistory.length === 0 ? (
              <EmptyState icon={History} title="No deposits yet." text="Your deposit requests will show up here." />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {depositHistory.map((tx: any) => {
                  const ref = tx.paymentReference || tx.id.slice(0, 10)
                  const methodName = tx.paymentMethod?.name || tx.currency
                  const amount = `$${tx.amount.toFixed(2)}`
                  const date = new Date(tx.createdAt).toLocaleDateString()
                  return (
                    <li key={tx.id} className="px-4 sm:px-6 py-4">
                      {/* Mobile: stacked card row */}
                      <div className="md:hidden grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 items-center">
                        <p className="text-[15px] font-semibold text-primary truncate">{methodName}</p>
                        <p className="text-[15px] font-bold text-primary tabular-nums text-right">{amount}</p>
                        <p className="text-[12.5px] text-muted truncate"><span className="font-mono">{ref}</span> · {date}</p>
                        <StatusBadge status={tx.status} />
                      </div>
                      {/* Desktop: aligned columns */}
                      <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_110px_130px_110px] gap-4 items-center">
                        <span className="font-mono text-[13px] text-secondary truncate">{ref}</span>
                        <span className="text-[14px] text-primary truncate">{methodName}</span>
                        <span className="text-[15px] font-semibold text-primary tabular-nums text-right">{amount}</span>
                        <span><StatusBadge status={tx.status} /></span>
                        <span className="text-[13px] text-muted text-right tabular-nums">{date}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </motion.div>
      )}


      <ChimePayPalDepositModal
        isOpen={chimePayPalMethod !== null}
        onClose={() => {
          setChimePayPalMethod(null)
          fetchHistory()
        }}
        method={chimePayPalMethod}
      />

      {selectedMethod && (
        <CryptoDepositModal
          isOpen={cryptoModalOpen}
          onClose={() => {
            setCryptoModalOpen(false)
            fetchHistory()
            resetForm()
          }}
          amount={parseFloat(depositAmount) || 0}
          paymentMethodId={selectedMethod.id}
        />
      )}

      {selectedMethod && (
        <GgusOnePayModal
          isOpen={ggusOnePayModalOpen}
          onClose={() => {
            setGgusOnePayModalOpen(false)
            fetchHistory()
            resetForm()
          }}
          paymentMethodId={selectedMethod.id}
          preset={ggusOnePayPreset}
          onSuccess={() => {
            setGgusOnePayModalOpen(false)
            setTab('history')
            fetchHistory()
            resetForm()
          }}
        />
      )}
    </div>
  )
}

export default function DepositsPage() {
  return (
    <Suspense fallback={<div className="pb-10"><Skeleton className="h-8 w-40" /></div>}>
      <DepositsContent />
    </Suspense>
  )
}
