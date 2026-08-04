import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { section: { findMany: mocks.findMany, create: mocks.create, aggregate: mocks.aggregate } },
}))

import { GET, POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/sections', () => {
  it('sıralı section listesini döner', async () => {
    mocks.findMany.mockResolvedValue([{ id: '1', order: 0 }])
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual([{ id: '1', order: 0 }])
    expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { order: 'asc' } })
  })
})

describe('POST /api/admin/sections', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.aggregate.mockReset()
  })

  it('geçersiz tip için 400 döner', async () => {
    const response = await POST(makeRequest({ type: 'INVALID', content: {} }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('geçersiz içerik için 400 döner', async () => {
    const response = await POST(makeRequest({ type: 'HERO', content: { title: 'a' } }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('geçerli veriyle section oluşturur ve sıradaki order değerini atar', async () => {
    mocks.aggregate.mockResolvedValue({ _max: { order: 2 } })
    mocks.create.mockResolvedValue({ id: 'new-1', order: 3 })
    const response = await POST(
      makeRequest({ type: 'HERO', content: { title: 't', subtitle: 's', ctaText: 'c', ctaLink: '#x' } })
    )
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 3, visible: true }) })
    )
  })

  it('hiç section yokken order 0 atanır', async () => {
    mocks.aggregate.mockResolvedValue({ _max: { order: null } })
    mocks.create.mockResolvedValue({ id: 'new-1', order: 0 })
    await POST(makeRequest({ type: 'CONTACT', content: { title: 't', subtitle: 's' } }))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }))
  })
})
