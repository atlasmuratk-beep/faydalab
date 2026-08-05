import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendAlert } from './telegram'

describe('sendAlert', () => {
  beforeEach(() => {
    process.env.TELEGRAM_CHAT_ID = 'chat-1'
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TELEGRAM_CHAT_ID
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  it('TELEGRAM_CHAT_ID tanımlıysa fetch çağırır', async () => {
    await sendAlert('test mesajı')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bottoken-1/sendMessage'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('TELEGRAM_CHAT_ID tanımlı değilse fetch çağırmaz', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await sendAlert('test mesajı')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetch hata fırlatırsa sendAlert yine de hata fırlatmaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ hatası')))
    await expect(sendAlert('test mesajı')).resolves.toBeUndefined()
  })
})
