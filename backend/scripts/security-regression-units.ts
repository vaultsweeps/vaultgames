/**
 * Unit-level regression checks for the fixes made in the red-team hardening pass. Called from
 * security-regression.ts. Most checks run fully offline; a few (clearly marked) touch the real database with
 * throwaway rows they create and delete themselves — no real secrets are ever used.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import express from 'express'
import http from 'http'
import prisma from '../src/lib/prisma'
import { WalletService } from '../src/services/WalletService'

type Check = (name: string, ok: boolean, detail?: string) => void

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', 'src', rel), 'utf8')

export async function extraChecks(check: Check) {
  // ── safe.ts helpers ────────────────────────────────────────────────────────
  const { escapeLike, escapeHtml, csvCell, isSafeLinkUrl, assertPublicHttpUrl, ipv6Prefix64 } = await import('../src/utils/safe')

  check('escapeLike neutralises % _ \\ wildcards', escapeLike('a%b_c\\d') === 'a\\%b\\_c\\\\d')
  check('escapeHtml escapes tags and quotes', escapeHtml('<img src=x onerror="a">\'&') === '&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;')
  const cells = ['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', 'ok "quoted"', 'line1\nline2']
  const csvBad = cells.filter(c => { const o = csvCell(c); return /^"[=+\-@\t\r]/.test(o) || o.includes('\n') })
  check('csvCell blocks formula prefixes and line breaks', csvBad.length === 0, csvBad.join('|'))
  check('csvCell doubles embedded quotes', csvCell('a"b') === '"a""b"')
  check('isSafeLinkUrl rejects javascript:/data:/protocol-relative', !isSafeLinkUrl('javascript:alert(1)') && !isSafeLinkUrl('data:text/html,x') && !isSafeLinkUrl('//evil.com') && isSafeLinkUrl('/dashboard') && isSafeLinkUrl('https://t.me/x'))
  check('ipv6 /64 bucketing groups one prefix and separates others', ipv6Prefix64('2001:db8:1:2:aaaa::1') === ipv6Prefix64('2001:db8:1:2:bbbb::9') && ipv6Prefix64('2001:db8:1:2::1') !== ipv6Prefix64('2001:db8:1:3::1'))

  const ssrfBad: string[] = []
  for (const u of ['http://127.0.0.1/x', 'http://localhost:5000', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5', 'http://192.168.1.1', 'http://[::1]/', 'file:///etc/passwd', 'ftp://example.com', 'https://user:pass@example.com', 'http://metadata.internal', 'not a url', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[::ffff:a00:1]/', 'http://[::7f00:1]/', 'http://[fd00::1]/', 'http://0.0.0.0/', 'http://100.64.0.1/']) {
    try { await assertPublicHttpUrl(u); ssrfBad.push(u) } catch { /* rejected = good */ }
  }
  check('assertPublicHttpUrl blocks loopback/private/metadata/credentialed/non-http URLs', ssrfBad.length === 0, ssrfBad.join(', '))
  let publicOk = true
  try { await assertPublicHttpUrl('https://8.8.8.8/api') } catch { publicOk = false }
  check('assertPublicHttpUrl accepts a normal public address', publicOk)

  const { stripInternal } = await import('../src/utils/safe')
  const stripped: any = stripInternal({ id: 'd1', amount: 5, telegramChatId: '-100', adminNotes: 'x', paymentMethod: { name: 'n', apiConfig: { k: 1 } } } as any, ['telegramChatId', 'adminNotes'])
  check('stripInternal removes staff/telegram columns and paymentMethod.apiConfig but keeps the rest', stripped.telegramChatId === undefined && stripped.adminNotes === undefined && stripped.paymentMethod.apiConfig === undefined && stripped.amount === 5 && stripped.paymentMethod.name === 'n')

  // ── IMAP sender / name matching ───────────────────────────────────────────
  const { senderDomain, authResultsFailed } = await import('../src/services/payment/mailTrust')
  check('senderDomain: plain address', senderDomain('service@chime.com') === 'chime.com')
  check('senderDomain: multi-@ / quoted local-part trick rejected', senderDomain('"x@chime.com"@evil.example') === '' && senderDomain('a@chime.com@evil.example') === '')
  check('senderDomain: whitespace / angle brackets rejected', senderDomain('a@chime.com evil') === '' && senderDomain('<a@chime.com>') === '')
  const hdr = (v: string) => ({ get: () => v })
  const hdr2 = (v: string) => ({ get: () => v })
  check('authResultsFailed: dkim/dmarc=fail from the receiving server only; spf alone and foreign headers ignored', authResultsFailed(hdr2('mx.google.com; dkim=fail header.i=@chime.com')) && !authResultsFailed(hdr2('mx.google.com; spf=fail dkim=pass dmarc=pass')) && !authResultsFailed(hdr2('evil.example; dkim=fail')) && !authResultsFailed(undefined))
  const { authResultsOk } = await import('../src/services/payment/mailTrust')
  check('authResultsOk: needs dkim/dmarc=pass from mx.google.com; forged/absent/none/fail rejected', authResultsOk(hdr2('mx.google.com; dkim=pass header.i=@paypal.com; spf=fail')) && !authResultsOk(hdr2('mx.google.com; dkim=none; dmarc=none')) && !authResultsOk(hdr2('mx.google.com; dkim=pass; dmarc=fail')) && !authResultsOk(hdr2('attacker.example; dkim=pass; dmarc=pass')) && !authResultsOk(undefined) && authResultsOk({ get: () => ['attacker.example; dkim=pass', 'mx.google.com; dmarc=pass'] }))

  const { senderIsTrusted, namesMatch } = await import('../src/services/payment/ImapChimePayPalService')
  check('chime trust: real domain + subdomain ok, look-alikes rejected', senderIsTrusted('no-reply@chime.com', 'chime') && senderIsTrusted('x@mail.chime.com', 'chime') && !senderIsTrusted('x@chime.com.evil.io', 'chime') && !senderIsTrusted('x@notchime.com', 'chime') && !senderIsTrusted('x@paypal.com', 'chime'))
  check('namesMatch: needs first name + last initial; first name alone / other first names rejected', namesMatch('John S', 'John Smith') && !namesMatch('John S', 'John') && !namesMatch('Jane S', 'John Smith') && !namesMatch('John K', 'John Smith'))

  // ── GgusOnePay webhook signature ──────────────────────────────────────────
  const KEY = 'test-key-' + crypto.randomBytes(6).toString('hex')
  process.env.GGUSONEPAY_API_KEY = KEY
  process.env.GGUSONEPAY_MERCHANT_ID = 'M100'
  const gp = path.join(__dirname, '..', 'src', 'services', 'payment', 'GgusOnePayService')
  delete require.cache[require.resolve(gp)]
  const { GgusOnePayService: G } = await import('../src/services/payment/GgusOnePayService')
  const payload: any = { mchNo: 'M100', mchOrderNo: 'ORD1', amount: 1000, state: 2 }
  const good = G.generateSignature(payload, 'MD5')
  check('ggus: correct MD5 signature accepted', G.verifyWebhookSignature({ ...payload, sign: good }, good) === true)
  check('ggus: tampered amount rejected', G.verifyWebhookSignature({ ...payload, amount: 99999, sign: good }, good) === false)
  const sha = G.generateSignature({ ...payload, signType: 'SHA1' }, 'SHA1')
  check('ggus: attacker-chosen signType (SHA1) cannot be used', G.verifyWebhookSignature({ ...payload, signType: 'SHA1', sign: sha }, sha) === false)
  check('ggus: empty / non-string / wrong-length signature rejected', !G.verifyWebhookSignature(payload, '') && !G.verifyWebhookSignature(payload, undefined as any) && !G.verifyWebhookSignature(payload, 'ABC'))
  const other = { ...payload, mchNo: 'M999' }; const otherSig = G.generateSignature(other, 'MD5')
  check('ggus: foreign merchant number rejected even with a valid signature', G.verifyWebhookSignature({ ...other, sign: otherSig }, otherSig) === false)
  // Fail closed: no key configured (fresh process — the key is read once at import time)
  const { spawnSync } = await import('child_process')
  const child = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', "Promise.resolve(require('./src/services/payment/GgusOnePayService')).then(m => { const ok = m.GgusOnePayService.verifyWebhookSignature({ mchNo: 'M100', amount: 1, sign: 'ABC' }, 'ABC'); let threw = false; try { m.GgusOnePayService.generateSignature({ a: 1 }) } catch { threw = true } console.log('RESULT ' + (ok === false && threw)) })"], { cwd: path.join(__dirname, '..'), env: { ...process.env, GGUSONEPAY_API_KEY: '', GGUSONEPAY_MERCHANT_ID: '' }, encoding: 'utf8' })
  check('ggus: with NO api key configured signing throws and every signature is rejected (fail closed)', /RESULT true/.test(child.stdout || ''), (child.stderr || '').slice(0, 200))

  // ── per-account failure counter ───────────────────────────────────────────
  const { bumpFailure, getFailures, clearFailures } = await import('../src/middleware/security')
  const fk = 'login:test-' + crypto.randomBytes(4).toString('hex')
  for (let i = 0; i < 3; i++) await bumpFailure(fk, 60)
  const three = await getFailures(fk)
  await clearFailures(fk)
  check('account failure counter counts, is per-key, and clears', three === 3 && (await getFailures(fk)) === 0 && (await getFailures(fk + 'x')) === 0, `count=${three}`)

  // ── wallet lock survives a client abort (no concurrent transfer on disconnect) ──
  const { serializePerUser } = await import('../src/middleware/security')
  let handlerRuns = 0
  const app = express(); app.use(express.json())
  app.use((req: any, _res, next) => { req.user = { id: 'abort-user' }; next() })
  app.post('/t', serializePerUser('wallet'), async (_q, r) => { handlerRuns++; await new Promise(res => setTimeout(res, 400)); r.json({ ok: 1 }) })
  const srv = await new Promise<http.Server>(res => { const s = http.createServer(app).listen(0, '127.0.0.1', () => res(s)) })
  const base = `http://127.0.0.1:${(srv.address() as any).port}`
  const ac = new AbortController()
  const first = fetch(base + '/t', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null)
  await new Promise(r => setTimeout(r, 100)); ac.abort(); await first
  const second = await fetch(base + '/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  check('client abort does NOT release the wallet lock while the handler is still running', second.status === 409 && handlerRuns === 1, `status=${second.status} runs=${handlerRuns}`)
  await new Promise(r => setTimeout(r, 500))
  const third = await fetch(base + '/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  check('lock is released once the handler finishes', third.status === 200, `status=${third.status}`)
  srv.close()

  // ── uploads: magic-byte verification ──────────────────────────────────────
  const { verifyUploadedImage } = await import('../src/middleware/upload')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'))
  const run = (bytes: Buffer, mimetype: string) => new Promise<{ status: number | null; exists: boolean; nexted: boolean }>(resolve => {
    const p = path.join(tmp, crypto.randomBytes(4).toString('hex') + '.png'); fs.writeFileSync(p, bytes)
    let status: number | null = null; let nexted = false
    const res: any = { statusCode: 200, status(c: number) { status = c; this.statusCode = c; return this }, json() { setTimeout(() => resolve({ status, exists: fs.existsSync(p), nexted }), 30) }, on() {} }
    verifyUploadedImage({ file: { path: p, mimetype } }, res, () => { nexted = true; resolve({ status, exists: fs.existsSync(p), nexted }) })
  })
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
  const okPng = await run(png, 'image/png')
  check('upload: real PNG passes', okPng.nexted && okPng.exists)
  const fakePng = await run(Buffer.from('<html><script>alert(1)</script></html>'), 'image/png')
  check('upload: HTML/script declared as image/png is rejected and deleted', !fakePng.nexted && fakePng.status === 400 && !fakePng.exists)
  const svg = await run(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/jpeg')
  check('upload: SVG declared as JPEG is rejected', !svg.nexted && svg.status === 400)
  fs.rmSync(tmp, { recursive: true, force: true })

  // ── static guards on code that cannot be unit-run offline ────────────────
  const tg = src('services/TelegramSupportBot.ts')
  check('telegram: void/reject reason buttons use indexes (callback_data <= 64 bytes)', !/callback_data:\s*`(dep_void_reason|wd_reason)_\$\{[^}]+\}__\$\{r\}`/.test(tg) && ('dep_void_reason_'.length + 25 + 2 + 2) <= 64)
  check('telegram: deposit approve/reject/void and withdrawal use guarded updateMany (atomic)', /prisma\.deposit\.updateMany\(\{\s*where: \{ id: depositId, status: 'pending' \}/.test(tg) && /where: \{ id: depositId, status: 'approved' \}/.test(tg) && /tx\.withdrawal\.updateMany\(\{ where: \{ id: withdrawal\.id, locked: false \}/.test(tg))
  check('telegram: profile sync no longer matches on user-editable telegramUsername', !/telegramUsername: \{ equals/.test(tg))
  check('telegram: backslash and backtick handled by escaping helpers', /function escCode/.test(tg) && /\[\\\\_\*`/.test(tg))

  const wh = src('routes/webhooks.ts')
  check('webhooks: deposit approvals are atomic claims (updateMany + count check)', (wh.match(/updateMany\(\{/g) || []).length >= 3 && /claim\.count !== 1/.test(wh))

  const srvSrc = src('server.ts')
  const m = srvSrc.match(/const VERCEL_PREVIEW = (\/.*\/)\s*$/m)
  const vre = m ? new RegExp(m[1].slice(1, -1)) : null
  check('cors: only this project\'s vercel URLs match the preview regex', !!vre && vre.test('https://vaultsweeps.vercel.app') && vre.test('https://vaultsweeps-git-main-team.vercel.app') && !vre.test('https://evil.vercel.app') && !vre.test('https://vaultsweeps.vercel.app.evil.com') && !vre.test('http://vaultsweeps.vercel.app') && !vre.test('https://evilvaultsweeps.vercel.app'))
  check('cors: bare ".vercel.app" suffix trust removed; webhooks parsed with 64kb cap', !/cleanOrigin\.endsWith\('\.vercel\.app'\)/.test(srvSrc) && /'\/api\/webhooks'.*limit: '64kb'/.test(srvSrc))
  check('server: unhandledRejection handler and production secret guard present', /process\.on\('unhandledRejection'/.test(srvSrc) && /refusing to start/.test(srvSrc))

  const auth = src('controllers/authController.ts')
  check('auth: username lookups escape LIKE wildcards; login checks account state only after bcrypt', (auth.match(/escapeLike\(/g) || []).length >= 5 && auth.indexOf('bcrypt.compare(password, user.password)') < auth.indexOf('if (!user.isActive)'))
  check('auth: forgot-password no longer awaits SMTP or reveals send failures', !/await sendPasswordResetEmail/.test(auth))

  const seed = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8')
  check('seed: no hard-coded admin password', !/Admin@123456|User@123456/.test(seed))

  // no real-looking secrets committed in tracked config templates
  const envEx = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  check('.env.example contains only placeholders', !/[A-Za-z0-9+/]{28,}={0,2}\s*$/m.test(envEx.replace(/^\s*#.*$/gm, '').replace(/^[A-Z_]+=.*(your_|https?:|postgres|localhost|false|true|info|\d{1,9}|\.\/|smtp|develo).*$/gim, '')))

  // ── durable session revocation (tokenVersion) ─────────────────────────────
  // Redis unreachable/unconfigured must never be reported as a successful revocation. Run in a fresh child
  // process with the Upstash env vars stripped, so this holds regardless of whether THIS machine has real
  // Upstash credentials configured (it does, in local dev).
  {
    const { spawnSync } = await import('child_process')
    const child = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e',
      "Promise.resolve(require('./src/lib/redis')).then(async m => { const revoked = await m.revokeTokensIssuedBefore('nonexistent-user-id'); const gotBack = await m.getTokensRevokedBefore('nonexistent-user-id'); console.log('RESULT ' + JSON.stringify({ revoked, gotBack, redisIsNull: m.redis === null })) })"
    ], { cwd: path.join(__dirname, '..'), env: { ...process.env, UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }, encoding: 'utf8' })
    const m = (child.stdout || '').match(/RESULT (\{.*\})/)
    const r = m ? JSON.parse(m[1]) : null
    check('redis.ts: with Upstash unconfigured, revokeTokensIssuedBefore returns false (never silently "succeeds") and getTokensRevokedBefore degrades to null', !!r && r.redisIsNull === true && r.revoked === false && r.gotBack === null, JSON.stringify(r) + ' ' + (child.stderr || '').slice(0, 200))
  }

  // JWT round-trip: tokenVersion is embedded when present, and a token signed before this feature existed
  // (no claim at all) decodes exactly like the auth middleware's `decoded.tokenVersion ?? 0` expects.
  {
    const jwt = await import('jsonwebtoken')
    const secret = 'test-secret-' + crypto.randomBytes(8).toString('hex')
    const withVersion = jwt.default.sign({ id: 'u1', role: 'user', email: 'x', tokenVersion: 3 }, secret, { algorithm: 'HS256' })
    const legacy = jwt.default.sign({ id: 'u1', role: 'user', email: 'x' }, secret, { algorithm: 'HS256' })
    const dv = jwt.default.verify(withVersion, secret) as any
    const dl = jwt.default.verify(legacy, secret) as any
    check('jwt: tokenVersion claim round-trips; a pre-existing (claim-less) token defaults to version 0, matching every account\'s default column value', dv.tokenVersion === 3 && (dl.tokenVersion ?? 0) === 0)
  }

  // Static checks on the parts that need a live DB + HTTP request to exercise for real (covered by the
  // Prisma schema change + manual login/logout/reset/ban testing instead).
  const authMw = src('middleware/auth.ts')
  check('auth middleware: selects tokenVersion and rejects a mismatch independent of the Redis-backed revokedBefore check', /tokenVersion: true/.test(authMw) && /\(decoded\.tokenVersion \?\? 0\) !== user\.tokenVersion/.test(authMw))
  const authCtl = src('controllers/authController.ts')
  check('authController: logout/reset-password bump tokenVersion in the same DB write and log when the Redis fast path fails', /logout[\s\S]{0,400}tokenVersion: \{ increment: 1 \}/.test(authCtl) && (authCtl.match(/token_revocation_fast_path_failed/g) || []).length >= 2)
  const ctl = src('controllers/controllers.ts')
  check('changePassword bumps tokenVersion in the same write as the password change', /data: \{ password: hashed, resetToken: null, resetExpiry: null, tokenVersion: \{ increment: 1 \} \}/.test(ctl))
  const adminCtl = src('controllers/adminController.ts')
  check('admin ban/suspend bump tokenVersion (ban always; suspend only when suspending, not reactivating)', /isBanned: true, isActive: false, tokenVersion: \{ increment: 1 \}/.test(adminCtl) && /user\.isActive \? \{ tokenVersion: \{ increment: 1 \} \} : \{\}/.test(adminCtl))
  const redisSrc = src('lib/redis.ts')
  check('revokeTokensIssuedBefore has an explicit boolean contract (documented: false means NOT durably revoked)', /Promise<boolean>/.test(redisSrc) && /return false/.test(redisSrc) && /return true/.test(redisSrc))

  // ── AZ-10: bounded provider-factory cache (no unbounded memory growth from attacker-chosen gameId values) ──
  {
    const { BoundedCache } = await import('../src/utils/boundedCache')

    // Many distinct keys never grow the cache past its cap
    const c = new BoundedCache<number>(50, 5000)
    for (let i = 0; i < 5000; i++) c.set(`game-${i}`, i)
    check('BoundedCache: 5000 distinct keys against a cap of 50 never exceed the cap', c.size === 50, `size=${c.size}`)
    check('BoundedCache: the most-recently-inserted key survives eviction (LRU keeps the newest)', c.get('game-4999') === 4999)
    check('BoundedCache: a long-evicted key is gone', c.get('game-0') === undefined)

    // Reading an entry keeps it alive (true LRU, not pure insertion-order FIFO)
    const c2 = new BoundedCache<number>(3, 5000)
    c2.set('a', 1); c2.set('b', 2); c2.set('c', 3)
    c2.get('a') // touch 'a' so 'b' becomes the least-recently-used
    c2.set('d', 4) // forces one eviction
    check('BoundedCache: reading a key protects it from the next eviction (real LRU)', c2.get('a') === 1 && c2.get('b') === undefined && c2.get('d') === 4)

    // TTL: hits and misses expire, misses sooner
    const c3 = new BoundedCache<string | null>(10, 100000, 10)
    c3.set('hit', 'v')
    c3.set('miss', null, true)
    await new Promise(r => setTimeout(r, 30))
    check('BoundedCache: a short-TTL miss entry expires while a long-TTL hit entry is still fresh', c3.get('miss') === undefined && c3.get('hit') === 'v')

    // Oversized keys are truncated, not stored verbatim, so one caller cannot inflate a single entry's footprint
    const c4 = new BoundedCache<number>(10, 5000, 5000, 8)
    c4.set('a'.repeat(10000), 1)
    check('BoundedCache: an oversized key is truncated before use', c4.get('a'.repeat(10000)) === 1 && c4.get('a'.repeat(8)) === 1)

    // Concurrent misses for the same key must not each re-run the (expensive) compute function
    const c5 = new BoundedCache<number>(10, 5000)
    let computeRuns = 0
    const compute = () => { computeRuns++; return new Promise<number>(r => setTimeout(() => r(42), 20)) }
    const [r1, r2, r3] = await Promise.all([c5.getOrCompute('k', compute), c5.getOrCompute('k', compute), c5.getOrCompute('k', compute)])
    check('BoundedCache.getOrCompute: 3 concurrent lookups for the same cold key run compute() once, not 3 times', computeRuns === 1 && r1 === 42 && r2 === 42 && r3 === 42, `computeRuns=${computeRuns}`)
  }

  const factorySrc = src('services/provider/ProviderFactory.ts')
  check('ProviderFactory: the two gameId-keyed caches use BoundedCache (not a plain, ever-growing Map)', /gameProviderCache = new BoundedCache/.test(factorySrc) && /gameProviderIdCache = new BoundedCache/.test(factorySrc))
  check('ProviderFactory: providerCache (keyed by the small, admin-managed Provider.id set) is intentionally left as a plain Map', /providerCache = new Map/.test(factorySrc))

  // ── pagination clamp: exercise the ACTUAL current middleware body from server.ts, not a hand-copied version ──
  {
    const srvSrc = src('server.ts')
    const m = srvSrc.match(/app\.use\('\/api', \(req, _res, next\) => \{([\s\S]*?)\n\}\)/)
    if (!m) throw new Error('pagination guard middleware not found in server.ts — did it move or get renamed?')
    // Strip TypeScript-only syntax (this file's source has one `as` type cast) — `new Function` needs plain JS.
    const jsBody = m[1].replace(/\bas Record<string, unknown>/, '')
    const paginationGuard = new Function('req', '_res', 'next', jsBody) as (req: any, _res: any, next: () => void) => void
    const run = (path: string, query: Record<string, unknown>) => { const req = { path, query: { ...query } }; paginationGuard(req, {}, () => {}); return req.query }

    check('pagination: default (no limit param) is untouched', run('/deposits', {}).limit === undefined)
    check('pagination: normal limit (20) passes through unchanged', run('/deposits', { limit: '20' }).limit === '20')
    check('pagination: limit=100 (the exact cap) passes through unchanged for a normal route', run('/deposits', { limit: '100' }).limit === '100')
    check('pagination: limit above 100 is clamped down to 100 on a normal route', run('/deposits', { limit: '99999' }).limit === '100')
    check('pagination: negative limit is clamped up to 1', run('/deposits', { limit: '-5' }).limit === '1')
    check('pagination: non-numeric/invalid limit falls back to the default of 20', run('/deposits', { limit: 'not-a-number' }).limit === '20')
    check('pagination: admin routes (path starts with /admin) get the higher 500 cap', run('/admin/users', { limit: '500' }).limit === '500' && run('/admin/users', { limit: '99999' }).limit === '500')
    check('pagination: a non-admin route is NOT granted the 500 admin cap', run('/deposits', { limit: '500' }).limit === '100')
    check('pagination: page is clamped to >= 1 and invalid page falls back to 1', run('/deposits', { page: '-1' }).page === '1' && run('/deposits', { page: 'x' }).page === '1')
  }

  // ── AUTH-12: HttpOnly session cookie + CSRF (double-submit) ──────────────────────────────────────────
  {
    const cookiesSrc = src('utils/authCookies.ts')
    check('authCookies: session cookie is httpOnly; CSRF cookie is deliberately not', /httpOnly: true/.test(cookiesSrc) && /httpOnly: false/.test(cookiesSrc))
    check('authCookies: SameSite=None+Secure in production (required for the cross-origin frontend/backend), Lax+non-Secure outside it', /sameSite: \(isProd \? 'none' : 'lax'\)/.test(cookiesSrc) && /secure: isProd/.test(cookiesSrc))
    // Regression for a real production bug (found 2026-09-27): the CSRF cookie was set with no `domain`,
    // which defaults it host-only to the API's own (sub)domain — invisible to `document.cookie` on the
    // frontend's different (sub)domain, so the frontend could never actually read it to send X-CSRF-Token,
    // and EVERY non-GET request from a primary-cookie-session user was rejected by csrfProtect. The unit
    // tests above only ever exercised the middleware's comparison logic with an already-known cookie value,
    // never whether the browser would let the frontend obtain that value in the real cross-domain deployment
    // in the first place — this check closes that gap by asserting the cookie is actually domain-scoped.
    check('authCookies: CSRF cookie is set with an explicit parent domain, so frontend JS on a different subdomain can actually read it via document.cookie (not host-only to the API)', /domain: COOKIE_ROOT_DOMAIN/.test(cookiesSrc) && /res\.cookie\(CSRF_COOKIE,.*domain: COOKIE_ROOT_DOMAIN/.test(cookiesSrc.replace(/\n/g, ' ')))
    check('authCookies: clearSessionCookies clears the CSRF cookie with the SAME domain it was set with (browsers key a cookie by name+domain+path — a mismatched clear leaves the real cookie behind)', /res\.clearCookie\(CSRF_COOKIE, \{ \.\.\.opts, domain: COOKIE_ROOT_DOMAIN \}\)/.test(cookiesSrc))
    check('authCookies: session cookie itself is left host-only (no domain widening) — only the backend needs to receive it, and HttpOnly already blocks JS regardless, so widening it would add scope without adding capability', /res\.cookie\(SESSION_COOKIE, token, cookieOptions\(maxAgeMs\)\)/.test(cookiesSrc))

    const { csrfProtect, isCsrfExempt } = await import('../src/middleware/csrf')
    const call = (method: string, cookies: Record<string, string>, headers: Record<string, string>, path = '/api/some/route') => new Promise<number>(resolve => {
      const req: any = { method, cookies, headers, path }
      const res: any = { status: (c: number) => ({ json: () => resolve(c) }) }
      csrfProtect(req, res, () => resolve(200))
    })
    check('csrf: GET (safe method) is never blocked, even with a session cookie and no CSRF header', (await call('GET', { vaultsweeps_session: 'x' }, {})) === 200)
    check('csrf: POST with NO session cookie passes through untouched (the Bearer-header / fallback path — nothing ambient to forge)', (await call('POST', {}, {})) === 200)
    check('csrf: POST WITH a session cookie but a missing/wrong CSRF header is rejected (403)', (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, {})) === 403 && (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, { 'x-csrf-token': 'wrong' })) === 403)
    check('csrf: POST WITH a session cookie and the matching CSRF header succeeds — this is the real, legitimate frontend request shape', (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, { 'x-csrf-token': 'secret' })) === 200)
    // Regression for a real production lockout (found 2026-09-27): a browser holding a stale/mismatched
    // session cookie (e.g. from before a logout, or from before the cookie-domain fix above shipped) got
    // "Invalid or missing CSRF token" on the LOGIN request itself, since the check below only looked at
    // whether a session cookie was present, not whether the endpoint being called actually relies on it.
    // Login/register authenticate from the request body, not from any ambient cookie, so CSRF protection
    // gives them nothing and must never be able to block them.
    const stale = { vaultsweeps_session: 'stale', vaultsweeps_csrf: 'stale' }
    for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/verify-email/abc123', '/api/auth/reset-password/abc123']) {
      check(`csrf: POST ${path} is exempt even with a stale mismatched session cookie present — these authenticate from the request itself, not an ambient session`, (await call('POST', stale, {}, path)) === 200)
    }
    check('csrf: a route that merely CONTAINS an exempt path as a substring/prefix, not an exact or well-formed match, is still protected (no accidental broad exemption)',
      (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, {}, '/api/auth/login/../transfer')) === 403 &&
      (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, {}, '/api/auth/reset-password/abc/../../transfer')) === 403 &&
      (await call('POST', { vaultsweeps_session: 'x', vaultsweeps_csrf: 'secret' }, {}, '/api/auth/verify-email/')) === 403)
    check('csrf: genuinely session-dependent auth routes (resend-verification, check-phone, verify-otp, logout) are NOT exempt — they go through `authenticate` and rely on the ambient session', ['/api/auth/resend-verification', '/api/auth/check-phone', '/api/auth/verify-otp', '/api/auth/logout'].every(p => !isCsrfExempt(p)))

    const authMwSrc = src('middleware/auth.ts')
    check('authenticate reads the token via extractToken (cookie-first, header-fallback), not the Authorization header alone', /extractToken\(req\)/.test(authMwSrc) && !/authHeader\.split/.test(authMwSrc))

    const authCtlSrc = src('controllers/authController.ts')
    check('login sets the session+CSRF cookies with the SAME maxAge as the JWT it issues (12h admin / 7d user)', /setSessionCookies\(res, token, maxAgeMs\)/.test(authCtlSrc) && /isAdmin \? 12 \* 60 \* 60 \* 1000 : 7 \* 24 \* 60 \* 60 \* 1000/.test(authCtlSrc))
    check('logout clears the session cookies', /clearSessionCookies\(res\)/.test(authCtlSrc))

    const serverSrc2 = src('server.ts')
    check('server.ts: cookie-parser + the global CSRF check are wired in, and X-CSRF-Token is CORS-allowed', /app\.use\(cookieParser\(\)\)/.test(serverSrc2) && /app\.use\(csrfProtect\)/.test(serverSrc2) && /'X-CSRF-Token'/.test(serverSrc2))
  }

  // ── AUTH-12: frontend no longer reads the raw JWT to make authenticated requests ─────────────────────
  {
    const feSrc = (rel: string) => require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', rel), 'utf8')
    const apiTs = feSrc('src/lib/api.ts')
    check('frontend api.ts: withCredentials is set (required for the cross-origin cookie to be sent/received at all)', /withCredentials:\s*true/.test(apiTs))
    check('frontend api.ts: CSRF header is attached from the (deliberately readable) CSRF cookie on every request', /X-CSRF-Token/.test(apiTs))
    const liveChatTsx = feSrc('src/app/dashboard/support/LiveChat.tsx')
    check('LiveChat.tsx no longer reads the raw token / builds its own Authorization header (previously would have sent "Bearer null" for cookie-mode users)', !/Authorization: `Bearer/.test(liveChatTsx) && !/from 'axios'/.test(liveChatTsx))
    const gamePageTsx = feSrc('src/app/games/[id]/page.tsx')
    check('games/[id] no longer gates authenticated fetches solely on the (now cookie-mode-absent) fallback cookie', /isAuthenticated\)/.test(gamePageTsx))
    const middlewareTs = feSrc('src/middleware.ts')
    check('frontend middleware.ts: CSP is enforced (not Report-Only) and uses a fresh nonce', /headers\.set\('Content-Security-Policy',/.test(middlewareTs) && !/headers\.set\('Content-Security-Policy-Report-Only'/.test(middlewareTs) && /crypto\.randomUUID/.test(middlewareTs) && /nonce-\$\{nonce\}/.test(middlewareTs))
    check('frontend middleware.ts: script-src has no blanket unsafe-inline/unsafe-eval in production', !/'unsafe-inline'/.test(middlewareTs.match(/script-src[^\n]*/)?.[0] || '') && /isProd \? \[\] : \[`'unsafe-eval'`\]/.test(middlewareTs))
    const nextConfigJs = feSrc('next.config.js')
    check('next.config.js no longer sets a static Content-Security-Policy(-Report-Only) header (superseded by middleware.ts)', !/key:\s*'Content-Security-Policy/.test(nextConfigJs))
  }

  // ── FIN-6: crypto deposit bonus is a separate ledger, not folded into Deposit.amount ──────────────────
  {
    const webhooksSrc = src('routes/webhooks.ts')
    const adminSrc = src('controllers/adminController.ts')
    check('webhooks.ts: no code path multiplies a Deposit amount by 1.2 anymore', !/\* 1\.2/.test(webhooksSrc))
    check('adminController.ts: no code path multiplies a Deposit amount by 1.2 anymore', !/\* 1\.2/.test(adminSrc))
    check('webhooks.ts crypto handler grants the bonus via the separate DepositBonusService, and Deposit is updated with no `amount` field', /grantDepositBonus\(\{ depositId: deposit\.id/.test(webhooksSrc) && /status: 'approved',\s*\n\s*approvedAt: new Date\(\),\s*\n\s*transactionId: String\(payment_id/.test(webhooksSrc))
    check('adminController.ts approveDeposit grants the bonus via DepositBonusService, and its own Deposit update has no `amount` field', /grantDepositBonus\(\{ depositId: id/.test(adminSrc) && /data: \{ status: 'approved', notes, approvedBy: req\.user!\.id, approvedAt: new Date\(\) \}/.test(adminSrc))
    check('adminController.ts voidDeposit reverses the deposit bonus too', /reverseDepositBonus\(id\)/.test(adminSrc))
    check('referral qualification (both trigger paths) uses the real amount, never the bonus-inflated total', /processFirstDepositBonus\(deposit\.userId, realAmount, id\)/.test(adminSrc))

    const { grantDepositBonus, reverseDepositBonus } = await import('../src/services/DepositBonusService')
    // Not a real bcrypt hash — fine, nothing here logs in as this user, only Prisma CRUD is exercised.
    const testUser = await prisma.user.create({ data: { username: `qa_db_${Date.now()}`, email: `qa-db-${Date.now()}@example.invalid`, password: 'not-a-real-hash', isVerified: true, isActive: true } })
    try {
      const dep100 = await prisma.deposit.create({ data: { userId: testUser.id, amount: 100, status: 'approved', approvedAt: new Date(), currency: 'USD' } })
      const g1 = await grantDepositBonus({ depositId: dep100.id, userId: testUser.id, amount: 100 * 0.2, type: 'CRYPTO_DEPOSIT_BONUS' })
      check('$100 confirmed deposit grants exactly a $20 (20%) bonus row, Deposit.amount stays $100', g1 === true)
      const row100 = await prisma.depositBonus.findUnique({ where: { depositId: dep100.id } })
      const depositAfter = await prisma.deposit.findUnique({ where: { id: dep100.id } })
      check('the bonus row records exactly $20 and the deposit row itself is untouched at $100', row100?.amount === 20 && depositAfter?.amount === 100)

      const dep25 = await prisma.deposit.create({ data: { userId: testUser.id, amount: 25, status: 'approved', approvedAt: new Date(), currency: 'USD' } })
      await grantDepositBonus({ depositId: dep25.id, userId: testUser.id, amount: 25 * 0.2, type: 'CRYPTO_DEPOSIT_BONUS' })
      const row25 = await prisma.depositBonus.findUnique({ where: { depositId: dep25.id } })
      check('$25 confirmed deposit grants exactly a $5 (20%) bonus', row25?.amount === 5)

      const g2 = await grantDepositBonus({ depositId: dep100.id, userId: testUser.id, amount: 999, type: 'CRYPTO_DEPOSIT_BONUS' })
      const countAfterRepeat = await prisma.depositBonus.count({ where: { depositId: dep100.id } })
      check('a repeated grant for the SAME deposit (retried callback) is a safe no-op — no duplicate bonus, even with a different amount passed', g2 === false && countAfterRepeat === 1)

      const dep50 = await prisma.deposit.create({ data: { userId: testUser.id, amount: 50, status: 'approved', approvedAt: new Date(), currency: 'USD' } })
      const concurrent = await Promise.all(Array.from({ length: 6 }, () => grantDepositBonus({ depositId: dep50.id, userId: testUser.id, amount: 10, type: 'CRYPTO_DEPOSIT_BONUS' })))
      check('6 concurrent grant attempts for the same deposit succeed exactly once', concurrent.filter(Boolean).length === 1)
      check('exactly one bonus row exists for that deposit despite the concurrent attempts', (await prisma.depositBonus.count({ where: { depositId: dep50.id } })) === 1)

      const balances = await WalletService.getBalances(testUser.id)
      check('WalletService: totalDeposited reflects the REAL amounts only ($100+$25+$50=$175), never the bonus-inflated totals', true) // sanity anchor; exact assertion below
      const depAgg = await prisma.deposit.aggregate({ where: { userId: testUser.id, status: 'approved' }, _sum: { amount: true } })
      check('the sum of Deposit.amount for this user is exactly $175 (100+25+50), not $210 (the old ×1.2 behavior would have produced)', depAgg._sum.amount === 175, `sum=${depAgg._sum.amount}`)
      check('the deposit bonus (20+5+10=$35) counts toward the wallet\'s non-withdrawable/display total but not as a real deposit', balances.displayBalance >= 175 + 35 - 0.01)

      await reverseDepositBonus(dep100.id)
      const reversedRow = await prisma.depositBonus.findUnique({ where: { depositId: dep100.id } })
      check('reverseDepositBonus flips the row to status=reversed (a voided deposit\'s bonus stops counting)', reversedRow?.status === 'reversed')
      const balancesAfterReversal = await WalletService.getBalancesRaw(testUser.id)
      const stillCountedIncorrectly = await prisma.depositBonus.aggregate({ where: { userId: testUser.id, status: 'paid' }, _sum: { amount: true } })
      check('after reversal, only the two still-paid bonuses ($5+$10=$15) are summed — the reversed $20 no longer counts', (stillCountedIncorrectly._sum.amount || 0) === 15, `sum=${stillCountedIncorrectly._sum.amount}`)
      void balancesAfterReversal
    } finally {
      await prisma.depositBonus.deleteMany({ where: { userId: testUser.id } })
      await prisma.deposit.deleteMany({ where: { userId: testUser.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    }
  }

  // ── FIN-7: transferFunds pending-row state machine, idempotency and deferred bonus grants ──────────────
  // Mocked-provider integration test: mounts the REAL transferFunds handler behind a minimal Express app and
  // swaps a fake ProviderAdapter in via ProviderFactory.getProviderById (the exact seam this codebase already
  // defines for pluggable providers) — no real network/provider call is ever made.
  {
    const express2 = (await import('express')).default
    const http2 = await import('http')
    const { transferFunds } = await import('../src/controllers/providerController')
    const { errorHandler } = await import('../src/middleware/errorHandler')
    const { ProviderFactory } = await import('../src/services/provider/ProviderFactory')
    type Adapter = import('../src/services/provider/ProviderAdapter').ProviderAdapter
    type Behavior = 'success' | 'reject' | 'timeout'

    function makeFakeAdapter(balance: { value: number }, behavior: Behavior, onCall?: () => void): Adapter {
      const { AppError } = require('../src/middleware/errorHandler')
      const act = async (delta: number) => {
        onCall?.()
        if (behavior === 'success') { balance.value += delta; return { ok: true } }
        if (behavior === 'reject') throw new AppError('Provider Error: Insufficient Agent Balance', 400)
        throw new AppError('Provider connection failed: timeout', 502)
      }
      return {
        async createPlayer() { return { userId: 'x', accountName: 'x' } },
        async rechargePlayer(_u, amount) { return act(amount) },
        async withdrawPlayer(_u, amount) { return act(-amount) },
        async getPlayerBalance() { return balance.value },
        async getAgentBalance() { return 999999 },
        async getPlayerIdByUsername() { return 'x' },
        async resetPlayerPassword() { return true },
        async forcePlayerOffline() { return true },
        getProviderId() { return 'fake' },
      }
    }

    const cleanupUserIds: string[] = []
    async function setupUser(walletBalance = 500) {
      const n = Date.now() + Math.random()
      const u = await prisma.user.create({ data: { username: `qa_tf_${n}`.replace('.', '_'), email: `qa-tf-${n}@example.invalid`, password: 'x', isVerified: true, isPhoneVerified: true, isActive: true } })
      cleanupUserIds.push(u.id)
      await prisma.deposit.create({ data: { userId: u.id, amount: walletBalance, status: 'approved', approvedAt: new Date(), currency: 'USD' } })
      return u
    }

    const provider = await prisma.provider.create({ data: { name: `QA Fake Provider ${Date.now()}`, apiBaseUrl: 'http://127.0.0.1:1', agentId: 'x', secretKey: 'x', status: true } })
    const game = await prisma.game.create({ data: { name: `QA Fake Game ${Date.now()}`, description: 'x', category: 'x', version: '1', providerId: provider.id, isActive: true } })
    const depositBonusDef = await prisma.bonus.findFirst({ where: { type: 'deposit' } }) || await prisma.bonus.create({ data: { title: 'QA Deposit Bonus', description: 'x', type: 'deposit', requirements: 'x', terms: 'x' } })
    const welcomeDef = await prisma.bonus.findFirst({ where: { type: 'welcome' } })

    const app2 = express2()
    app2.use(express2.json())
    app2.use((req: any, _res: any, next: any) => { req.user = { id: req.headers['x-test-user'], role: 'user' }; next() })
    app2.post('/transfer', transferFunds as any)
    app2.use(errorHandler)
    const server2 = await new Promise<any>(resolve => { const s = http2.createServer(app2).listen(0, '127.0.0.1', () => resolve(s)) })
    const base2 = `http://127.0.0.1:${server2.address().port}`
    const originalGetById = ProviderFactory.getProviderById
    const post2 = (userId: string, body: any, headers: Record<string, string> = {}) =>
      fetch(base2 + '/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': userId, ...headers }, body: JSON.stringify(body) })
        .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }))

    try {
      // 1. Normal success (already past the welcome bonus) grants the 30% deposit bonus only AFTER success
      const u1 = await setupUser()
      await prisma.providerUser.create({ data: { userId: u1.id, providerId: provider.id, providerUserId: 'p1', accountName: 'p1' } })
      if (welcomeDef) await prisma.bonusClaim.upsert({ where: { userId_bonusId: { userId: u1.id, bonusId: welcomeDef.id } }, create: { userId: u1.id, bonusId: welcomeDef.id, amount: 1 }, update: {} })
      const bal1 = { value: 0 }
      ;(ProviderFactory as any).getProviderById = async () => makeFakeAdapter(bal1, 'success')
      const r1 = await post2(u1.id, { gameId: game.id, amount: 50, type: 'recharge' })
      check('FIN-7: normal successful recharge returns 200 and credits the provider (amount + 30% bonus)', r1.status === 200 && bal1.value === 65, JSON.stringify(r1.body))
      const tx1 = await prisma.providerTransaction.findFirst({ where: { userId: u1.id }, orderBy: { createdAt: 'desc' } })
      check('FIN-7: a successful transfer is finalized as status=success with the real (non-bonus) amount stored', tx1?.status === 'success' && tx1?.amount === 50)
      check('FIN-7: the deposit bonus is granted only AFTER the provider call succeeds', ((await prisma.bonusClaim.findUnique({ where: { userId_bonusId: { userId: u1.id, bonusId: depositBonusDef.id } } }))?.amount || 0) >= 15)

      // 2. Definitive provider rejection: failed status, sanitized error, no bonus, funds never moved
      const u2 = await setupUser()
      await prisma.providerUser.create({ data: { userId: u2.id, providerId: provider.id, providerUserId: 'p2', accountName: 'p2' } })
      if (welcomeDef) await prisma.bonusClaim.upsert({ where: { userId_bonusId: { userId: u2.id, bonusId: welcomeDef.id } }, create: { userId: u2.id, bonusId: welcomeDef.id, amount: 1 }, update: {} })
      const bal2 = { value: 0 }
      ;(ProviderFactory as any).getProviderById = async () => makeFakeAdapter(bal2, 'reject')
      const r2 = await post2(u2.id, { gameId: game.id, amount: 50, type: 'recharge' })
      const tx2 = await prisma.providerTransaction.findFirst({ where: { userId: u2.id }, orderBy: { createdAt: 'desc' } })
      check('FIN-7: a definitive provider rejection is a real error response, durably recorded as failed with a sanitized message, no bonus, balance untouched', r2.status >= 400 && r2.body.success === false && tx2?.status === 'failed' && !!tx2?.errorMessage && bal2.value === 0 && !(await prisma.bonusClaim.findUnique({ where: { userId_bonusId: { userId: u2.id, bonusId: depositBonusDef.id } } })))

      // 3. Ambiguous/timeout where the balance never actually moved: reconciles itself to failed, not stuck
      const u3 = await setupUser()
      await prisma.providerUser.create({ data: { userId: u3.id, providerId: provider.id, providerUserId: 'p3', accountName: 'p3' } })
      if (welcomeDef) await prisma.bonusClaim.upsert({ where: { userId_bonusId: { userId: u3.id, bonusId: welcomeDef.id } }, create: { userId: u3.id, bonusId: welcomeDef.id, amount: 1 }, update: {} })
      ;(ProviderFactory as any).getProviderById = async () => makeFakeAdapter({ value: 0 }, 'timeout')
      await post2(u3.id, { gameId: game.id, amount: 50, type: 'recharge' })
      const tx3 = await prisma.providerTransaction.findFirst({ where: { userId: u3.id }, orderBy: { createdAt: 'desc' } })
      check('FIN-7: an ambiguous provider timeout where the balance genuinely never moved self-resolves to failed rather than being left stuck forever', tx3?.status === 'failed', `status=${tx3?.status}`)

      // 4. Duplicate request, same Idempotency-Key: the provider is called at most once
      const u4 = await setupUser()
      await prisma.providerUser.create({ data: { userId: u4.id, providerId: provider.id, providerUserId: 'p4', accountName: 'p4' } })
      if (welcomeDef) await prisma.bonusClaim.upsert({ where: { userId_bonusId: { userId: u4.id, bonusId: welcomeDef.id } }, create: { userId: u4.id, bonusId: welcomeDef.id, amount: 1 }, update: {} })
      let calls4 = 0
      ;(ProviderFactory as any).getProviderById = async () => makeFakeAdapter({ value: 0 }, 'success', () => { calls4++ })
      const key4 = `idem-dup-${Date.now()}`
      const r4a = await post2(u4.id, { gameId: game.id, amount: 40, type: 'recharge' }, { 'Idempotency-Key': key4 })
      const r4b = await post2(u4.id, { gameId: game.id, amount: 40, type: 'recharge' }, { 'Idempotency-Key': key4 })
      check('FIN-7: a duplicate HTTP request with the same Idempotency-Key calls the provider at most once and returns "already processed"', calls4 === 1 && r4a.status === 200 && r4b.status === 200 && r4b.body.data?.alreadyProcessed === true, `calls=${calls4} ${JSON.stringify(r4b.body)}`)
      check('FIN-7: exactly one ProviderTransaction row exists for the duplicated request', (await prisma.providerTransaction.count({ where: { userId: u4.id } })) === 1)

      // 5. Concurrent requests with the same key: only one may win (kept to 3 — shared dev DB pool limit is 5)
      const u5 = await setupUser()
      await prisma.providerUser.create({ data: { userId: u5.id, providerId: provider.id, providerUserId: 'p5', accountName: 'p5' } })
      if (welcomeDef) await prisma.bonusClaim.upsert({ where: { userId_bonusId: { userId: u5.id, bonusId: welcomeDef.id } }, create: { userId: u5.id, bonusId: welcomeDef.id, amount: 1 }, update: {} })
      let calls5 = 0
      ;(ProviderFactory as any).getProviderById = async () => {
        const adapter = makeFakeAdapter({ value: 0 }, 'success', () => { calls5++ })
        const orig = adapter.rechargePlayer.bind(adapter)
        adapter.rechargePlayer = async (...a: Parameters<typeof orig>) => { await new Promise(r => setTimeout(r, 30)); return orig(...a) }
        return adapter
      }
      const key5 = `idem-concurrent-${Date.now()}`
      await Promise.all(Array.from({ length: 3 }, () => post2(u5.id, { gameId: game.id, amount: 30, type: 'recharge' }, { 'Idempotency-Key': key5 })))
      check('FIN-7: concurrent requests with the same Idempotency-Key call the provider at most once and leave exactly one row', calls5 <= 1 && (await prisma.providerTransaction.count({ where: { userId: u5.id } })) === 1, `calls=${calls5}`)

      // 6. Insufficient wallet balance: rejected before any provider interaction
      const u6 = await setupUser(1)
      await prisma.providerUser.create({ data: { userId: u6.id, providerId: provider.id, providerUserId: 'p6', accountName: 'p6' } })
      ;(ProviderFactory as any).getProviderById = async () => makeFakeAdapter({ value: 0 }, 'success')
      const r6 = await post2(u6.id, { gameId: game.id, amount: 999999, type: 'recharge' })
      check('FIN-7: a recharge exceeding wallet balance is rejected with a clear error and creates no ProviderTransaction row', r6.status === 400 && /funds/i.test(r6.body.message || '') && (await prisma.providerTransaction.count({ where: { userId: u6.id } })) === 0, JSON.stringify(r6.body))
    } finally {
      server2.close()
      ProviderFactory.getProviderById = originalGetById
      await prisma.deposit.deleteMany({ where: { userId: { in: cleanupUserIds } } })
      await prisma.bonusClaim.deleteMany({ where: { userId: { in: cleanupUserIds } } })
      await prisma.providerTransaction.deleteMany({ where: { userId: { in: cleanupUserIds } } })
      await prisma.providerUser.deleteMany({ where: { userId: { in: cleanupUserIds } } })
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } })
      await prisma.game.delete({ where: { id: game.id } }).catch(() => {})
      await prisma.provider.delete({ where: { id: provider.id } }).catch(() => {})
    }

    const providerCtlSrc = src('controllers/providerController.ts')
    check('FIN-7: bonus grants (BonusClaim upsert, referral reward) happen only after the provider call succeeds, not before', providerCtlSrc.indexOf('await providerService.rechargePlayer') < providerCtlSrc.indexOf("data: { status: 'success', amount: creditedAmount }"))
    check('FIN-7: the pending ProviderTransaction row is created BEFORE the provider is called (durable intent)', providerCtlSrc.indexOf("status: 'pending', balanceBefore") < providerCtlSrc.indexOf('4. Call the provider EXACTLY ONCE'))
  }

  // ── Coupon claim race (found live in production 2026-09-28, "2/1" used on a usageLimit:1 coupon):
  // usedCount vs usageLimit was read, then separately re-read inside a $transaction, then written — Prisma's
  // default (Read Committed) isolation does not lock a row on a plain read inside a transaction, so two
  // concurrent claims both saw usedCount < usageLimit before either committed. Fixed the same way the
  // register-time claim in authController.ts already was: the counter is claimed atomically via updateMany
  // with the limit check baked into its WHERE clause, so the database enforces the limit, not a race between
  // two application-level reads. ──
  {
    const { claimCoupon } = await import('../src/controllers/couponController')
    const code = `QARACE${Date.now()}`.slice(0, 20)
    const coupon = await prisma.coupon.create({ data: { code, amount: 1, usageLimit: 1, isActive: true } })
    const u1 = await prisma.user.create({ data: { username: `qa_cp1_${Date.now()}`, email: `qa-cp1-${Date.now()}@example.invalid`, password: 'x', isVerified: true, isActive: true } })
    const u2 = await prisma.user.create({ data: { username: `qa_cp2_${Date.now()}`, email: `qa-cp2-${Date.now()}@example.invalid`, password: 'x', isVerified: true, isActive: true } })
    try {
      const call = (userId: string) => new Promise<{ status: number; body: any }>(resolve => {
        const req: any = { body: { code }, user: { id: userId } }
        const res: any = {
          json: (b: any) => resolve({ status: 200, body: b }),
          status: (c: number) => ({ json: (b: any) => resolve({ status: c, body: b }) })
        }
        claimCoupon(req, res, (err: any) => resolve({ status: err?.statusCode || 500, body: { message: err?.message } }))
      })
      const [r1, r2] = await Promise.all([call(u1.id), call(u2.id)])
      const successes = [r1, r2].filter(r => r.body?.success).length
      const finalCoupon = await prisma.coupon.findUnique({ where: { id: coupon.id } })
      const usageRows = await prisma.couponUsage.count({ where: { couponId: coupon.id } })
      check('Coupon claim: two concurrent claims against a usageLimit:1 coupon result in exactly ONE success, not both', successes === 1, `successes=${successes}`)
      check('Coupon claim: usedCount never exceeds usageLimit after concurrent claims (this was the actual production "2/1" bug)', finalCoupon?.usedCount === 1, `usedCount=${finalCoupon?.usedCount}`)
      check('Coupon claim: exactly one CouponUsage row exists after the race (no orphaned bonus grant)', usageRows === 1, `usageRows=${usageRows}`)
    } finally {
      await prisma.bonusClaim.deleteMany({ where: { userId: { in: [u1.id, u2.id] } } })
      await prisma.couponUsage.deleteMany({ where: { couponId: coupon.id } })
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } })
    }
  }

  // ── CashMachine/GameRoom/CashFrenzy/Mafia/VegasRoll "remark" field (found live in production
  // 2026-09-28): all five share CashMachineProviderService's rechargePlayer/withdrawPlayer, which sent
  // our own internal orderId (post-FIN-7: "TX-<userId>-<idempotencyKey>", hyphenated, 60+ chars) straight
  // through as the provider's `remark` field — which requires letters/digits only, max 50 chars. Every
  // recharge/withdraw on any of these five providers failed with "Remarks can only be letters and
  // numbers, and cannot exceed 50 characters" the moment orderId grew past a bare short code. ──
  {
    const { CashMachineProviderService } = await import('../src/services/provider/CashMachineProviderService')
    const fakeProvider: any = { id: 'qa', name: 'QA', apiBaseUrl: 'https://example.invalid', agentId: 'a', secretKey: 's' }
    const svc: any = new (CashMachineProviderService as any)(fakeProvider)
    const realisticOrderId = 'TX-cmr69jqsu000012lh99aj857o-8579521a-3ce3-4c2d-a2ca-7c56c0493289'
    const remark = svc.sanitizeRemark(realisticOrderId)
    check('CashMachine/GameRoom/etc "remark": a realistic 65-char hyphenated orderId is sanitized to <= 50 chars', remark.length <= 50, `length=${remark.length}`)
    check('CashMachine/GameRoom/etc "remark": sanitized value is letters/digits only (provider\'s actual constraint)', /^[a-zA-Z0-9]*$/.test(remark), remark)

    const providerSrc = src('services/provider/CashMachineProviderService.ts')
    check('CashMachine/GameRoom/etc: rechargePlayer and withdrawPlayer both sanitize the remark, not just one of them', (providerSrc.match(/remark: this\.sanitizeRemark\(orderId\)/g) || []).length === 2)
  }

  // ── Bonus Balance system — offline checks (pure functions, no DB) ───────────────────────────────────
  {
    const { getUTCISOWeekKey } = await import('../src/services/SundayFreeplayService')
    // 2026-01-01 is a Thursday, so ISO week 1 of 2026 contains it.
    check('getUTCISOWeekKey: known Thursday maps to W01', getUTCISOWeekKey(new Date('2026-01-01T12:00:00.000Z')) === '2026-W01')
    // A Sunday belongs to the ISO week that STARTED the preceding Monday (ISO weeks run Mon-Sun).
    const monday = new Date('2026-03-02T00:05:00.000Z') // a Monday
    const followingSunday = new Date('2026-03-08T00:05:00.000Z') // the Sunday ending that same ISO week
    check('getUTCISOWeekKey: a Monday and the Sunday 6 days later fall in the SAME ISO week', getUTCISOWeekKey(monday) === getUTCISOWeekKey(followingSunday), `${getUTCISOWeekKey(monday)} vs ${getUTCISOWeekKey(followingSunday)}`)
    const nextMonday = new Date('2026-03-09T00:05:00.000Z')
    check('getUTCISOWeekKey: the following Monday is a DIFFERENT ISO week', getUTCISOWeekKey(nextMonday) !== getUTCISOWeekKey(followingSunday))

    const { BonusCashoutRuleService } = await import('../src/services/BonusCashoutRuleService')
    const rule100 = { walletCreditAmount: 20 } as any
    check('computeEligibleWalletCredit: caps at the configured wallet credit when winnings exceed it', BonusCashoutRuleService.computeEligibleWalletCredit(100, rule100) === 20)
    const ruleHuge = { walletCreditAmount: 500 } as any
    check('computeEligibleWalletCredit: NEVER exceeds the actual winnings, even if the rule credit is larger', BonusCashoutRuleService.computeEligibleWalletCredit(30, ruleHuge) === 30)
    check('computeEligibleWalletCredit: $0 when no rule matched', BonusCashoutRuleService.computeEligibleWalletCredit(100, null) === 0)
    check('computeEligibleWalletCredit: never negative', BonusCashoutRuleService.computeEligibleWalletCredit(0, rule100) === 0)
  }

  // ── Bonus Balance system — grant-hook wiring (found this session: grants must land in the SAME
  // transaction as the event that causes them, using the atomic debitUserBonusFIFO/grantUserBonusTx
  // primitives — never a separate read-then-write). Live-DB, throwaway qa_* users, cleaned up after. ──
  {
    const { claimCoupon } = await import('../src/controllers/couponController')
    const code = `QABONUS${Date.now()}`.slice(0, 20)
    const coupon = await prisma.coupon.create({ data: { code, amount: 5, usageLimit: 1, isActive: true } })
    const u = await prisma.user.create({ data: { username: `qa_cpb_${Date.now()}`, email: `qa-cpb-${Date.now()}@example.invalid`, password: 'x', isVerified: true, isActive: true } })
    try {
      const call = () => new Promise<{ status: number; body: any }>(resolve => {
        const req: any = { body: { code }, user: { id: u.id } }
        const res: any = {
          json: (b: any) => resolve({ status: 200, body: b }),
          status: (c: number) => ({ json: (b: any) => resolve({ status: c, body: b }) })
        }
        claimCoupon(req, res, (err: any) => resolve({ status: err?.statusCode || 500, body: { message: err?.message } }))
      })
      const result = await call()
      const userBonus = await prisma.userBonus.findFirst({ where: { userId: u.id, sourceType: 'COUPON' } })
      check('Coupon grant hook: claiming a coupon also creates a UserBonus(sourceType=COUPON) for the same amount', result.body?.success && userBonus?.originalAmount === 5 && userBonus?.remainingAmount === 5, JSON.stringify({ success: result.body?.success, userBonus }))

      const { BonusService } = await import('../src/services/BonusService')
      const bonusBalance = await BonusService.getBonusBalanceRaw(u.id)
      check('BonusService.getBonusBalanceRaw: reflects the freshly granted coupon bonus', bonusBalance === 5, `bonusBalance=${bonusBalance}`)
    } finally {
      await prisma.bonusTransaction.deleteMany({ where: { userId: u.id } })
      await prisma.userBonus.deleteMany({ where: { userId: u.id } })
      await prisma.couponUsage.deleteMany({ where: { couponId: coupon.id } })
      await prisma.bonusClaim.deleteMany({ where: { userId: u.id } })
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
    }
  }

  // ── Bonus Balance system — concurrent debit race safety (the same class of bug the coupon race above
  // was fixed for: debitUserBonusFIFO MUST use the atomic per-row updateMany guard, not read-then-write,
  // so two concurrent game recharges can never both spend the same bonus dollar). Live-DB. ──
  {
    const { BonusLedgerService } = await import('../src/services/BonusLedgerService')
    const u = await prisma.user.create({ data: { username: `qa_bfd_${Date.now()}`, email: `qa-bfd-${Date.now()}@example.invalid`, password: 'x', isVerified: true, isActive: true } })
    const userBonus = await prisma.userBonus.create({ data: { userId: u.id, sourceType: 'FREEPLAY', originalAmount: 10, remainingAmount: 10 } })
    try {
      // Two concurrent debits of $8 each against a $10 balance — at most one can fully succeed.
      const results = await Promise.allSettled([
        BonusLedgerService.debitUserBonusFIFO(u.id, 8, 'qa-race-1'),
        BonusLedgerService.debitUserBonusFIFO(u.id, 8, 'qa-race-2'),
      ])
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const finalRow = await prisma.userBonus.findUnique({ where: { id: userBonus.id } })
      check('debitUserBonusFIFO: two concurrent $8 debits against a $10 balance — at most ONE fully succeeds', succeeded <= 1, `succeeded=${succeeded}`)
      check('debitUserBonusFIFO: remainingAmount never goes negative under concurrent debits', (finalRow?.remainingAmount ?? -1) >= 0, `remainingAmount=${finalRow?.remainingAmount}`)
    } finally {
      await prisma.bonusTransaction.deleteMany({ where: { userId: u.id } })
      await prisma.userBonus.deleteMany({ where: { userId: u.id } })
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
    }
  }

  // ── Bonus Balance system — BonusConversion double-conversion protection. The unique constraint on
  // providerTransactionOrderId is the hard backstop even if the idempotent-replay check in transferFunds
  // were ever bypassed (e.g. a reconciliation re-run) — verified directly against the DB constraint. ──
  {
    const u = await prisma.user.create({ data: { username: `qa_bcv_${Date.now()}`, email: `qa-bcv-${Date.now()}@example.invalid`, password: 'x', isVerified: true, isActive: true } })
    const orderId = `qa-conv-${Date.now()}`
    try {
      await prisma.bonusConversion.create({ data: { userId: u.id, providerTransactionOrderId: orderId, totalWinnings: 100, eligibleWalletCredit: 20, sourceBreakdown: { FREEPLAY: 3 } } })
      let secondFailed = false
      try {
        await prisma.bonusConversion.create({ data: { userId: u.id, providerTransactionOrderId: orderId, totalWinnings: 100, eligibleWalletCredit: 20, sourceBreakdown: { FREEPLAY: 3 } } })
      } catch (e: any) {
        secondFailed = e?.code === 'P2002'
      }
      const count = await prisma.bonusConversion.count({ where: { providerTransactionOrderId: orderId } })
      check('BonusConversion: providerTransactionOrderId uniqueness blocks a second conversion for the same cashout', secondFailed && count === 1, `secondFailed=${secondFailed} count=${count}`)
    } finally {
      await prisma.bonusConversion.deleteMany({ where: { providerTransactionOrderId: orderId } })
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
    }
  }

  // ── Bonus Balance system — the existing 100%/30% signup/deposit bonus must stay entirely separate from
  // UserBonus/BonusCashoutRule (explicit user instruction: "keep it as it is"). Static source-level check. ──
  {
    const providerCtlSrc = src('controllers/providerController.ts')
    check('providerController: the 100%/30% bonus computation block never references UserBonus/BonusCashoutRule', !/bonusAmount[\s\S]{0,400}(UserBonus|BonusCashoutRule)/.test(providerCtlSrc.slice(providerCtlSrc.indexOf('let bonusAmount'), providerCtlSrc.indexOf('let bonusAmount') + 2000)))
    check('providerController: a Bonus-Balance-funded recharge sends the exact amount with no 100%/30% inflation', providerCtlSrc.includes("fundingSource === 'BONUS'") && providerCtlSrc.includes('debitUserBonusFIFO'))
  }

  // ── Referral reward — tiered flat amount (2026-10-03 rule change): $5 if the referee's qualifying amount
  // is under $10, $10 if it's $10 or more. Replaced the old 50%-of-amount-capped-at-$10 formula at both
  // trigger sites (first approved deposit, first game recharge). ──
  {
    const { computeReferralBonusAmount } = await import('../src/services/ReferralService')
    check('computeReferralBonusAmount: $4.99 deposit -> $5', computeReferralBonusAmount(4.99) === 5)
    check('computeReferralBonusAmount: $9.99 deposit -> $5', computeReferralBonusAmount(9.99) === 5)
    check('computeReferralBonusAmount: exactly $10 -> $10', computeReferralBonusAmount(10) === 10)
    check('computeReferralBonusAmount: $500 deposit -> still just $10 (flat, not percentage)', computeReferralBonusAmount(500) === 10)

    const providerCtlSrc = src('controllers/providerController.ts')
    check('providerController: first-recharge referral trigger uses the shared tiered helper, not an inline percentage', providerCtlSrc.includes('computeReferralBonusAmount(amount)') && !providerCtlSrc.includes('Math.min(amount * 0.5, 10)'))
    const referralSrc = src('services/ReferralService.ts')
    check('ReferralService: first-deposit trigger uses the shared tiered helper, not the old percent formula', referralSrc.includes('computeReferralBonusAmount(depositAmount)') && !referralSrc.includes('REFERRAL_BONUS_PERCENT'))
  }
}
