import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { create: mocks.create } } }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.sendAlert.mockReset()
    mocks.sendAlert.mockResolvedValue(undefined)
  })

  it('geçersiz e-posta için 400 döner ve kayıt oluşturmaz', async () => {
    const response = await POST(makeRequest({ name: 'Ali', email: 'gecersiz', message: 'Merhaba' }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('eksik alan için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com' }))
    expect(response.status).toBe(400)
  })

  it('geçerli veride kaydeder ve Telegram bildirimi gönderir', async () => {
    mocks.create.mockResolvedValue({ id: 'msg-1' })
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }))
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body).toEqual({ id: 'msg-1' })
    expect(mocks.create).toHaveBeenCalledWith({
      data: { name: 'Ali', email: 'ali@example.com', message: 'Merhaba' },
    })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('Ali'))
  })
})
