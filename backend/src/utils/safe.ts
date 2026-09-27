import dns from 'dns'
import net from 'net'

/** Escape LIKE/ILIKE wildcards so `mode: 'insensitive'` equality can't be used with % or _ as a wildcard. */
export const escapeLike = (s: string) => String(s).replace(/[\\%_]/g, '\\$&')

/** HTML-escape a value before interpolating it into an HTML email/page. */
export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/**
 * One safe CSV cell: neutralises spreadsheet formulas (= + - @ and tab/CR prefixes), removes line breaks
 * (row injection), doubles quotes and always quotes the field.
 */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '').replace(/[\r\n]+/g, ' ')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Only http(s) URLs or site-relative paths — blocks javascript:, data:, etc. */
export const isSafeLinkUrl = (v: unknown) => {
  const s = String(v ?? '').trim()
  if (!s) return true
  if (s.startsWith('/') && !s.startsWith('//')) return true
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'tg:' } catch { return false }
}

const blocked = new net.BlockList()
for (const [net4, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]] as Array<[string, number]>) blocked.addSubnet(net4, bits, 'ipv4')
for (const [net6, bits] of [['::', 96], ['::1', 128], ['64:ff9b::', 96], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as Array<[string, number]>) blocked.addSubnet(net6, bits, 'ipv6')
// (::/96 also covers the deprecated IPv4-compatible form; BlockList maps ::ffff:a.b.c.d onto the IPv4 rules)
const isPrivateAddress = (ip: string) => {
  const v = ip.replace(/^\[|\]$/g, '')
  const fam = net.isIPv4(v) ? 'ipv4' : net.isIPv6(v) ? 'ipv6' : null
  return fam ? blocked.check(v, fam) : true // anything unparsable is refused
}

/**
 * Validates an admin-supplied provider URL: http(s) only, no credentials in the URL, and the host must not
 * resolve to a loopback / private / link-local / metadata address (SSRF + credential-exfiltration guard).
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL
  try { u = new URL(String(raw).trim()) } catch { throw new Error('Invalid URL') }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http(s) URLs are allowed')
  if (u.username || u.password) throw new Error('URLs with embedded credentials are not allowed')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Internal hostnames are not allowed')
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Private or loopback addresses are not allowed')
    return
  }
  let addrs: dns.LookupAddress[]
  try { addrs = await dns.promises.lookup(host, { all: true }) } catch { throw new Error('Host does not resolve') }
  if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('Host resolves to a private or loopback address')
}

/** Expand an IPv6 address to 8 hextets (used to bucket rate limits by /64). */
export function ipv6Prefix64(ip: string): string {
  let v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v.startsWith('::ffff:') && net.isIPv4(v.slice(7))) return v.slice(7)
  const [head, tail = ''] = v.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const fill = v.includes('::') ? Array(Math.max(0, 8 - h.length - t.length)).fill('0') : []
  const full = [...h, ...fill, ...t].map(x => x.padStart(4, '0'))
  return full.slice(0, 4).join(':') + '::/64'
}

/** Copy of a DB row without internal columns (staff Telegram ids, admin notes, ...) before it is sent to the row's owner. */
export const stripInternal = <T extends Record<string, any>>(row: T, keys: string[]): T => {
  const out: Record<string, any> = { ...row }
  for (const k of keys) delete out[k]
  if (out.paymentMethod && typeof out.paymentMethod === 'object') delete out.paymentMethod.apiConfig
  return out as T
}
