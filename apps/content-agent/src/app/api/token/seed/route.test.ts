import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { integrationToken: { upsert: mocks.upsert } },
}))

import { POST } from './route'

function makeRequest(body: unknown, auth = 'Bearer test-secret'): Request {
  return new Request('http://localhost/api/token/seed', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/token/seed', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mocks.upsert.mockResolvedValue({})
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/token/seed', {
        method: 'POST',
        body: JSON.stringify({ accessToken: 'x', expiresInSeconds: 100 }),
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('yanlış secret ile 401 döner', async () => {
    const response = await POST(
      makeRequest({ accessToken: 'x', expiresInSeconds: 100 }, 'Bearer wrong-secret')
    )

    expect(response.status).toBe(401)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('accessToken eksikse 400 döner', async () => {
    const response = await POST(makeRequest({ expiresInSeconds: 100 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'invalid_body' })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('expiresInSeconds sayı değilse 400 döner', async () => {
    const response = await POST(makeRequest({ accessToken: 'x', expiresInSeconds: '100' }))

    expect(response.status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('geçerli gövdede token\'ı upsert eder', async () => {
    const before = Date.now()
    const response = await POST(
      makeRequest({ accessToken: 'long-lived-token', expiresInSeconds: 5184000 })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'instagram' },
        create: expect.objectContaining({
          provider: 'instagram',
          accessToken: 'long-lived-token',
        }),
        update: expect.objectContaining({ accessToken: 'long-lived-token' }),
      })
    )

    const call = mocks.upsert.mock.calls[0][0]
    expect(call.create.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 5184000 * 1000)
    expect(call.update.expiresAt).toBeInstanceOf(Date)
  })
})
