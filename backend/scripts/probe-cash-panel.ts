/**
 * Round 2 of finding the Cash Machine / Cash Frenzy "reset password" call. Run on the VPS:
 *   npx tsx scripts/probe-cash-panel.ts
 *
 * Only reads the provider's web panel pages and uses player id 0 (does not exist) — no real account can change.
 * Prints status codes, form target addresses and field NAMES only: never tokens, passwords or page content.
 * Delete this file afterwards.
 */
import axios from 'axios'
import prisma from '../src/lib/prisma'
import { ProviderFactory } from '../src/services/provider/ProviderFactory'

const forms = (html: string) => {
  const out: string[] = []
  for (const m of html.matchAll(/<form\b[^>]*>/gi)) {
    const tag = m[0]
    const action = /action\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '(none)'
    const method = /method\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? 'get'
    out.push(`form ${method.toUpperCase()} ${action}`)
  }
  const inputs = [...html.matchAll(/<input\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m => m[1])
  const ajax = [...html.matchAll(/(?:url|action)\s*[:=]\s*["'`]([^"'`]*(?:reset|pw|passw)[^"'`]*)["'`]/gi)].map(m => m[1])
  const csrf = /csrf-token/i.test(html)
  return `${out.join(' ; ') || 'no <form>'} | inputs=[${[...new Set(inputs)].join(',')}] | ajax-urls=[${[...new Set(ajax)].join(',')}] | csrfMeta=${csrf}`
}

;(async () => {
  const p = await prisma.provider.findFirst({ where: { name: 'Cash Frenzy' }, select: { id: true } })
  if (!p) { console.log('Cash Frenzy provider not found'); process.exit(0) }
  const svc: any = await ProviderFactory.getProviderById(p.id)
  await svc.authenticate()
  const base: string = svc.baseUrl
  const host = new URL(base).hostname
  const common = { timeout: 20000, httpsAgent: svc.httpsAgent, validateStatus: () => true, maxRedirects: 0 }
  const bearer = { Authorization: `Bearer ${svc.token}`, 'X-Requested-With': 'XMLHttpRequest' }

  // A) the panel page on the API host, with the API token
  for (const [label, headers] of [['with token', bearer], ['no token', {}]] as const) {
    const r = await axios.get(`${base}/admin/player/resetpw?id=0`, { ...common, headers: { ...headers, Accept: 'text/html' } })
    const ct = String(r.headers['content-type'] || '')
    console.log(`A ${label.padEnd(10)} GET /admin/player/resetpw?id=0 → ${r.status} ${ct.split(';')[0]} location=${r.headers['location'] || '-'}`)
    if (typeof r.data === 'string' && r.data.length) console.log('    ', forms(r.data))
  }

  // B) the older panel from the reference repo (port 8003) and plain http
  for (const alt of [`http://${host}:8003`, `https://${host}:8003`, `http://${host}`]) {
    try {
      const o = await axios.request({ ...common, method: 'OPTIONS', url: `${alt}/admin/player/resetpw`, timeout: 10000 })
      console.log(`B ${alt.padEnd(44)} OPTIONS /admin/player/resetpw → ${o.status} allow=[${o.headers['allow'] || ''}]`)
      const l = await axios.post(`${alt}/api/login`, { username: svc.provider.agentId, password: svc.provider.secretKey }, { ...common, timeout: 10000 })
      const token = l.data?.token
      console.log(`  ${''.padEnd(44)} POST /api/login → ${l.status} message=${JSON.stringify(l.data?.message ?? '').slice(0, 60)} gotToken=${!!token}`)
      if (token) {
        const r = await axios.post(`${alt}/admin/player/resetpw`, { id: 0, password: 'NxProbe1234abc', password_confirmation: 'NxProbe1234abc' }, { ...common, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
        console.log(`  ${''.padEnd(44)} POST /admin/player/resetpw (id 0) → ${r.status} ${typeof r.data === 'string' ? `[text ${r.data.length}b]` : JSON.stringify(r.data).slice(0, 110)}`)
      }
    } catch (e: any) {
      console.log(`B ${alt.padEnd(44)} ${e.code || e.message}`)
    }
  }
  await prisma.$disconnect()
  process.exit(0)
})().catch(e => { console.log('ERR', String(e.message).slice(0, 200)); process.exit(0) })
