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

const VALID_SECRET = 'correct-ingest-secret'

function makeRequest(
  body: unknown,
  { ip = 'test-ip', secret = VALID_SECRET }: { ip?: string; secret?: string | undefined } = {}
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-forwarded-for': ip }
  if (secret !== undefined) headers['x-crm-ingest-secret'] = secret
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
    process.env.CRM_INGEST_SECRET = VALID_SECRET
  })

  it('CRM_INGEST_SECRET tanımlı değilse 403 döner', async () => {
    delete process.env.CRM_INGEST_SECRET
    const response = await POST(makeRequest({ name: 'Ali' }))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('yanlış secret header ile 403 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }, { secret: 'wrong-secret' }))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçersiz body için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }))
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('bozuk JSON gövdesi için 400 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': 'test-ip',
          'x-crm-ingest-secret': VALID_SECRET,
        },
        body: '{invalid-json',
      })
    )
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçerli body ve doğru secret ile lead oluşturur ve 201 döner', async () => {
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
