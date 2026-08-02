import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

import { generateCaption } from './claude'

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
