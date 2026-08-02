import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { answerCallbackQuery } from '@/lib/telegram'

const callbackSchema = z.object({
  callback_query: z.object({
    id: z.string(),
    data: z.string(),
  }),
})

function nextScheduleSlot(): Date {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(10, 0, 0, 0)
  return next
}

export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = callbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }

  const { id: callbackQueryId, data } = parsed.data.callback_query
  const [action, contentItemId] = data.split(':')

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: true })
  }

  const contentItem = await prisma.contentItem.findUnique({ where: { id: contentItemId } })
  if (!contentItem) {
    await answerCallbackQuery(callbackQueryId, 'İçerik bulunamadı')
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve') {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'APPROVED', scheduledFor: nextScheduleSlot() },
    })
    await answerCallbackQuery(callbackQueryId, 'Onaylandı, yayın kuyruğuna eklendi')
  } else {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'REJECTED' },
    })
    await answerCallbackQuery(callbackQueryId, 'Reddedildi')
  }

  return NextResponse.json({ ok: true })
}
