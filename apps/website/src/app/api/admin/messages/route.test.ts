import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), requireSession: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { findMany: mocks.findMany } } }))
vi.mock('@/lib/auth', () => ({ requireSession: mocks.requireSession }))

import { GET } from './route'

describe('GET /api/admin/messages', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.requireSession.mockResolvedValue('user-1')
    mocks.findMany.mockReset()
  })

  it('mesajları en yeniden eskiye sıralı döner', async () => {
    mocks.findMany.mockResolvedValue([{ id: '1' }])
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual([{ id: '1' }])
    expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
