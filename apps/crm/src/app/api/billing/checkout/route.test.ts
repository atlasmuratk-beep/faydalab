import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  findUniqueOrThrowTenant: vi.fn(),
  findUniqueOrThrowUser: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireSession: mocks.requireSession }))
vi.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUniqueOrThrow: mocks.findUniqueOrThrowTenant },
    adminUser: { findUniqueOrThrow: mocks.findUniqueOrThrowUser },
  },
}))
vi.mock('@/lib/stripe', () => ({
  stripeClient: () => ({ checkout: { sessions: { create: mocks.create } } }),
  priceIdForPlan: (plan: string) => `price_${plan.toLowerCase()}`,
}))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.findUniqueOrThrowTenant.mockReset()
    mocks.findUniqueOrThrowUser.mockReset()
    mocks.create.mockReset()
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const response = await POST(makeRequest({ plan: 'PRO' }))
    expect(response.status).toBe(401)
  })

  it('geçersiz plan için 400 döner', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    const response = await POST(makeRequest({ plan: 'GECERSIZ' }))
    expect(response.status).toBe(400)
  })

  it('mevcut stripeCustomerId varsa customer ile checkout session oluşturur', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      subscriptionStatus: 'TRIALING',
    })
    mocks.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session-1' })
    const response = await POST(makeRequest({ plan: 'PRO' }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.url).toBe('https://checkout.stripe.com/session-1')
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_123', line_items: [{ price: 'price_pro', quantity: 1 }] })
    )
  })

  it('stripeCustomerId yoksa customer_email ile checkout session oluşturur', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: 'TRIALING',
    })
    mocks.findUniqueOrThrowUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' })
    mocks.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session-2' })
    const response = await POST(makeRequest({ plan: 'BASLANGIC' }))
    expect(response.status).toBe(200)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customer_email: 'a@b.com' }))
  })

  it('zaten aktif abonesi varsa 409 döner', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'ACTIVE',
    })
    const response = await POST(makeRequest({ plan: 'PRO' }))
    expect(response.status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
