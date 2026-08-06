import { prisma } from './db'
import type { Tenant } from '@prisma/client'

export async function resolveTenantBySecret(secret: string | null): Promise<Tenant | null> {
  if (!secret) return null
  return prisma.tenant.findUnique({ where: { ingestSecret: secret } })
}
