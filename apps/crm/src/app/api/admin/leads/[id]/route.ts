import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['YENI', 'DEGERLENDIRILDI', 'ILETISIMDE', 'KAZANILDI', 'KAYBEDILDI']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await prisma.lead.updateMany({
    where: { id, tenantId: session.tenantId },
    data: { status: parsed.data.status },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 })
  }

  const lead = await prisma.lead.findUnique({ where: { id } })
  return NextResponse.json(lead)
}
