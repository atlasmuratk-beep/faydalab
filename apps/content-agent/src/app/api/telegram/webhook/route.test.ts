import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  answerCallbackQuery: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/telegram', () => ({ answerCallbackQuery: mocks.answerCallbackQuery }))

import { POST } from './route'

function makeRequest(body: unknown, secret = 'test-secret'): Request {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    process.env.TELEGRAM_CHAT_ID = '12345'
    mocks.findUnique.mockResolvedValue({ id: 'content-1' })
    mocks.update.mockResolvedValue({})
  })

  it('yanlış secret header ile 401 döner', async () => {
    const response = await POST(makeRequest({}, 'wrong'))
    expect(response.status).toBe(401)
  })

  it('secret header hiç yoksa 401 döner', async () => {
    const request = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('secret query string\'de gönderilirse kabul edilmez', async () => {
    const request = new Request('http://localhost/api/telegram/webhook?secret=test-secret', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('approve callback\'inde ContentItem APPROVED olur ve scheduledFor set edilir', async () => {
    const response = await POST(
      makeRequest({ callback_query: { id: 'cb-1', data: 'approve:content-1' } })
    )

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    )
    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-1', expect.any(String))
  })

  it('scheduledFor yarın 07:00 UTC (Istanbul 10:00) olarak ayarlanır', async () => {
    await POST(makeRequest({ callback_query: { id: 'cb-1', data: 'approve:content-1' } }))

    const scheduledFor: Date = mocks.update.mock.calls[0][0].data.scheduledFor
    expect(scheduledFor.getUTCHours()).toBe(7)
    expect(scheduledFor.getUTCMinutes()).toBe(0)
    expect(scheduledFor.getTime()).toBeGreaterThan(Date.now())
    expect(scheduledFor.getTime()).toBeLessThan(Date.now() + 48 * 60 * 60 * 1000)
  })

  it('reject callback\'inde ContentItem REJECTED olur', async () => {
    await POST(makeRequest({ callback_query: { id: 'cb-2', data: 'reject:content-1' } }))

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    )
  })

  it('beklenen sohbetten gelen callback işlenir', async () => {
    await POST(
      makeRequest({
        callback_query: { id: 'cb-3', data: 'approve:content-1', message: { chat: { id: 12345 } } },
      })
    )

    expect(mocks.update).toHaveBeenCalled()
  })

  it('farklı sohbetten gelen callback yok sayılır', async () => {
    const response = await POST(
      makeRequest({
        callback_query: { id: 'cb-4', data: 'approve:content-1', message: { chat: { id: 99999 } } },
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.answerCallbackQuery).not.toHaveBeenCalled()
  })

  it('geçersiz payload\'da hata fırlatmadan 200 döner', async () => {
    const response = await POST(makeRequest({ not_a_callback: true }))
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('JSON parse hatası 200 döner', async () => {
    const request = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
      body: 'invalid json body',
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
