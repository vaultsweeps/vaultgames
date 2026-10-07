/**
 * One-off: pay the referral rewards that were missed because some deposit-approval paths (the Telegram Approve
 * button and the payment webhooks) never triggered them.
 *
 * Finds every referred player who has NO ReferralReward yet but has an approved deposit, and pays the referrer the
 * normal tiered reward ($5 if the first approved deposit is under $10, otherwise $10) into their Bonus Balance —
 * through the same idempotent gate as live rewards, so it can never pay the same player twice and the abuse checks
 * (same phone / same IP+time) still apply.
 *
 *   npx tsx scripts/backfill-referral-rewards.ts                      preview only — changes nothing
 *   npx tsx scripts/backfill-referral-rewards.ts --only=<username>    preview a single referred player
 *   npx tsx scripts/backfill-referral-rewards.ts --confirm            pay them
 *   npx tsx scripts/backfill-referral-rewards.ts --only=<username> --confirm
 */
import prisma from '../src/lib/prisma'
import { ReferralService, computeReferralBonusAmount } from '../src/services/ReferralService'

const confirm = process.argv.includes('--confirm')
const only = process.argv.find(a => a.startsWith('--only='))?.slice('--only='.length)

;(async () => {
  const referred = await prisma.user.findMany({
    where: { referredById: { not: null }, ...(only ? { username: { equals: only, mode: 'insensitive' as const } } : {}) },
    select: { id: true, username: true, referredById: true, referredBy: { select: { username: true } } },
  })

  let due = 0
  for (const u of referred) {
    const existing = await prisma.referralReward.findFirst({ where: { refereeId: u.id }, select: { id: true } })
    if (existing) continue
    const first = await prisma.deposit.findFirst({
      where: { userId: u.id, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
      select: { id: true, amount: true, approvedAt: true },
    })
    if (!first) continue

    due++
    const reward = computeReferralBonusAmount(first.amount)
    console.log(`${u.username} (referred by ${u.referredBy?.username}) — first approved deposit $${first.amount} on ${first.approvedAt?.toISOString().slice(0, 10)} → reward $${reward}`)
    if (!confirm) continue

    const res = await ReferralService.grantReferralReward({
      referrerId: u.referredById!,
      refereeId: u.id,
      amount: reward,
      triggerSource: 'first_deposit',
      triggerDepositId: first.id,
    })
    console.log(`   ${res.granted ? 'PAID' : res.flagged ? 'FLAGGED for review (not paid)' : 'not paid (already exists or invalid)'}`)
  }

  console.log(due === 0
    ? 'Nothing to do — no referred player is missing a reward.'
    : confirm ? `Done. ${due} player(s) processed.` : `\n${due} reward(s) due. Nothing was changed — re-run with --confirm to pay them.`)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
