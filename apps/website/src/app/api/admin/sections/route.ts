import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECTION_TYPES, validateSectionContent, type SectionType } from '@/lib/sections'
import { requireSession } from '@/lib/auth'

export async function GET() {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const sections = await prisma.section.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(sections)
}

export async function POST(req: Request) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const body = await req.json()
  if (!SECTION_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Geçersiz section tipi' }, { status: 400 })
  }

  const type = body.type as SectionType
  const validation = validateSectionContent(type, body.content)
  if (!validation.success) {
    return NextResponse.json({ error: 'invalid_content', details: validation.error.flatten() }, { status: 400 })
  }

  const maxOrder = await prisma.section.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  const section = await prisma.section.create({
    data: { type, content: validation.data, order, visible: true },
  })
  return NextResponse.json(section, { status: 201 })
}
