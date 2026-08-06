import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUnique: mocks.findUnique } } }))

import { resolveTenantBySecret } from './tenant-ingest'

describe('resolveTenantBySecret', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
  })

  it('secret null ise sorgu yapmadan null döner', async () => {
    const result = await resolveTenantBySecret(null)
    expect(result).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('eşleşen tenant varsa döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'tenant-1', ingestSecret: 'abc' })
    const result = await resolveTenantBySecret('abc')
    expect(result).toEqual({ id: 'tenant-1', ingestSecret: 'abc' })
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { ingestSecret: 'abc' } })
  })

  it('eşleşme yoksa null döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const result = await resolveTenantBySecret('yanlış')
    expect(result).toBeNull()
  })
})
