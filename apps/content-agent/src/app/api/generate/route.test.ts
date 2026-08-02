import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getNextPillar: vi.fn(),
  getRecentTopics: vi.fn(),
  generateCaption: vi.fn(),
  generateImage: vi.fn(),
  sendContentPreview: vi.fn(),
  sendAlert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/content-pillars', () => ({
  getNextPillar: mocks.getNextPillar,
  getRecentTopics: mocks.getRecentTopics,
}))
vi.mock('@/lib/claude', () => ({ generateCaption: mocks.generateCaption }))
vi.mock('@/lib/image-gen', () => ({ generateImage: mocks.generateImage }))
vi.mock('@/lib/telegram', () => ({
  sendContentPreview: mocks.sendContentPreview,
  sendAlert: mocks.sendAlert,
}))
vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { create: mocks.create, update: mocks.update } },
}))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/generate', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mocks.getNextPillar.mockResolvedValue('AI_AUTOMATION')
    mocks.getRecentTopics.mockResolvedValue([])
    mocks.generateCaption.mockResolvedValue({
      topic: 'Konu',
      caption: 'Caption',
      hashtags: ['ai'],
      imagePrompt: 'prompt',
    })
    mocks.generateImage.mockResolvedValue('https://example.com/img.png')
    mocks.create.mockResolvedValue({ id: 'content-1' })
    mocks.sendContentPreview.mockResolvedValue({ chatId: '1', messageId: '2' })
    mocks.update.mockResolvedValue({})
  })

  it('yetkisiz istekte 401 döner', async () => {
    const request = new Request('http://localhost/api/generate', { method: 'POST' })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('başarılı akışta içerik üretir ve Telegram\'a gönderir', async () => {
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ id: 'content-1', status: 'PENDING_APPROVAL' })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_APPROVAL', pillar: 'AI_AUTOMATION' }),
      })
    )
    expect(mocks.sendContentPreview).toHaveBeenCalled()
  })

  it('caption üretimi iki denemede de başarısız olursa 500 döner ve uyarı gönderir', async () => {
    mocks.generateCaption.mockRejectedValue(new Error('claude hatası'))

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('claude hatası'))
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
