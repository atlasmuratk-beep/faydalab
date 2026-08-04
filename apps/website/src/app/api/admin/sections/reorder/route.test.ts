import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    section: { findUnique: mocks.findUnique, findFirst: mocks.findFirst, update: mocks.update },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue('user-1') }))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/sections/reorder', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.findFirst.mockReset()
    mocks.transaction.mockReset()
  })

  it('geçersiz yön için 400 döner', async () => {
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'sideways' }))
    expect(response.status).toBe(400)
  })

  it('bulunamayan section için 404 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'up' }))
    expect(response.status).toBe(404)
  })

  it('en üstteki section yukarı taşınmak istendiğinde komşu yoksa sessizce başarılı döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', order: 0 })
    mocks.findFirst.mockResolvedValue(null)
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'up' }))
    expect(response.status).toBe(200)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('geçerli istekte komşu ile order değerlerini takas eder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-2', order: 1 })
    mocks.findFirst.mockResolvedValue({ id: 'sec-1', order: 0 })
    mocks.transaction.mockResolvedValue([{}, {}])
    const response = await POST(makeRequest({ id: 'sec-2', direction: 'up' }))
    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalled()
  })
})
