import { z } from 'zod'
import type { Prisma, LeadSource } from '@prisma/client'
import { prisma } from './db'
import { qualifyLead } from './qualify'
import { sendAlert } from './telegram'

export const createLeadSchema = z
  .object({
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    requestText: z.string().min(1).max(5000),
    source: z.enum(['WEBSITE', 'VAPI']),
    sourceMeta: z.unknown().nullish().transform((v) => v ?? {}),
  })
  .refine((data) => Boolean(data.phone) || Boolean(data.email), {
    message: 'phone veya email alanlarından en az biri gerekli',
    path: ['phone'],
  })

export type CreateLeadInput = z.infer<typeof createLeadSchema>

export async function createLead(input: CreateLeadInput, tenantId: string) {
  return prisma.lead.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      requestText: input.requestText,
      source: input.source as LeadSource,
      sourceMeta: input.sourceMeta as Prisma.InputJsonValue,
    },
  })
}

export async function runQualification(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return

  try {
    const result = await qualifyLead(lead.requestText)
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiSummary: result.summary,
        aiCategory: result.category,
        aiUrgency: result.urgency,
        aiScore: result.score,
      },
    })
    await sendAlert(
      `Yeni lead (${lead.source}): ${lead.name}\n` +
        `Özet: ${result.summary}\n` +
        `Kategori: ${result.category} | Aciliyet: ${result.urgency} | Skor: ${result.score}/5`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await prisma.lead.update({ where: { id: leadId }, data: { aiError: message } })
      await sendAlert(`Yeni lead (${lead.source}): ${lead.name}\nAI değerlendirmesi başarısız: ${message}`)
    } catch (secondaryError) {
      console.error('runQualification hata işleme sırasında ikincil hata:', secondaryError)
    }
  }
}
