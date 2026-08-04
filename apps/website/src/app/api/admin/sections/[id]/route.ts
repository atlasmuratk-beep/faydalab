import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { validateSectionContent, type SectionType } from '@/lib/sections'
import { requireSession } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json()
  const updateData: { content?: Prisma.InputJsonValue; visible?: boolean } = {}

  if (body.content !== undefined) {
    const existing = await prisma.section.findUnique({ where: { id } })
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

  try {
    const section = await prisma.section.update({ where: { id }, data: updateData })
    return NextResponse.json(section)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const { id } = await params
  try {
    await prisma.section.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
    }
    throw error
  }
}
