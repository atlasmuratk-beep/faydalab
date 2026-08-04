import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { findMany: mocks.findMany } } }))

import { GET } from './route'

describe('GET /api/admin/messages', () => {
  it('mesajları en yeniden eskiye sıralı döner', async () => {
    mocks.findMany.mockResolvedValue([{ id: '1' }])
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual([{ id: '1' }])
    expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
  })
})
