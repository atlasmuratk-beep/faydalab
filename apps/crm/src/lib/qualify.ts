import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Plan } from '@prisma/client'

// İstemci tembel kurulur: SDK, anahtar yoksa kurucuda hata fırlattığı için
// modül seviyesinde kurmak `next build` sırasında (env yokken) derlemeyi bozar.
let client: Anthropic | null = null

function anthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export const qualificationSchema = z.object({
  summary: z.string().nullable(),
  category: z.string(),
  urgency: z.enum(['DUSUK', 'ORTA', 'YUKSEK']),
  score: z.number().int().min(1).max(5).nullable(),
})

export type Qualification = z.infer<typeof qualificationSchema>

const FULL_INSTRUCTIONS =
  'Sen FaydaLab Digital ajansı için gelen müşteri taleplerini değerlendiren bir satış asistanısın. ' +
  'Talebi oku, kısa bir özet çıkar, hizmet kategorisini belirle (ör. "Web Sitesi", "QR Menü", ' +
  '"Instagram Otomasyonu", "Genel"), aciliyetini DUSUK/ORTA/YUKSEK olarak sınıflandır ve 1-5 arası ' +
  'bir öncelik skoru ver (5 en yüksek öncelik). Yanıtı sadece şu JSON formatında ver, başka hiçbir ' +
  'metin ekleme: {"summary": string, "category": string, "urgency": "DUSUK"|"ORTA"|"YUKSEK", "score": number}'

const BASIC_INSTRUCTIONS =
  'Sen gelen müşteri taleplerini değerlendiren bir satış asistanısın. Talebi oku, hizmet kategorisini ' +
  'belirle (ör. "Web Sitesi", "QR Menü", "Instagram Otomasyonu", "Genel") ve aciliyetini DUSUK/ORTA/YUKSEK ' +
  'olarak sınıflandır. Yanıtı sadece şu JSON formatında ver, başka hiçbir metin ekleme: ' +
  '{"category": string, "urgency": "DUSUK"|"ORTA"|"YUKSEK"}'

export async function qualifyLead(requestText: string, plan: Plan): Promise<Qualification> {
  const system = plan === 'PRO' ? FULL_INSTRUCTIONS : BASIC_INSTRUCTIONS

  const message = await anthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: `Müşteri talebi: "${requestText}"` }],
  })

  const textBlock = message.content.find((block: { type: string }) => block.type === 'text') as
    | { type: 'text'; text: string }
    | undefined

  if (!textBlock) {
    throw new Error('Claude yanıtında metin bloğu bulunamadı')
  }

  const parsed = JSON.parse(textBlock.text) as Record<string, unknown>
  return qualificationSchema.parse({
    summary: parsed.summary ?? null,
    category: parsed.category,
    urgency: parsed.urgency,
    score: parsed.score ?? null,
  })
}
