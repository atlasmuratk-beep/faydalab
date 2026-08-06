import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['YENI', 'DEGERLENDIRILDI', 'ILETISIMDE', 'KAZANILDI', 'KAYBEDILDI']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const lead = await prisma.lead.update({ where: { id }, data: { status: parsed.data.status } })
    return NextResponse.json(lead)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 })
    }
    throw error
  }
}
