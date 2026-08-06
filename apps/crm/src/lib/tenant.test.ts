import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUnique: mocks.findUnique, create: mocks.create } } }))

import { createTenant } from './tenant'

describe('createTenant', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.create.mockReset()
  })

  it('işletme adından slug üretir', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'tenant-1', slug: 'gazi-usta-kebap' })
    await createTenant('Gazi-Usta Kebap')
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'gazi-usta-kebap', name: 'Gazi-Usta Kebap' }) })
    )
  })

  it('slug çakışırsa sayı ekleyerek benzersizleştirir', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null)
    mocks.create.mockResolvedValue({ id: 'tenant-2', slug: 'kafe-1' })
    await createTenant('Kafe')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: 'kafe-1' }) }))
  })

  it('deneme bitiş tarihini 14 gün sonrasına ayarlar', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'tenant-1' })
    const before = Date.now()
    await createTenant('Test')
    const call = mocks.create.mock.calls[0][0]
    const trialEndsAt = call.data.trialEndsAt as Date
    expect(trialEndsAt.getTime()).toBeGreaterThan(before + 13 * 24 * 60 * 60 * 1000)
    expect(trialEndsAt.getTime()).toBeLessThan(before + 15 * 24 * 60 * 60 * 1000)
  })
})
