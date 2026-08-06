import type { Tenant } from '@prisma/client'

export function hasActiveSubscription(tenant: Pick<Tenant, 'subscriptionStatus' | 'trialEndsAt'>): boolean {
  if (tenant.subscriptionStatus === 'ACTIVE') return true
  if (tenant.subscriptionStatus === 'TRIALING') {
    return tenant.trialEndsAt !== null && tenant.trialEndsAt.getTime() > Date.now()
  }
  return false
}
