import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGenerate, mockPut } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    images = { generate: mockGenerate }
  },
}))

vi.mock('@vercel/blob', () => ({ put: mockPut }))

import { generateImage } from './image-gen'

const FAKE_B64 = Buffer.from('fake-image-bytes').toString('base64')

describe('generateImage', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockPut.mockReset()
    mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/fake.png' })
  })

  it('base64 görseli Vercel Blob\'a yükleyip kalıcı URL döner', async () => {
    mockGenerate.mockResolvedValue({ data: [{ b64_json: FAKE_B64 }] })

    const result = await generateImage('minimal dashboard illustration')

    expect(result).toBe('https://blob.vercel-storage.com/fake.png')
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-1',
        prompt: expect.stringContaining('minimal dashboard illustration'),
      })
    )
    const sentPrompt = mockGenerate.mock.calls[0][0].prompt as string
    expect(sentPrompt).toContain('#D4AF37')
    expect(sentPrompt).toContain('#0B0B0D')

    const [pathname, body, options] = mockPut.mock.calls[0]
    expect(pathname).toMatch(/^content-images\/\d+\.png$/)
    expect(Buffer.isBuffer(body)).toBe(true)
    expect((body as Buffer).toString()).toBe('fake-image-bytes')
    expect(options).toEqual({ access: 'public', contentType: 'image/png' })
  })

  it('base64 veri dönmezse hata fırlatır ve yükleme yapmaz', async () => {
    mockGenerate.mockResolvedValue({ data: [{}] })

    await expect(generateImage('prompt')).rejects.toThrow('Görsel üretiminden veri dönmedi')
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('data dizisi boşsa hata fırlatır', async () => {
    mockGenerate.mockResolvedValue({ data: [] })

    await expect(generateImage('prompt')).rejects.toThrow('Görsel üretiminden veri dönmedi')
  })
})
