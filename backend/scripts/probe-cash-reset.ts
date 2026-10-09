/**
 * Safe live check of the Cash Machine / Cash Frenzy "Reset password" call. Run it on the VPS (the providers only
 * accept that server's IP):  npx tsx scripts/probe-cash-reset.ts
 *
 * It asks the provider to reset the password of player id 0, which does not exist, so no real account can change.
 * What the output means:
 *   returned false            → the provider has no such endpoint (the site then keeps the existing game password)
 *   threw "Provider Error: …"  → the endpoint exists and answered (e.g. "player not found") — this is the GOOD result
 *   anything about connection → network / IP whitelist problem, not the endpoint
 * Delete this file afterwards.
 */
import prisma from '../src/lib/prisma'
import { ProviderFactory } from '../src/services/provider/ProviderFactory'

;(async () => {
  for (const name of ['Cash Frenzy', 'Cashmachine']) {
    const p = await prisma.provider.findFirst({ where: { name }, select: { id: true } })
    if (!p) { console.log(`${name}: provider not found`); continue }
    try {
      const svc: any = await ProviderFactory.getProviderById(p.id)
      const r = await svc.resetPlayerPassword('0', svc.generateResetPassword?.() ?? 'NxProbe1234abc', { interactive: true })
      console.log(`${name}: returned ${r}`)
    } catch (e: any) {
      console.log(`${name}: threw -> ${String(e.message).slice(0, 220)} (status ${e.statusCode ?? '-'})`)
    }
  }
  await prisma.$disconnect()
  process.exit(0)
})().catch(e => { console.log('ERR', String(e.message).slice(0, 200)); process.exit(0) })
