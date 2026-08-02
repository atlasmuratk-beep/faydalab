import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    images = { generate: mockGenerate }
  },
}))

import { generateImage } from './image-gen'

describe('generateImage', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
  })

  it('OpenAI yanıtından görsel URL döner', async () => {
    mockGenerate.mockResolvedValue({ data: [{ url: 'https://example.com/image.png' }] })

    const result = await generateImage('minimal dashboard illustration')

    expect(result).toBe('https://example.com/image.png')
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-1', prompt: 'minimal dashboard illustration' })
    )
  })

  it('URL dönmezse hata fırlatır', async () => {
    mockGenerate.mockResolvedValue({ data: [{}] })

    await expect(generateImage('prompt')).rejects.toThrow('Görsel üretiminden URL dönmedi')
  })
})
