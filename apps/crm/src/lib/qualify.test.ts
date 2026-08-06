import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.create }
  },
}))

import { qualifyLead } from './qualify'

function textResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] }
}

describe('qualifyLead', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('PRO planda geçerli JSON yanıtını doğrulayıp döner', async () => {
    mocks.create.mockResolvedValue(
      textResponse({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    )
    const result = await qualifyLead('Acil bir web sitesine ihtiyacım var', 'PRO')
    expect(result).toEqual({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
  })

  it('BASLANGIC planda summary ve score olmadan da geçerli sayılır', async () => {
    mocks.create.mockResolvedValue(textResponse({ category: 'Web Sitesi', urgency: 'ORTA' }))
    const result = await qualifyLead('Web sitesi istiyorum', 'BASLANGIC')
    expect(result).toEqual({ summary: null, category: 'Web Sitesi', urgency: 'ORTA', score: null })
  })

  it('metin bloğu yoksa hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [] })
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow('metin bloğu bulunamadı')
  })

  it('şemaya uymayan JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue(textResponse({ summary: 'eksik alanlar' }))
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow()
  })

  it('geçersiz JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [{ type: 'text', text: 'JSON değil' }] })
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow()
  })
})
