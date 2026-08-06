import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  findUniqueOrThrowTenant: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireSession: mocks.requireSession }))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUniqueOrThrow: mocks.findUniqueOrThrowTenant } } }))
vi.mock('@/lib/stripe', () => ({
  stripeClient: () => ({ billingPortal: { sessions: { create: mocks.create } } }),
}))

import { POST } from './route'

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.findUniqueOrThrowTenant.mockReset()
    mocks.create.mockReset()
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const response = await POST()
    expect(response.status).toBe(401)
  })

  it('stripeCustomerId yoksa 409 döner', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({ id: 'tenant-1', stripeCustomerId: null })
    const response = await POST()
    expect(response.status).toBe(409)
  })

  it('stripeCustomerId varsa portal session oluşturur ve url döner', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({ id: 'tenant-1', stripeCustomerId: 'cus_123' })
    mocks.create.mockResolvedValue({ url: 'https://billing.stripe.com/session-1' })
    const response = await POST()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.url).toBe('https://billing.stripe.com/session-1')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_123' }))
  })
})
