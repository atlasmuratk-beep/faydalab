import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { section: { findUnique: mocks.findUnique, update: mocks.update, delete: mocks.delete } },
}))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue('user-1') }))

import { PATCH, DELETE } from './route'

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections/sec-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/sections/[id]', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
  })

  it('içerik güncellemesinde bulunamayan section için 404 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await PATCH(makePatchRequest({ content: { title: 't' } }), { params: Promise.resolve({ id: 'sec-1' }) })
    expect(response.status).toBe(404)
  })

  it('geçersiz içerik güncellemesinde 400 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', type: 'CONTACT' })
    const response = await PATCH(makePatchRequest({ content: { title: 'sadece başlık' } }), {
      params: Promise.resolve({ id: 'sec-1' }),
    })
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('geçerli içerik güncellemesi kaydeder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', type: 'CONTACT' })
    mocks.update.mockResolvedValue({ id: 'sec-1' })
    const response = await PATCH(
      makePatchRequest({ content: { title: 'Başlık', subtitle: 'Alt' } }),
      { params: Promise.resolve({ id: 'sec-1' }) }
    )
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sec-1' }, data: { content: { title: 'Başlık', subtitle: 'Alt' } } })
    )
  })

  it('sadece visible güncellemesi içerik doğrulaması gerektirmez', async () => {
    mocks.update.mockResolvedValue({ id: 'sec-1' })
    const response = await PATCH(makePatchRequest({ visible: false }), { params: Promise.resolve({ id: 'sec-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'sec-1' }, data: { visible: false } })
  })
})

describe('DELETE /api/admin/sections/[id]', () => {
  it('section siler', async () => {
    mocks.delete.mockResolvedValue({ id: 'sec-1' })
    const response = await DELETE(new Request('http://localhost/api/admin/sections/sec-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'sec-1' }),
    })
    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'sec-1' } })
  })
})
