import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
;(async () => {
  const v: any = await p.provider.findFirst({ where: { name: 'Panda Master' } })
  console.log('base:', JSON.stringify(v.apiBaseUrl), '| endpoints:', JSON.stringify(v.endpoints), '| updated', v.updatedAt.toISOString())
  await p.$disconnect()
})()
