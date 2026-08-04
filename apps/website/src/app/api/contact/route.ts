import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendAlert } from '@/lib/telegram'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const saved = await prisma.contactMessage.create({ data: parsed.data })
  await sendAlert(`Yeni iletişim mesajı:\n${parsed.data.name} (${parsed.data.email})\n${parsed.data.message}`)

  return NextResponse.json({ id: saved.id }, { status: 201 })
}
