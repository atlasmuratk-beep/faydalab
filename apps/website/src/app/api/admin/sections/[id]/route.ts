import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSectionContent, type SectionType } from '@/lib/sections'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updateData: { content?: unknown; visible?: boolean } = {}

  if (body.content !== undefined) {
    const existing = await prisma.section.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
    }
    const validation = validateSectionContent(existing.type as SectionType, body.content)
    if (!validation.success) {
      return NextResponse.json({ error: 'invalid_content', details: validation.error.flatten() }, { status: 400 })
    }
    updateData.content = validation.data
  }
  if (body.visible !== undefined) {
    updateData.visible = Boolean(body.visible)
  }

  const section = await prisma.section.update({ where: { id: params.id }, data: updateData })
  return NextResponse.json(section)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.section.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
