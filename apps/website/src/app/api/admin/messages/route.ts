import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function GET() {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(messages)
}
