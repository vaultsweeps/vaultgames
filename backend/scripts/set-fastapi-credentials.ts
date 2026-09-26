/**
 * Update the FastAPI credentials (UltraPanda / Vblink style providers) without touching
 * the provider's other endpoint overrides (recharge, withdraw, createPlayer, ...).
 *
 *   npx ts-node scripts/set-fastapi-credentials.ts <provider name> [options]
 *
 *   --base <url>          API server domain, e.g. https://www.example.com
 *   --appid <id>          appid issued by the provider for that domain
 *   --appsecret <secret>  appsecret issued by the provider for that domain
 *   --clear-static        remove the stored appid/appsecret so the service logs in with
 *                         the provider's agentId/secretKey (agent account + password)
 *   --dry-run             print what would change, write nothing
 *
 * Runs against the DATABASE_URL in backend/.env (the live database) — use --dry-run first.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const name = process.argv[2]
  if (!name || name.startsWith('--')) {
    console.error('Usage: npx ts-node scripts/set-fastapi-credentials.ts <provider name> [--base URL] [--appid ID --appsecret SECRET | --clear-static] [--dry-run]')
    process.exit(1)
  }
  const provider = await prisma.provider.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  if (!provider) throw new Error(`Provider "${name}" not found`)

  const base = arg('base')
  const appid = arg('appid')
  const appsecret = arg('appsecret')
  if ((appid && !appsecret) || (!appid && appsecret)) throw new Error('Pass --appid and --appsecret together')
  if (flag('clear-static') && (appid || appsecret)) throw new Error('--clear-static cannot be combined with --appid/--appsecret')

  const endpoints: Record<string, any> = { ...((provider.endpoints as Record<string, any>) || {}) }
  if (appid && appsecret) { endpoints.appid = appid.trim(); endpoints.appsecret = appsecret.trim() }
  if (flag('clear-static')) { delete endpoints.appid; delete endpoints.appsecret }

  const data: Record<string, any> = { endpoints }
  if (base) data.apiBaseUrl = base.trim()

  console.log(`Provider: ${provider.name}`)
  console.log(`  apiBaseUrl : ${provider.apiBaseUrl}${base ? `  ->  ${data.apiBaseUrl}` : ''}`)
  console.log(`  static appid/appsecret : ${(provider.endpoints as any)?.appid ? 'set' : 'not set'}  ->  ${endpoints.appid ? 'set' : 'not set (agent login will be used)'}`)
  console.log(`  other endpoint keys kept: ${Object.keys(endpoints).filter(k => k !== 'appid' && k !== 'appsecret').join(', ') || '(none)'}`)

  if (flag('dry-run')) { console.log('Dry run — nothing written.'); return }
  await prisma.provider.update({ where: { id: provider.id }, data })
  console.log('Updated.')
}

main().catch(e => { console.error(e.message || e); process.exit(1) }).finally(() => prisma.$disconnect())
