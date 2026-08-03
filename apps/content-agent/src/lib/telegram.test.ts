import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendContentPreview, sendReelPreview, answerCallbackQuery, sendAlert } from './telegram'

describe('telegram', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { chat: { id: 12345 }, message_id: 999 } }),
        text: async () => '',
      })
    )
  })

  it('sendContentPreview onay/red butonlarıyla fotoğraf gönderir', async () => {
    const result = await sendContentPreview('content-1', 'https://example.com/img.png', 'Caption')

    expect(result).toEqual({ chatId: '12345', messageId: '999' })
    const [url, options] = (fetch as any).mock.calls[0]
    expect(url).toContain('/sendPhoto')
    const body = JSON.parse(options.body)
    expect(body.reply_markup.inline_keyboard[0][0].callback_data).toBe('approve:content-1')
    expect(body.reply_markup.inline_keyboard[0][1].callback_data).toBe('reject:content-1')
  })

  it('sendContentPreview API hatasında hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    )

    await expect(sendContentPreview('content-1', 'url', 'caption')).rejects.toThrow(
      'Telegram sendPhoto başarısız'
    )
  })

  it('answerCallbackQuery doğru endpointi çağırır', async () => {
    await answerCallbackQuery('cb-1', 'Onaylandı')

    const [url] = (fetch as any).mock.calls[0]
    expect(url).toContain('/answerCallbackQuery')
  })

  it('sendAlert TELEGRAM_CHAT_ID yoksa sessizce çıkar', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await sendAlert('test uyarı')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sendAlert Telegram hatası fırlatsa bile hata yaymaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendAlert('test uyarı')).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})

describe('sendReelPreview', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '12345'
  })

  it('sendVideo çağrısı yapar ve onay/red butonlarını ekler', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { chat: { id: 12345 }, message_id: 99 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendReelPreview('content-1', 'https://x/video.mp4', 'Caption metni')

    expect(result).toEqual({ chatId: '12345', messageId: '99' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/sendVideo')
    const body = JSON.parse(options.body)
    expect(body.video).toBe('https://x/video.mp4')
    expect(body.reply_markup.inline_keyboard[0]).toEqual([
      { text: '✅ Onayla', callback_data: 'approve:content-1' },
      { text: '❌ Reddet', callback_data: 'reject:content-1' },
    ])
  })

  it('TELEGRAM_CHAT_ID tanımlı değilse hata fırlatır', async () => {
    delete process.env.TELEGRAM_CHAT_ID

    await expect(sendReelPreview('content-1', 'https://x/video.mp4', 'Caption')).rejects.toThrow(
      'TELEGRAM_CHAT_ID'
    )
  })

  it('Telegram hata dönerse hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    )

    await expect(sendReelPreview('content-1', 'https://x/video.mp4', 'Caption')).rejects.toThrow(
      'Telegram sendVideo başarısız'
    )
  })
})
