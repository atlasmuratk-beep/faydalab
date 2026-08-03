import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishImage, publishReel, refreshLongLivedToken } from './instagram'

describe('publishImage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUBLISH_MODE draft ise gerçek API çağrısı yapmadan sahte mediaId döner', async () => {
    process.env.PUBLISH_MODE = 'draft'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toContain('draft-mode-')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('PUBLISH_MODE live ise media oluşturur, hazır olmasını bekler ve yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toBe('media-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('media hazır olana kadar durumu tekrar tekrar kontrol eder', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'IN_PROGRESS' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('setTimeout', ((fn: () => void) => fn()) as unknown as typeof setTimeout)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toBe('media-1')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('media durumu ERROR dönerse hata fırlatır', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'ERROR' }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')
    ).rejects.toThrow('status_code=ERROR')
  })

  it('PUBLISH_MODE live ve media oluşturma başarısız olursa hata fırlatır', async () => {
    process.env.PUBLISH_MODE = 'live'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: async () => 'bad request' })
    )

    await expect(
      publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')
    ).rejects.toThrow('Instagram media oluşturma başarısız')
  })

  it('PUBLISH_MODE live ve ağ hatası olursa access token sızmasını önler', async () => {
    process.env.PUBLISH_MODE = 'live'
    const tokenValue = 'secret-token-12345'
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            `Failed to connect to graph.instagram.com: access_token=${tokenValue} must be valid`
          )
        )
    )

    try {
      await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')
      expect.fail('should have thrown')
    } catch (error) {
      expect((error as Error).message).not.toContain(tokenValue)
      expect((error as Error).message).toContain('access_token=REDACTED')
    }
  })
})

describe('publishReel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUBLISH_MODE draft ise gerçek API çağrısı yapmadan sahte mediaId döner', async () => {
    process.env.PUBLISH_MODE = 'draft'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')

    expect(result.mediaId).toContain('draft-mode-')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('PUBLISH_MODE live ise REELS media_type ile container oluşturur, bekler ve yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')

    expect(result.mediaId).toBe('media-1')
    const createCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(createCallBody).toEqual({
      media_type: 'REELS',
      video_url: 'https://example.com/video.mp4',
      caption: 'caption',
    })
  })

  it('container oluşturma başarısız olursa hata fırlatır', async () => {
    process.env.PUBLISH_MODE = 'live'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: async () => 'bad request' })
    )

    await expect(
      publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')
    ).rejects.toThrow('Instagram reel oluşturma başarısız')
  })
})

describe('refreshLongLivedToken', () => {
  it('yeni access token ve süresini döner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 5184000 }),
      })
    )

    const result = await refreshLongLivedToken('old-token')

    expect(result).toEqual({ accessToken: 'new-token', expiresInSeconds: 5184000 })
  })

  it('API hatasında hata fırlatır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'error' }))

    await expect(refreshLongLivedToken('old-token')).rejects.toThrow('Token yenileme başarısız')
  })

  it('ağ hatası olursa access token sızmasını önler', async () => {
    const tokenValue = 'long-lived-token-secret-xyz'
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          new Error(`Network request failed: access_token=${tokenValue} was used in request`)
        )
    )

    try {
      await refreshLongLivedToken('old-token')
      expect.fail('should have thrown')
    } catch (error) {
      expect((error as Error).message).not.toContain(tokenValue)
      expect((error as Error).message).toContain('access_token=REDACTED')
    }
  })
})
