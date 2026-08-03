import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getNextPillar: vi.fn(),
  getRecentTopics: vi.fn(),
  generateReelScript: vi.fn(),
  generateSpeech: vi.fn(),
  generateImage: vi.fn(),
  renderReel: vi.fn(),
  sendReelPreview: vi.fn(),
  sendAlert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/content-pillars', () => ({
  getNextPillar: mocks.getNextPillar,
  getRecentTopics: mocks.getRecentTopics,
}))
vi.mock('@/lib/claude', () => ({ generateReelScript: mocks.generateReelScript }))
vi.mock('@/lib/tts', () => ({ generateSpeech: mocks.generateSpeech }))
vi.mock('@/lib/image-gen', () => ({ generateImage: mocks.generateImage }))
vi.mock('@/lib/reel-renderer-client', () => ({ renderReel: mocks.renderReel }))
vi.mock('@/lib/telegram', () => ({
  sendReelPreview: mocks.sendReelPreview,
  sendAlert: mocks.sendAlert,
}))
vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { create: mocks.create, update: mocks.update } },
}))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/generate-reel', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/generate-reel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mocks.getNextPillar.mockResolvedValue('AI_AUTOMATION')
    mocks.getRecentTopics.mockResolvedValue([])
    mocks.generateReelScript.mockResolvedValue({
      topic: 'Konu',
      hook: 'Kanca',
      beats: ['Birinci', 'İkinci'],
      cta: 'Çağrı',
      hashtags: ['ai'],
    })
    mocks.generateSpeech.mockImplementation(async (text: string) => ({
      audioUrl: `https://x/${text}.wav`,
      durationMs: 1000,
    }))
    mocks.generateImage.mockResolvedValue('https://example.com/bg.png')
    mocks.renderReel.mockResolvedValue({ videoUrl: 'https://example.com/video.mp4' })
    mocks.create.mockResolvedValue({ id: 'reel-1' })
    mocks.sendReelPreview.mockResolvedValue({ chatId: '1', messageId: '2' })
    mocks.update.mockResolvedValue({})
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(new Request('http://localhost/api/generate-reel', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('başarılı akışta 4 cümleyi seslendirir, render eder ve Telegram\'a gönderir', async () => {
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ id: 'reel-1', status: 'PENDING_APPROVAL' })
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(4) // hook + 2 beats + cta
    expect(mocks.renderReel).toHaveBeenCalledWith({
      backgroundImageUrl: 'https://example.com/bg.png',
      segments: expect.arrayContaining([
        expect.objectContaining({ text: 'Kanca' }),
      ]),
    })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          format: 'REEL',
          imageUrl: 'https://example.com/bg.png',
          videoUrl: 'https://example.com/video.mp4',
        }),
      })
    )
    expect(mocks.sendReelPreview).toHaveBeenCalled()
  })

  it('sütun seçimi başarısız olursa 500 döner', async () => {
    mocks.getNextPillar.mockRejectedValue(new Error('db hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'pillar_selection_failed' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('db hatası'))
  })

  it('senaryo üretimi başarısız olursa 500 döner', async () => {
    mocks.generateReelScript.mockRejectedValue(new Error('claude hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'script_generation_failed' })
  })

  it('seslendirme başarısız olursa 500 döner', async () => {
    mocks.generateSpeech.mockRejectedValue(new Error('tts hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'speech_generation_failed' })
  })

  it('render başarısız olursa 500 döner', async () => {
    mocks.renderReel.mockRejectedValue(new Error('render hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'render_failed' })
  })

  it('Telegram gönderimi başarısız olursa GENERATION_FAILED işaretler', async () => {
    mocks.sendReelPreview.mockRejectedValue(new Error('telegram hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'telegram_send_failed' })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'GENERATION_FAILED' } })
    )
  })

  it('görsel üretimi başarısız olursa 500 döner', async () => {
    mocks.generateImage.mockRejectedValue(new Error('görsel hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'image_generation_failed' })
    expect(mocks.sendAlert).toHaveBeenCalled()
  })

  it('içerik kaydı oluşturulamazsa 500 döner', async () => {
    mocks.create.mockRejectedValue(new Error('db hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'content_persist_failed' })
    expect(mocks.sendAlert).toHaveBeenCalled()
  })
})
