import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { tenant: { update: mocks.update } } }))
vi.mock('@/lib/stripe', () => ({ stripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent } }) }))

import { POST } from './route'

function makeRequest(body: string, signature: string | null = 'valid-sig'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers, body })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    mocks.constructEvent.mockReset()
    mocks.update.mockReset()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('imza header eksikse 403 döner', async () => {
    const response = await POST(makeRequest('{}', null))
    expect(response.status).toBe(403)
  })

  it('geçersiz imza için 400 döner', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(400)
  })

  it('checkout.session.completed olayında tenant planı ve durumu güncellenir', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 'tenant-1', plan: 'PRO' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { plan: 'PRO', subscriptionStatus: 'ACTIVE', stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123' },
    })
  })

  it('customer.subscription.deleted olayında tenant CANCELED yapılır', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { tenantId: 'tenant-1' } } },
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { subscriptionStatus: 'CANCELED' } })
  })

  it('bilinmeyen olay tipinde güncelleme yapmadan 200 döner', async () => {
    mocks.constructEvent.mockReturnValue({ type: 'some.other.event', data: { object: {} } })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
