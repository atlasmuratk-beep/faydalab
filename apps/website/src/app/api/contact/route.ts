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

  return NextResponse.json({ id: saved.id }, { status: 201 })
}
