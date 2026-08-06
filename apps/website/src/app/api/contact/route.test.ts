import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { create: mocks.create } } }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
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

  it('200 karakteri aşan name alanı için 400 döner', async () => {
    const response = await POST(
      makeRequest({ name: 'a'.repeat(201), email: 'ali@example.com', message: 'Merhaba' }, 'len-ip-1')
    )
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('5000 karakteri aşan message alanı için 400 döner', async () => {
    const response = await POST(
      makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'a'.repeat(5001) }, 'len-ip-2')
    )
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('aynı IP dakikada 5 istekten fazla gönderirse 429 döner', async () => {
    mocks.create.mockResolvedValue({ id: 'msg-1' })
    const ip = 'rate-limit-ip'
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }, ip))
      expect(response.status).toBe(201)
    }
    const sixth = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }, ip))
    expect(sixth.status).toBe(429)
  })
})

describe('forwardToCrm entegrasyonu', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRM_API_URL
  })

  it('CRM_API_URL tanımlıysa CRM /api/leads endpoint\'ine POST atar', async () => {
    process.env.CRM_API_URL = 'https://crm.example.com'
    await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }, 'crm-ip-1'))
    expect(fetch).toHaveBeenCalledWith(
      'https://crm.example.com/api/leads',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('CRM_API_URL tanımlı değilse fetch çağırmaz', async () => {
    delete process.env.CRM_API_URL
    await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }, 'crm-ip-2'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('CRM isteği başarısız olsa da contact akışı 201 döner', async () => {
    process.env.CRM_API_URL = 'https://crm.example.com'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ hatası')))
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }, 'crm-ip-3'))
    expect(response.status).toBe(201)
  })
})
