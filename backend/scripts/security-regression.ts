/**
 * Security regression suite. Run: npx tsx scripts/security-regression.ts
 * No database, network or real credentials are used; exits non-zero on any failure.
 */
import express from 'express'
import http from 'http'
import axios from 'axios'
import { limit, serializePerUser, idempotency, parseMoney } from '../src/middleware/security'
import proxyRouter from '../src/routes/proxy'
import { redactForLog } from '../src/services/provider/ProviderLogService'

import { extraChecks } from './security-regression-units'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function serve(app: express.Express): Promise<{ url: string; close: () => void }> {
  return new Promise(res => { const s = http.createServer(app).listen(0, '127.0.0.1', () => res({ url: `http://127.0.0.1:${(s.address() as any).port}`, close: () => s.close() })) })
}
const post = (url: string, body: any, headers: Record<string, string> = {}) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) as any, headers: r.headers }))

;(async () => {
  const fakeAuth = (req: any, _res: any, next: any) => { req.user = { id: req.header('x-user') || 'u1', role: 'user', email: 'x' }; next() }

  // 1. wallet lock + idempotency
  let runs = 0
  const app = express(); app.use(express.json()); app.use(fakeAuth)
  app.post('/transfer', idempotency('transfer'), serializePerUser('wallet'), async (_req, res) => { runs++; await sleep(300); res.json({ success: true, n: runs }) })
  const s1 = await serve(app)
  const par = await Promise.all([post(s1.url + '/transfer', {}), post(s1.url + '/transfer', {}), post(s1.url + '/transfer', {}), post(s1.url + '/transfer', {})])
  const codes = par.map(r => r.status).sort()
  check('parallel requests from ONE user: only one runs, others get 409', runs === 1 && codes.filter(c => c === 200).length === 1 && codes.filter(c => c === 409).length === 3, `codes=${codes} handlerRuns=${runs}`)
  const other = await Promise.all([post(s1.url + '/transfer', {}, { 'x-user': 'a' }), post(s1.url + '/transfer', {}, { 'x-user': 'b' })])
  check('different users are NOT blocked by each other', other.every(r => r.status === 200), `codes=${other.map(r => r.status)}`)
  await sleep(50)
  const after = await post(s1.url + '/transfer', {})
  check('lock is released after the request finishes', after.status === 200, `status=${after.status}`)
  runs = 0
  const k = { 'Idempotency-Key': 'key-abcdef123456' }
  const first = await post(s1.url + '/transfer', {}, k); const replay = await post(s1.url + '/transfer', {}, k)
  check('same Idempotency-Key replays the result, handler runs once', runs === 1 && replay.status === 200 && replay.headers.get('idempotent-replay') === 'true' && replay.body.n === first.body.n, `runs=${runs}`)
  const concurrentKey = { 'Idempotency-Key': 'key-concurrent-99' }; runs = 0
  await sleep(350)
  const cc = await Promise.all([post(s1.url + '/transfer', {}, concurrentKey, ), post(s1.url + '/transfer', {}, concurrentKey)])
  check('same key sent concurrently: one runs, other rejected', runs === 1 && cc.map(r => r.status).sort().join() === '200,409', `codes=${cc.map(r => r.status)} runs=${runs}`)
  const badKey = await post(s1.url + '/transfer', {}, { 'Idempotency-Key': 'x' })
  check('malformed Idempotency-Key rejected (400)', badKey.status === 400)
  s1.close()

  // 2. rate limits
  const app2 = express(); app2.use(express.json()); app2.use(fakeAuth)
  app2.post('/u', limit({ name: 't-user', windowMs: 60000, max: 3, scope: 'user' }), (_q, r) => { r.json({ ok: 1 }) })
  app2.post('/login', limit({ name: 't-login', windowMs: 60000, max: 3, scope: 'identity', identityField: 'email', failedOnly: true }), (q, r) => { q.body.password === 'good' ? r.json({ ok: 1 }) : r.status(401).json({ success: false }) })
  const s2 = await serve(app2)
  const us: number[] = []; for (let i = 0; i < 5; i++) us.push((await post(s2.url + '/u', {})).status)
  check('per-user limit: 4th+ request gets 429', us.join() === '200,200,200,429,429', us.join())
  const otherU = await post(s2.url + '/u', {}, { 'x-user': 'someone-else' })
  check('per-user limit does not affect other users', otherU.status === 200)
  const lg: number[] = []; for (let i = 0; i < 5; i++) lg.push((await post(s2.url + '/login', { email: 'victim@x.com', password: 'bad' })).status)
  check('brute force on ONE account: locked after 3 failures', lg.join() === '401,401,401,429,429', lg.join())
  const lgOther = await post(s2.url + '/login', { email: 'other@x.com', password: 'bad' })
  check('another account is not locked out by that attacker', lgOther.status === 401)
  const lgVictimCase = await post(s2.url + '/login', { email: '  VICTIM@x.com ', password: 'good' })
  check('identity key is case/space-insensitive (cannot dodge with VICTIM@x.com)', lgVictimCase.status === 429, `status=${lgVictimCase.status}`)
  const okLogins: number[] = []; for (let i = 0; i < 6; i++) okLogins.push((await post(s2.url + '/login', { email: 'real@x.com', password: 'good' })).status)
  check('successful logins are not counted against the limit', okLogins.every(s => s === 200), okLogins.join())
  s2.close()

  // 3. IP limiter behind an unconfigured proxy must not lock everyone out
  const prevEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'production'
  const app3 = express(); app3.use(express.json())
  app3.post('/ip', limit({ name: 't-ip', windowMs: 60000, max: 2, scope: 'ip' }), (_q, r) => { r.json({ ok: 1 }) })
  const s3 = await serve(app3)
  const ips: number[] = []; for (let i = 0; i < 5; i++) ips.push((await post(s3.url + '/ip', {})).status)
  check('IP-only limit is skipped when only a private/proxy IP is visible (no site-wide lockout)', ips.every(s => s === 200), ips.join())
  s3.close(); process.env.NODE_ENV = prevEnv
  const app3b = express(); app3b.use(express.json())
  app3b.post('/ip', limit({ name: 't-ip2', windowMs: 60000, max: 2, scope: 'ip' }), (_q, r) => { r.json({ ok: 1 }) })
  const s3b = await serve(app3b)
  const ips2: number[] = []; for (let i = 0; i < 4; i++) ips2.push((await post(s3b.url + '/ip', {})).status)
  check('IP limit still enforced when the client IP is usable (non-production)', ips2.join() === '200,200,429,429', ips2.join())
  s3b.close()

  // 4. amount validation
  const cases: Array<[any, number | null]> = [[10, 10], ['10', 10], ['10.555', 10.56], [10.999, 11], [0, null], [-5, null], ['-5', null], ['abc', null], [NaN, null], [Infinity, null], [1e30, null], ['1e30', null], [null, null], [undefined, null], [{}, null], [[5], null], [true, null], ['', null], [100001, null], [100000, 100000], ['0.001', null]]
  const bad = cases.filter(([v, exp]) => parseMoney(v) !== exp).map(([v, exp]) => `${JSON.stringify(v)}=>${parseMoney(v)} (want ${exp})`)
  check(`amount validation (${cases.length} cases incl. NaN/Infinity/negative/string/object/huge)`, bad.length === 0, bad.join('; '))

  // 5. DollarPay proxy reflected XSS
  ;(axios as any).get = async () => ({ data: '<html><head></head><body><script>const initialAmount = "";</script><input value="" required></body></html>' })
  const app5 = express(); app5.use(express.json()); app5.use('/api/proxy', proxyRouter)
  const s5 = await serve(app5)
  const evil = await fetch(s5.url + '/api/proxy/dollarpay-proxy?amount=' + encodeURIComponent('1";alert(document.domain);//') + '&name=' + encodeURIComponent('"><img src=x onerror=alert(1)>'))
  const html = await evil.text()
  check('proxy: script-breaking "amount" is not injected', !html.includes('alert(document.domain)') && html.includes('const initialAmount = "";'))
  check('proxy: "name" cannot break out of the attribute', !html.includes('<img'), html.slice(html.indexOf('<input'), html.indexOf('<input') + 90))
  const good = await (await fetch(s5.url + '/api/proxy/dollarpay-proxy?amount=25.50&name=John%20Doe')).text()
  check('proxy: a normal amount and name still work', good.includes('const initialAmount = "25.50"') && good.includes('value="John Doe" required'))
  s5.close()

  // 6. log redaction
  const red: any = redactForLog({ account: 'abc', passwd: 'md5hash', password: 'Default123!', nested: { agentkey: 'SECRETKEY', sign: 'sig', amount: 5 }, url: '/ws/service.ashx?action=x&agentName=a&sign=deadbeef&time=1' })
  check('provider log redaction masks passwords/keys/signatures but keeps business fields', red.passwd === '[REDACTED]' && red.password === '[REDACTED]' && red.nested.agentkey === '[REDACTED]' && red.nested.sign === '[REDACTED]' && red.nested.amount === 5 && red.account === 'abc' && !red.url.includes('deadbeef') && red.url.includes('action=x'), JSON.stringify(red))

  await extraChecks(check)

  console.log(results.join('\n'))
  console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`)
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0)
})()
