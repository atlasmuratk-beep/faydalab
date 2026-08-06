import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  SESSION_COOKIE: 'faydalab_crm_session',
}))

import { middleware } from './middleware'
import { verifySession } from '@/lib/session'

describe('middleware', () => {
  beforeEach(() => {
    vi.mocked(verifySession).mockReset()
  })

  it('geçerli session ile /admin isteğini geçirir', () => {
    vi.mocked(verifySession).mockReturnValue({ userId: 'user-1', tenantId: 'tenant-1' })
    const req = new NextRequest('http://localhost/admin/leads')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('geçersiz session ile /admin isteğini login sayfasına yönlendirir', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/leads')
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('geçersiz session ile /api/admin isteğine 401 döner', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/api/admin/leads/lead-1')
    const res = middleware(req)
    expect(res.status).toBe(401)
  })

  it('/admin/login isteğini middleware\'den geçirir (session olmasa bile)', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/login')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('/admin/signup isteğini middleware\'den geçirir (session olmasa bile)', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/signup')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })
})
