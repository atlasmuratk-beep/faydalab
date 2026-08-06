import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { lead: { update: mocks.update } } }))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue('user-1') }))

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
    mocks.update.mockReset()
  })

  it('geçersiz status için 400 döner', async () => {
    const response = await PATCH(makeRequest({ status: 'GECERSIZ' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('geçerli status ile günceller', async () => {
    mocks.update.mockResolvedValue({ id: 'lead-1', status: 'ILETISIMDE' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { status: 'ILETISIMDE' } })
  })

  it('bulunamayan lead için 404 döner', async () => {
    mocks.update.mockRejectedValue({ code: 'P2025' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(404)
  })
})
