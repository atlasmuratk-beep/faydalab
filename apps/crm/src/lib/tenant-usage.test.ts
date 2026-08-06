import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUniqueOrThrow: mocks.findUniqueOrThrow, update: mocks.update } } }))

import { recordLeadForTenant } from './tenant-usage'

describe('recordLeadForTenant', () => {
  beforeEach(() => {
    mocks.findUniqueOrThrow.mockReset()
    mocks.update.mockReset()
  })

  it('PRO planda sınır aşılmaz', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'PRO',
      monthlyLeadCount: 999,
      monthlyLeadCountResetAt: new Date(),
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    mocks.update.mockResolvedValue({
      plan: 'PRO',
      monthlyLeadCount: 1000,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'PRO', overLimit: false, subscriptionActive: true })
  })

  it('BASLANGIC planda 50 lead altındaysa sınır aşılmaz', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 10,
      monthlyLeadCountResetAt: new Date(),
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    mocks.update.mockResolvedValue({
      plan: 'BASLANGIC',
      monthlyLeadCount: 11,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: false, subscriptionActive: true })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { monthlyLeadCount: { increment: 1 } },
    })
  })

  it('BASLANGIC planda 50 lead üzerine çıkınca sınır aşılır', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 50,
      monthlyLeadCountResetAt: new Date(),
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    mocks.update.mockResolvedValue({
      plan: 'BASLANGIC',
      monthlyLeadCount: 51,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: true, subscriptionActive: true })
  })

  it('30 günden eski resetAt varsa sayaç sıfırlanıp 1den başlar', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 500,
      monthlyLeadCountResetAt: old,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    mocks.update.mockResolvedValue({
      plan: 'BASLANGIC',
      monthlyLeadCount: 1,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    })
    await recordLeadForTenant('t1')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ monthlyLeadCount: 1 }),
    })
  })

  it('abonelik süresi dolmuşsa subscriptionActive false döner', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 5,
      monthlyLeadCountResetAt: new Date(),
      subscriptionStatus: 'TRIALING',
      trialEndsAt: past,
    })
    mocks.update.mockResolvedValue({
      plan: 'BASLANGIC',
      monthlyLeadCount: 6,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: past,
    })
    const result = await recordLeadForTenant('t1')
    expect(result.subscriptionActive).toBe(false)
  })
})
