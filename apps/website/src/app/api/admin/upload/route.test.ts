import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: mocks.put }))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue('user-1') }))

import { POST } from './route'

function makeRequestWithFile(file: File): Request {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost/api/admin/upload', { method: 'POST', body: form })
}

describe('POST /api/admin/upload', () => {
  beforeEach(() => {
    mocks.put.mockReset()
  })

  it('dosya eksikse 400 döner', async () => {
    const response = await POST(new Request('http://localhost/api/admin/upload', { method: 'POST', body: new FormData() }))
    expect(response.status).toBe(400)
  })

  it('izin verilmeyen dosya tipinde 400 döner', async () => {
    const file = new File(['x'], 'dosya.txt', { type: 'text/plain' })
    const response = await POST(makeRequestWithFile(file))
    expect(response.status).toBe(400)
  })

  it('8MB üzeri dosyada 400 döner', async () => {
    const bigContent = new Uint8Array(8 * 1024 * 1024 + 1)
    const file = new File([bigContent], 'buyuk.jpg', { type: 'image/jpeg' })
    const response = await POST(makeRequestWithFile(file))
    expect(response.status).toBe(400)
  })

  it('geçerli görseli yükler ve URL döner', async () => {
    mocks.put.mockResolvedValue({ url: 'https://blob.vercel-storage.com/foto.jpg' })
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    const response = await POST(makeRequestWithFile(file))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toEqual({ url: 'https://blob.vercel-storage.com/foto.jpg' })
  })
})
