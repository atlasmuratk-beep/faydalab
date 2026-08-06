import { prisma } from './db'
import type { Plan } from '@prisma/client'

const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000
const BASLANGIC_MONTHLY_LIMIT = 50

export async function recordLeadForTenant(tenantId: string): Promise<{ plan: Plan; overLimit: boolean }> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

  const shouldReset = Date.now() - tenant.monthlyLeadCountResetAt.getTime() > RESET_INTERVAL_MS

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: shouldReset
      ? { monthlyLeadCount: 1, monthlyLeadCountResetAt: new Date() }
      : { monthlyLeadCount: { increment: 1 } },
  })

  return {
    plan: updated.plan,
    overLimit: updated.plan === 'BASLANGIC' && updated.monthlyLeadCount > BASLANGIC_MONTHLY_LIMIT,
  }
}
