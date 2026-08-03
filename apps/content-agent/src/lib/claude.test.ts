import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

import { generateCaption, generateReelScript } from './claude'

describe('generateCaption', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('Claude yanıtını parse edip GeneratedCaption döner', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'AI ile fatura otomasyonu',
            caption: 'Örnek caption metni',
            hashtags: ['yapayzeka', 'otomasyon'],
            imagePrompt: 'minimal dashboard illustration',
          }),
        },
      ],
    })

    const result = await generateCaption('AI_AUTOMATION', ['önceki konu'])

    expect(result.topic).toBe('AI ile fatura otomasyonu')
    expect(result.hashtags).toEqual(['yapayzeka', 'otomasyon'])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' })
    )
  })

  it('şemaya uymayan JSON yanıtında hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ topic: 'Konu', caption: 'metin' }) }],
    })

    await expect(generateCaption('AI_AUTOMATION', [])).rejects.toThrow()
  })

  it('hashtags dizi değilse hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'Konu',
            caption: 'metin',
            hashtags: 'ai',
            imagePrompt: 'p',
          }),
        },
      ],
    })

    await expect(generateCaption('AI_AUTOMATION', [])).rejects.toThrow()
  })

  it('metin bloğu yoksa hata fırlatır', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(generateCaption('AI_AUTOMATION', [])).rejects.toThrow(
      'Claude yanıtında metin bloğu bulunamadı'
    )
  })
})

describe('generateReelScript', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('Claude yanıtını parse edip GeneratedReelScript döner', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'AI ile randevu yönetimi',
            hook: 'Randevularınızı unutmaktan bıktınız mı?',
            beats: ['Birinci fayda cümlesi.', 'İkinci fayda cümlesi.'],
            cta: 'Konuşalım.',
            hashtags: ['yapayzeka', 'otomasyon'],
          }),
        },
      ],
    })

    const result = await generateReelScript('AI_AUTOMATION', [])

    expect(result.hook).toBe('Randevularınızı unutmaktan bıktınız mı?')
    expect(result.beats).toHaveLength(2)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' })
    )
  })

  it('şemaya uymayan JSON yanıtında hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ topic: 'Konu' }) }],
    })

    await expect(generateReelScript('AI_AUTOMATION', [])).rejects.toThrow()
  })

  it('beats dizisi boşsa hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'Konu',
            hook: 'Kanca',
            beats: [],
            cta: 'CTA',
            hashtags: [],
          }),
        },
      ],
    })

    await expect(generateReelScript('AI_AUTOMATION', [])).rejects.toThrow()
  })
})
