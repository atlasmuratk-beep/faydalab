import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendAlert } from '@/lib/telegram'
import { isRateLimited } from '@/lib/rate-limit'

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
})

// CRM'e lead iletimi best-effort'tur: CRM_API_URL tanımlı değilse veya istek
// başarısız olursa website'in kendi contact akışı ASLA bundan etkilenmemeli.
async function forwardToCrm(data: { name: string; email: string; message: string }): Promise<void> {
  const crmUrl = process.env.CRM_API_URL
  if (!crmUrl) return

  try {
    await fetch(`${crmUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        requestText: data.message,
        source: 'WEBSITE',
        sourceMeta: { email: data.email },
      }),
    })
  } catch (error) {
    console.error('CRM lead iletimi başarısız:', error)
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const saved = await prisma.contactMessage.create({ data: parsed.data })
  await sendAlert(`Yeni iletişim mesajı:\n${parsed.data.name} (${parsed.data.email})\n${parsed.data.message}`)
  await forwardToCrm(parsed.data)

  return NextResponse.json({ id: saved.id }, { status: 201 })
}
