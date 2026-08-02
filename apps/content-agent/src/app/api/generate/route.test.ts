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

  it('sütun seçimi başarısız olursa 500 döner ve uyarı gönderir', async () => {
    mocks.getNextPillar.mockRejectedValue(new Error('db okuma hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'pillar_selection_failed' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('db okuma hatası'))
    expect(mocks.generateCaption).not.toHaveBeenCalled()
  })

  it('ContentItem kaydı oluşturulamazsa 500 döner ve uyarı gönderir', async () => {
    mocks.create.mockRejectedValue(new Error('insert hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'content_persist_failed' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('insert hatası'))
    expect(mocks.sendContentPreview).not.toHaveBeenCalled()
  })

  it('Telegram gönderimi başarısız olursa uyarı gönderir ve GENERATION_FAILED işaretler', async () => {
    mocks.sendContentPreview.mockRejectedValue(new Error('telegram 400'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'telegram_send_failed' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('telegram 400'))
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'GENERATION_FAILED' } })
    )
  })

  it('Telegram önizleme metnini 1024 sınırının altına kısaltır ama kaydı bozmaz', async () => {
    const longCaption = 'a'.repeat(1500)
    mocks.generateCaption.mockResolvedValue({
      topic: 'Konu',
      caption: longCaption,
      hashtags: ['ai'],
      imagePrompt: 'prompt',
    })

    await POST(makeRequest())

    const previewText = mocks.sendContentPreview.mock.calls[0][2]
    expect(previewText.length).toBeLessThanOrEqual(1024)
    expect(previewText.endsWith('…')).toBe(true)

    // Kaydedilen caption kısaltılmamış olmalı
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ caption: longCaption }) })
    )
  })
})
