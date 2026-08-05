import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
}))

vi.mock('@/lib/leads', () => ({ createLead: mocks.createLead, runQualification: mocks.runQualification }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

function makeRequest(body: unknown, token = 'correct-secret'): Request {
  return new Request(`http://localhost/api/webhooks/vapi?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/vapi', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
    process.env.VAPI_WEBHOOK_SECRET = 'correct-secret'
  })

  it('yanlış token ile 403 döner', async () => {
    const response = await POST(makeRequest({}, 'wrong-secret'))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('end-of-call-report olmayan mesajları yok sayar', async () => {
    const response = await POST(makeRequest({ message: { type: 'status-update' } }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ignored).toBe(true)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('structuredData varsa ondan lead oluşturur', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-1' })
    const response = await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { customer: { number: '+905551112233' } },
          analysis: { structuredData: { name: 'Ayşe', phone: '5551112233', request: 'QR menü istiyor' } },
        },
      })
    )
    expect(response.status).toBe(201)
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: 'Ayşe',
      phone: '5551112233',
      requestText: 'QR menü istiyor',
      source: 'VAPI',
      sourceMeta: expect.any(Object),
    })
    expect(mocks.runQualification).toHaveBeenCalledWith('lead-1')
  })

  it('structuredData eksikse call.customer.number ve analysis.summary fallback kullanılır', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-2' })
    await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { customer: { number: '+905559998877' } },
          analysis: { summary: 'Genel bilgi talebi' },
        },
      })
    )
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: 'Belirtilmedi',
      phone: '+905559998877',
      requestText: 'Genel bilgi talebi',
      source: 'VAPI',
      sourceMeta: expect.any(Object),
    })
  })
})
