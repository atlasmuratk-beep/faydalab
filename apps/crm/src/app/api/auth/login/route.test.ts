import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { adminUser: { findUnique: mocks.findUnique } } }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.compare.mockReset()
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('eksik alanlarda 400 döner', async () => {
    const response = await POST(makeRequest({ username: 'admin' }))
    expect(response.status).toBe(400)
  })

  it('kullanıcı bulunamazsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('şifre yanlışsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', username: 'admin', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(false)
    const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('geçerli girişte 200 döner ve session cookie set eder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', username: 'admin', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(true)
    const response = await POST(makeRequest({ username: 'admin', password: 'correct' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('faydalab_crm_session=')
  })

  it('aynı IP dakikada 10 denemeden fazla yaparsa 429 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const ip = 'login-rate-limit-ip'
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }, ip))
      expect(response.status).toBe(401)
    }
    const eleventh = await POST(makeRequest({ username: 'admin', password: 'wrong' }, ip))
    expect(eleventh.status).toBe(429)
  })
})
