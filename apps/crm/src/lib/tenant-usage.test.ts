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
    })
    mocks.update.mockResolvedValue({ plan: 'PRO', monthlyLeadCount: 1000 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'PRO', overLimit: false })
  })

  it('BASLANGIC planda 50 lead altındaysa sınır aşılmaz', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 10,
      monthlyLeadCountResetAt: new Date(),
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 11 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: false })
  })

  it('BASLANGIC planda 50 lead üzerine çıkınca sınır aşılır', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 50,
      monthlyLeadCountResetAt: new Date(),
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 51 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: true })
  })

  it('30 günden eski resetAt varsa sayaç sıfırlanıp 1den başlar', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 500,
      monthlyLeadCountResetAt: old,
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 1 })
    await recordLeadForTenant('t1')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ monthlyLeadCount: 1 }),
    })
  })
})
