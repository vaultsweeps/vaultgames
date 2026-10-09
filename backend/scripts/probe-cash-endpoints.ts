/**
 * Finds which "reset password" address the Cash Machine / Cash Frenzy API really has. Run on the VPS:
 *   npx tsx scripts/probe-cash-endpoints.ts
 *
 * Every call targets player id 0, which does not exist, so no real account can change. For each candidate address it
 * prints the HTTP status of OPTIONS (which methods are allowed) and of a POST. Meaning of the status:
 *   404 → no such address     405 → address exists but not for that method (see "allow")
 *   200/400/422/401 with a JSON message → the address exists and answered
 * Delete this file afterwards. Nothing is printed except status codes, allowed methods and short provider messages.
 */
import axios from 'axios'
import FormData from 'form-data'
import prisma from '../src/lib/prisma'
import { ProviderFactory } from '../src/services/provider/ProviderFactory'

const PATHS = [
  '/admin/player/resetpw',
  '/api/player/resetpw',
  '/api/player/resetPw',
  '/api/player/resetPassword',
  '/api/player/reset_password',
  '/api/player/resetPasswd',
  '/api/player/updatePassword',
  '/api/player/changePassword',
  '/api/player/changePasswd',
  '/api/player/updatePlayer',
  '/api/player/editPlayer',
  '/api/player/resetPlayerPassword',
  '/api/player/insertPlayer', // known to exist — control, to see what a "good" answer looks like
]

const brief = (d: any) => (typeof d === 'string' ? `[text ${d.length}b]` : JSON.stringify(d).slice(0, 110))

;(async () => {
  const p = await prisma.provider.findFirst({ where: { name: 'Cash Frenzy' }, select: { id: true } })
  if (!p) { console.log('Cash Frenzy provider not found'); process.exit(0) }
  const svc: any = await ProviderFactory.getProviderById(p.id)
  await svc.authenticate()
  const base: string = svc.baseUrl
  const common = { timeout: 20000, httpsAgent: svc.httpsAgent, validateStatus: () => true }
  const auth = { Authorization: `Bearer ${svc.token}`, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }

  for (const path of PATHS) {
    try {
      const opt = await axios.request({ ...common, method: 'OPTIONS', url: base + path, headers: auth })
      const form = new FormData()
      form.append('id', '0'); form.append('password', 'NxProbe1234abc'); form.append('password_confirmation', 'NxProbe1234abc')
      const post = await axios.post(base + path, form, { ...common, headers: { ...form.getHeaders(), ...auth } })
      console.log(`${path.padEnd(34)} OPTIONS ${opt.status} allow=[${opt.headers['allow'] || ''}] | POST ${post.status} ${brief(post.data)}`)
    } catch (e: any) {
      console.log(`${path.padEnd(34)} error ${e.code || e.message}`)
    }
  }
  await prisma.$disconnect()
  process.exit(0)
})().catch(e => { console.log('ERR', String(e.message).slice(0, 200)); process.exit(0) })
