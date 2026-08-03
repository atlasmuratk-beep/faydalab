import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderReel } from './reel-renderer-client'

describe('renderReel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    process.env.REEL_RENDERER_URL = 'https://reel-renderer.example.com'
    process.env.INTERNAL_API_SECRET = 'test-secret'
  })

  it('render servisine doğru istek atar ve videoUrl döner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://blob.vercel-storage.com/video.mp4' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await renderReel({
      backgroundImageUrl: 'https://x/img.png',
      segments: [{ text: 'a', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
    })

    expect(result.videoUrl).toBe('https://blob.vercel-storage.com/video.mp4')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://reel-renderer.example.com/render',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-secret' }),
      })
    )
  })

  it('REEL_RENDERER_URL tanımlı değilse hata fırlatır', async () => {
    delete process.env.REEL_RENDERER_URL

    await expect(
      renderReel({ backgroundImageUrl: 'https://x/img.png', segments: [] })
    ).rejects.toThrow('REEL_RENDERER_URL')
  })

  it('render servisi hata dönerse hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'render_failed' })
    )

    await expect(
      renderReel({ backgroundImageUrl: 'https://x/img.png', segments: [] })
    ).rejects.toThrow('Reel render isteği başarısız')
  })

  it('INTERNAL_API_SECRET tanımlı değilse hata fırlatır', async () => {
    delete process.env.INTERNAL_API_SECRET

    await expect(
      renderReel({ backgroundImageUrl: 'https://x/img.png', segments: [] })
    ).rejects.toThrow('INTERNAL_API_SECRET')
  })
})
