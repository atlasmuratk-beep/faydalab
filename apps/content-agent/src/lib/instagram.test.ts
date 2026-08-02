import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishImage, refreshLongLivedToken } from './instagram'

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

  it('PUBLISH_MODE live ise media oluşturur ve yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toBe('media-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
})
