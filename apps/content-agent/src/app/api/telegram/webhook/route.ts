import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { answerCallbackQuery } from '@/lib/telegram'
import { verifyTelegramWebhookSecret } from '@/lib/auth'

const callbackSchema = z.object({
  callback_query: z.object({
    id: z.string(),
    data: z.string(),
    message: z
      .object({
        chat: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
      })
      .optional(),
  }),
})

// Yayın saati Europe/Istanbul 10:00'a sabitlenir. Vercel UTC çalıştığı için
// dönüşümü açıkça yapıyoruz; Türkiye 2016'dan beri DST kullanmadığından ofset
// yıl boyu sabit +03'tür.
function nextScheduleSlot(): Date {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return new Date(
    Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 7, 0, 0)
  )
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!verifyTelegramWebhookSecret(secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    // Non-JSON body; treat as validation failure
    return NextResponse.json({ ok: true })
  }

  const parsed = callbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }

  const { id: callbackQueryId, data } = parsed.data.callback_query

  // Derinlemesine savunma: payload'da sohbet kimliği varsa, beklenen sohbetten
  // gelmeyen callback'leri sessizce yok say.
  const callbackChatId = parsed.data.callback_query.message?.chat?.id
  if (callbackChatId !== undefined && String(callbackChatId) !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true })
  }

  const [action, contentItemId] = data.split(':')

  // Not: "Düzenle iste" butonu Faz 1b'ye ertelendi; şimdilik yalnızca onay/red var.
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: true })
  }

  try {
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
  } catch (error) {
    // Prevent retry-storm: database error, Telegram error, or already-answered callback
    console.error('Error processing callback:', error)
  }

  return NextResponse.json({ ok: true })
}
