import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  publishImage: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contentItem: { findMany: mocks.findMany, update: mocks.update },
    integrationToken: { findUnique: mocks.findUnique },
  },
}))
vi.mock('@/lib/instagram', () => ({ publishImage: mocks.publishImage }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/publish', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/publish', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    process.env.INSTAGRAM_USER_ID = 'ig-user-1'
    mocks.findUnique.mockResolvedValue({ accessToken: 'token' })
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(new Request('http://localhost/api/publish', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('zamanı gelen onaylı içerikleri yayınlar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: ['a'], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockResolvedValue({ mediaId: 'media-1' })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(1)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1' },
        data: expect.objectContaining({ status: 'PUBLISHED', instagramMediaId: 'media-1' }),
      })
    )
  })

  it('yayın başarısız olursa PUBLISH_FAILED işaretler ve uyarı gönderir', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockRejectedValue(new Error('graph api hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.results[0]).toEqual({ id: 'content-1', status: 'failed' })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PUBLISH_FAILED' } })
    )
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('graph api hatası'))
  })

  it('token bulunamazsa uyarı gönderip döngüyü durdurur', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(0)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('token bulunamadı'))
  })
})
