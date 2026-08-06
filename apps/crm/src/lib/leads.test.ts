import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  qualifyLead: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { lead: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/qualify', () => ({ qualifyLead: mocks.qualifyLead }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { createLead, runQualification, createLeadSchema } from './leads'

describe('createLeadSchema', () => {
  it('phone ve email ikisi de eksikse doğrulama başarısız olur', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      requestText: 'Web sitesi istiyorum',
      source: 'WEBSITE',
      sourceMeta: {},
    })
    expect(result.success).toBe(false)
  })

  it('sadece phone ile doğrulama başarılı olur', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'VAPI',
      sourceMeta: {},
    })
    expect(result.success).toBe(true)
  })

  it('sourceMeta alanı verilmezse boş nesneye varsayılan olur', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'VAPI',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sourceMeta).toEqual({})
    }
  })

  it('sourceMeta açıkça null verilirse yine boş nesneye dönüşür', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'VAPI',
      sourceMeta: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sourceMeta).toEqual({})
    }
  })
})

describe('createLead', () => {
  beforeEach(() => {
    mocks.create.mockReset()
  })

  it('geçerli veriyle prisma.lead.create çağırır', async () => {
    mocks.create.mockResolvedValue({ id: 'lead-1' })
    await createLead({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'WEBSITE',
      sourceMeta: { foo: 'bar' },
    })
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        name: 'Ali',
        phone: '5551234567',
        email: undefined,
        requestText: 'Web sitesi istiyorum',
        source: 'WEBSITE',
        sourceMeta: { foo: 'bar' },
      },
    })
  })
})

describe('runQualification', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
    mocks.qualifyLead.mockReset()
    mocks.sendAlert.mockReset()
  })

  it('lead bulunamazsa hiçbir şey yapmaz', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await runQualification('lead-1')
    expect(mocks.qualifyLead).not.toHaveBeenCalled()
  })

  it('başarılı kalifikasyonda Lead güncellenir ve bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockResolvedValue({ summary: 'özet', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    await runQualification('lead-1')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { aiSummary: 'özet', aiCategory: 'Web Sitesi', aiUrgency: 'YUKSEK', aiScore: 5 },
    })
    expect(mocks.sendAlert).toHaveBeenCalledOnce()
  })

  it('kalifikasyon başarısız olursa Lead aiError ile güncellenir ve yine de bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockRejectedValue(new Error('API hatası'))
    await runQualification('lead-1')
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { aiError: 'API hatası' } })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('AI değerlendirmesi başarısız'))
  })
})
