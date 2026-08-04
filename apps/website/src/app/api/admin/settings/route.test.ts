import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  requireSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { siteSettings: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}))
vi.mock('@/lib/auth', () => ({ requireSession: mocks.requireSession }))

import { GET, PATCH } from './route'

describe('GET /api/admin/settings', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.requireSession.mockResolvedValue('user-1')
    mocks.findUnique.mockReset()
  })

  it('singleton ayar kaydını döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, siteTitle: 'FaydaLab' })
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual({ id: 1, siteTitle: 'FaydaLab' })
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/settings', () => {
  beforeEach(() => {
    mocks.upsert.mockReset()
    mocks.requireSession.mockReset()
    mocks.requireSession.mockResolvedValue('user-1')
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Yeni Başlık', metaDescription: 'açıklama' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(401)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('ayarları upsert eder', async () => {
    mocks.upsert.mockResolvedValue({ id: 1, siteTitle: 'Yeni Başlık' })
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Yeni Başlık', metaDescription: 'açıklama' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })

  it('geçersiz favicon URL için 400 döner', async () => {
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Başlık', metaDescription: 'açıklama', faviconUrl: 'not-a-url' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('boş string favicon/logo/instagram/email alanları null olarak kabul edilir', async () => {
    mocks.upsert.mockResolvedValue({ id: 1, siteTitle: 'Başlık' })
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteTitle: 'Başlık',
        metaDescription: 'açıklama',
        faviconUrl: '',
        logoUrl: '',
        instagramUrl: '',
        contactEmail: '',
      }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ faviconUrl: null, logoUrl: null, instagramUrl: null, contactEmail: null }),
      })
    )
  })

  it('geçersiz e-posta için 400 döner', async () => {
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Başlık', metaDescription: 'açıklama', contactEmail: 'gecersiz' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(400)
  })

  it('siteTitle eksikse 400 döner', async () => {
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metaDescription: 'açıklama' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('metaDescription boş string ise 400 döner', async () => {
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Başlık', metaDescription: '' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(400)
  })
})
