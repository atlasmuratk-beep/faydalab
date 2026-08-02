import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  publishImage: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contentItem: {
      findMany: mocks.findMany,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
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
    delete process.env.PUBLISH_MODE
    mocks.findUnique.mockResolvedValue({ accessToken: 'token' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.update.mockResolvedValue({})
    mocks.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.PUBLISH_MODE
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(new Request('http://localhost/api/publish', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('zamanı gelen onaylı içerikleri yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: ['a'], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockResolvedValue({ mediaId: 'media-1' })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(1)
    expect(body.results[0]).toEqual({ id: 'content-1', status: 'published' })
    expect(mocks.publishImage).toHaveBeenCalledWith(
      'token',
      'ig-user-1',
      'https://x/img.png',
      expect.stringContaining('#a')
    )
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1' },
        data: expect.objectContaining({ status: 'PUBLISHED', instagramMediaId: 'media-1' }),
      })
    )
  })

  it('yalnızca görseli olan içerikleri sorgular', async () => {
    await POST(makeRequest())

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED', imageUrl: { not: null } }),
      })
    )
  })

  it('draft modda token aramaz ve boş token ile yayınlar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockResolvedValue({ mediaId: 'draft-media-1' })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.publishImage).toHaveBeenCalledWith(
      '',
      'ig-user-1',
      'https://x/img.png',
      expect.any(String)
    )
    expect(body.results[0]).toEqual({ id: 'content-1', status: 'published' })
  })

  it('iyimser kilit tutmazsa içeriği atlar, yayınlamaz', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.results[0]).toEqual({ id: 'content-1', status: 'skipped' })
    expect(mocks.publishImage).not.toHaveBeenCalled()
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1', status: 'APPROVED' },
        data: { status: 'SCHEDULED' },
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

  it('yayın sonrası DB güncellemesi hata verirse uyarı gönderir ama published sayar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockResolvedValue({ mediaId: 'media-9' })
    mocks.update.mockRejectedValueOnce(new Error('db yazma hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.results[0]).toEqual({ id: 'content-1', status: 'published' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('media-9'))
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('manuel kontrol'))
  })

  it('canlı modda token bulunamazsa uyarı gönderip hiçbir şey yayınlamaz', async () => {
    process.env.PUBLISH_MODE = 'live'
    mocks.findUnique.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(0)
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.publishImage).not.toHaveBeenCalled()
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('token bulunamadı'))
  })
})
