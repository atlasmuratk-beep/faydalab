import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { id, direction } = await req.json()
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'Geçersiz yön' }, { status: 400 })
  }

  const current = await prisma.section.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
  }

  const neighbor = await prisma.section.findFirst({
    where: direction === 'up' ? { order: { lt: current.order } } : { order: { gt: current.order } },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  })
  if (!neighbor) {
    return NextResponse.json({ ok: true })
  }

  await prisma.$transaction([
    prisma.section.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.section.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ])

  return NextResponse.json({ ok: true })
}
