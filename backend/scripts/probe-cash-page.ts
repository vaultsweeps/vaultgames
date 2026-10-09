/**
 * Round 4: read how the provider's own "reset player password" page submits its form. Run on the VPS:
 *   npx tsx scripts/probe-cash-page.ts
 *
 * Read-only: it only downloads the panel page and the script files it references (public static files) and prints
 * the code around the reset logic, with long token-like strings masked. Nothing is sent to any player account.
 * Delete this file afterwards.
 */
import axios from 'axios'
import prisma from '../src/lib/prisma'
import { ProviderFactory } from '../src/services/provider/ProviderFactory'

const mask = (s: string) => s.replace(/[A-Za-z0-9+/=_-]{28,}/g, '…').replace(/\s+/g, ' ')
const KEYWORDS = /resetpw|password_confirmation|resetPassword|modifypw|\.post\(|\$\.ajax|axios|fetch\(|XMLHttpRequest|layui\.form|submit/i

;(async () => {
  const p = await prisma.provider.findFirst({ where: { name: 'Cash Frenzy' }, select: { id: true } })
  if (!p) { console.log('Cash Frenzy provider not found'); process.exit(0) }
  const svc: any = await ProviderFactory.getProviderById(p.id)
  const base: string = svc.baseUrl
  const common = { timeout: 20000, httpsAgent: svc.httpsAgent, validateStatus: () => true, headers: { Accept: '*/*' } }

  const page = await axios.get(`${base}/admin/player/resetpw?id=0`, common)
  const html: string = typeof page.data === 'string' ? page.data : ''
  console.log(`page: ${page.status}, ${html.length} bytes`)

  // 1) inline scripts of the page itself
  const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim()).filter(Boolean)
  inline.forEach((code, i) => console.log(`\n--- inline script #${i + 1} (${code.length} chars)\n${mask(code).slice(0, 1800)}`))

  // 2) the form markup (structure only)
  const formHtml = /<form[\s\S]*?<\/form>/i.exec(html)?.[0] || ''
  if (formHtml) console.log(`\n--- form markup\n${mask(formHtml).slice(0, 1500)}`)

  // 3) external scripts: show the code around the reset logic
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => m[1])
  console.log(`\nscript files: ${srcs.join(' , ')}`)
  for (const src of srcs) {
    const url = new URL(src, base + '/').toString()
    if (!url.startsWith(base)) continue // only the provider's own files
    const r = await axios.get(url, common)
    const js: string = typeof r.data === 'string' ? r.data : ''
    const hits: { idx: number; text: string }[] = []
    for (const m of js.matchAll(new RegExp(KEYWORDS.source, 'gi'))) {
      const i = m.index || 0
      if (hits.some(h => Math.abs(h.idx - i) < 300)) continue
      hits.push({ idx: i, text: mask(js.slice(Math.max(0, i - 200), i + 300)) })
      if (hits.length >= 4) break
    }
    console.log(`\n--- ${src} → ${r.status}, ${js.length} bytes, ${hits.length} hit(s)`)
    hits.forEach(h => console.log('   …' + h.text + '…'))
  }
  await prisma.$disconnect()
  process.exit(0)
})().catch(e => { console.log('ERR', String(e.message).slice(0, 200)); process.exit(0) })
