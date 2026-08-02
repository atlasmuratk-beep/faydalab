import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  refreshLongLivedToken: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { integrationToken: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/instagram', () => ({ refreshLongLivedToken: mocks.refreshLongLivedToken }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/token/refresh', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/token/refresh', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/token/refresh', { method: 'POST' })
    )
    expect(response.status).toBe(401)
  })

  it('kayıtlı token yoksa 404 döner ve uyarı gönderir', async () => {
    mocks.findUnique.mockResolvedValue(null)

    const response = await POST(makeRequest())

    expect(response.status).toBe(404)
    expect(mocks.sendAlert).toHaveBeenCalled()
  })

  it('başarılı yenilemede token günceller', async () => {
    mocks.findUnique.mockResolvedValue({ accessToken: 'old-token' })
    mocks.refreshLongLivedToken.mockResolvedValue({
      accessToken: 'new-token',
      expiresInSeconds: 5184000,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'instagram' },
        data: expect.objectContaining({ accessToken: 'new-token' }),
      })
    )
  })

  it('yenileme başarısız olursa ACİL uyarı gönderir', async () => {
    mocks.findUnique.mockResolvedValue({ accessToken: 'old-token' })
    mocks.refreshLongLivedToken.mockRejectedValue(new Error('refresh hatası'))

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('ACİL'))
  })
})
