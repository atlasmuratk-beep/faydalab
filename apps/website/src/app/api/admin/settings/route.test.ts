import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { siteSettings: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}))

import { GET, PATCH } from './route'

describe('GET /api/admin/settings', () => {
  it('singleton ayar kaydını döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, siteTitle: 'FaydaLab' })
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual({ id: 1, siteTitle: 'FaydaLab' })
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})

describe('PATCH /api/admin/settings', () => {
  beforeEach(() => {
    mocks.upsert.mockReset()
  })

  it('ayarları upsert eder', async () => {
    mocks.upsert.mockResolvedValue({ id: 1, siteTitle: 'Yeni Başlık' })
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Yeni Başlık', metaDescription: 'açıklama' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
