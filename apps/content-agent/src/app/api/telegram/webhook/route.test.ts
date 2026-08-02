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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/telegram/webhook?secret=test-secret', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    mocks.findUnique.mockResolvedValue({ id: 'content-1' })
    mocks.update.mockResolvedValue({})
  })

  it('yanlış secret ile 401 döner', async () => {
    const request = new Request('http://localhost/api/telegram/webhook?secret=wrong', {
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

  it('reject callback\'inde ContentItem REJECTED olur', async () => {
    await POST(makeRequest({ callback_query: { id: 'cb-2', data: 'reject:content-1' } }))

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    )
  })

  it('geçersiz payload\'da hata fırlatmadan 200 döner', async () => {
    const response = await POST(makeRequest({ not_a_callback: true }))
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
