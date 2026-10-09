/**
 * Round 3: how is /admin/modifypw (the panel's real reset call) used? Run on the VPS:
 *   npx tsx scripts/probe-cash-modifypw.ts
 *
 * Reads the panel page's own script around the call, then tries the call with player id 0 (does not exist) in the
 * likely formats, using the API token. No real account can change. Prints status codes and short provider messages
 * only; long token-like strings in the page snippet are masked. Delete this file afterwards.
 */
import axios from 'axios'
import FormData from 'form-data'
import prisma from '../src/lib/prisma'
import { ProviderFactory } from '../src/services/provider/ProviderFactory'

const brief = (d: any) => (typeof d === 'string' ? `[text ${d.length}b] ${d.replace(/\s+/g, ' ').slice(0, 80)}` : JSON.stringify(d).slice(0, 120))
const mask = (s: string) => s.replace(/[A-Za-z0-9+/=_-]{24,}/g, '…')

;(async () => {
  for (const name of ['Cash Frenzy', 'Cashmachine']) {
    console.log(`\n=== ${name}`)
    const p = await prisma.provider.findFirst({ where: { name }, select: { id: true } })
    if (!p) { console.log('provider not found'); continue }
    const svc: any = await ProviderFactory.getProviderById(p.id)
    await svc.authenticate()
    const base: string = svc.baseUrl
    const common = { timeout: 20000, httpsAgent: svc.httpsAgent, validateStatus: () => true, maxRedirects: 0 }
    const bearer = { Authorization: `Bearer ${svc.token}`, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }

    // The panel page's own code that performs the reset
    const page = await axios.get(`${base}/admin/player/resetpw?id=0`, { ...common, headers: { Accept: 'text/html' } })
    if (typeof page.data === 'string') {
      const i = page.data.indexOf('modifypw')
      if (i >= 0) console.log('page script:', mask(page.data.slice(Math.max(0, i - 450), i + 450)).replace(/\s+/g, ' '))
      else console.log('page has no "modifypw"')
    }

    const url = `${base}/admin/modifypw`
    const body = { id: 0, password: 'NxProbe1234abc', password_confirmation: 'NxProbe1234abc' }
    const o = await axios.request({ ...common, method: 'OPTIONS', url, headers: bearer })
    console.log(`OPTIONS            → ${o.status} allow=[${o.headers['allow'] || ''}]`)
    const g = await axios.get(url, { ...common, headers: bearer })
    console.log(`GET                → ${g.status} ${brief(g.data)}`)
    const pj = await axios.post(url, body, { ...common, headers: bearer })
    console.log(`POST json + token  → ${pj.status} ${brief(pj.data)}`)
    const form = new FormData(); for (const [k, v] of Object.entries(body)) form.append(k, String(v))
    const pf = await axios.post(url, form, { ...common, headers: { ...form.getHeaders(), ...bearer } })
    console.log(`POST form + token  → ${pf.status} ${brief(pf.data)}`)
    const pn = await axios.post(url, body, { ...common, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
    console.log(`POST json no token → ${pn.status} ${brief(pn.data)}`)
  }
  await prisma.$disconnect()
  process.exit(0)
})().catch(e => { console.log('ERR', String(e.message).slice(0, 200)); process.exit(0) })
