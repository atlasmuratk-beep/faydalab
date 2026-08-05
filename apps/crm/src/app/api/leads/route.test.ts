import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
}))

vi.mock('@/lib/leads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...actual, createLead: mocks.createLead, runQualification: mocks.runQualification }
})
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
  })

  it('geçersiz body için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }))
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçerli body ile lead oluşturur ve 201 döner', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-1' })
    const response = await POST(
      makeRequest({
        name: 'Ali',
        phone: '5551234567',
        requestText: 'Web sitesi istiyorum',
        source: 'WEBSITE',
        sourceMeta: {},
      })
    )
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.id).toBe('lead-1')
    expect(mocks.runQualification).toHaveBeenCalledWith('lead-1')
  })
})
