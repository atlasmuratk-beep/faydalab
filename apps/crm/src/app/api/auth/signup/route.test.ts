import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  createTenant: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { adminUser: { findUnique: mocks.findUnique, create: mocks.create }, tenant: { delete: mocks.delete } },
}))
vi.mock('@/lib/tenant', () => ({ createTenant: mocks.createTenant }))

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.create.mockReset()
    mocks.delete.mockReset()
    mocks.createTenant.mockReset()
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('eksik alanlarda 400 döner', async () => {
    const response = await POST(makeRequest({ email: 'a@b.com' }))
    expect(response.status).toBe(400)
  })

  it('8 karakterden kısa şifre reddedilir', async () => {
    const response = await POST(makeRequest({ businessName: 'Test', email: 'a@b.com', password: '1234567' }))
    expect(response.status).toBe(400)
  })

  it('e-posta zaten kayıtlıysa 409 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'existing' })
    const response = await POST(makeRequest({ businessName: 'Test', email: 'a@b.com', password: 'sifre1234' }))
    expect(response.status).toBe(409)
    expect(mocks.createTenant).not.toHaveBeenCalled()
  })

  it('geçerli veriyle tenant ve kullanıcı oluşturur, session cookie set eder', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.createTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'user-1' })
    const response = await POST(makeRequest({ businessName: 'Test İşletme', email: 'a@b.com', password: 'sifre1234' }))
    expect(response.status).toBe(201)
    expect(mocks.createTenant).toHaveBeenCalledWith('Test İşletme')
    expect(response.headers.get('set-cookie')).toContain('faydalab_crm_session=')
  })

  it('adminUser.create P2002 ile başarısız olursa tenant silinir ve 409 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.createTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.create.mockRejectedValue({ code: 'P2002' })
    mocks.delete.mockResolvedValue({ id: 'tenant-1' })
    const response = await POST(makeRequest({ businessName: 'Test', email: 'a@b.com', password: 'sifre1234' }))
    expect(response.status).toBe(409)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'tenant-1' } })
  })

  it('aynı IP dakikada 5 denemeden fazla yaparsa 429 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.createTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'user-1' })
    const ip = 'signup-rate-limit-ip'
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ businessName: 'Test', email: `a${i}@b.com`, password: 'sifre1234' }, ip))
    }
    const sixth = await POST(makeRequest({ businessName: 'Test', email: 'final@b.com', password: 'sifre1234' }, ip))
    expect(sixth.status).toBe(429)
  })
})
