import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { lead: { updateMany: mocks.updateMany, findFirst: mocks.findFirst } } }))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' }) }))

import { PATCH } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/leads/lead-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/leads/[id]', () => {
  beforeEach(() => {
    mocks.updateMany.mockReset()
    mocks.findFirst.mockReset()
  })

  it('geçersiz status için 400 döner', async () => {
    const response = await PATCH(makeRequest({ status: 'GECERSIZ' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(400)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('geçerli status ile günceller', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findFirst.mockResolvedValue({ id: 'lead-1', status: 'ILETISIMDE' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-1' },
      data: { status: 'ILETISIMDE' },
    })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-1' },
    })
  })

  it('bulunamayan veya başka tenanta ait lead için 404 döner', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(404)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })
})
