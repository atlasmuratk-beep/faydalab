import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getNextPillar, getRecentTopics } from '@/lib/content-pillars'
import { generateCaption } from '@/lib/claude'
import { generateImage } from '@/lib/image-gen'
import { sendContentPreview, sendAlert } from '@/lib/telegram'
import { withRetry } from '@/lib/with-retry'
import { verifyInternalAuthHeader } from '@/lib/auth'

// İki yeniden denenebilir upstream çağrısı (Claude + OpenAI görsel) ve bir Telegram
// yüklemesi zincirleniyor; her biri 20-60 sn sürebilir.
export const maxDuration = 300

// Telegram sendPhoto caption sınırı 1024 karakter (Instagram'da 2200).
// Önizleme metnini güvenli bir payla altında tutuyoruz.
const TELEGRAM_CAPTION_LIMIT = 1000

function truncateForTelegram(caption: string): string {
  return caption.length > TELEGRAM_CAPTION_LIMIT
    ? `${caption.slice(0, TELEGRAM_CAPTION_LIMIT)}…`
    : caption
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let pillar
  let recentTopics: string[]
  try {
    pillar = await getNextPillar(prisma)
    recentTopics = await getRecentTopics(prisma, pillar)
  } catch (error) {
    await sendAlert(`İçerik sütunu seçimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'pillar_selection_failed' }, { status: 500 })
  }

  let generated
  try {
    generated = await withRetry(() => generateCaption(pillar, recentTopics))
  } catch (error) {
    await sendAlert(`İçerik metni üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'caption_generation_failed' }, { status: 500 })
  }

  let imageUrl: string
  try {
    imageUrl = await withRetry(() => generateImage(generated.imagePrompt))
  } catch (error) {
    await sendAlert(`Görsel üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'image_generation_failed' }, { status: 500 })
  }

  let contentItem
  let previewCaption: string
  try {
    contentItem = await prisma.contentItem.create({
      data: {
        pillar,
        format: 'STATIC',
        topic: generated.topic,
        caption: generated.caption,
        hashtags: generated.hashtags,
        imageUrl,
        status: 'PENDING_APPROVAL',
      },
    })

    // Kısaltma yalnızca Telegram önizlemesi içindir; kayıtlı caption/hashtags
    // dokunulmadan saklanır ve /api/publish tam metni oradan kurar.
    const fullCaption = `${generated.caption}\n\n${generated.hashtags.map((h: string) => `#${h}`).join(' ')}`
    previewCaption = truncateForTelegram(fullCaption)
  } catch (error) {
    await sendAlert(`İçerik kaydı oluşturulamadı: ${(error as Error).message}`)
    return NextResponse.json({ error: 'content_persist_failed' }, { status: 500 })
  }

  try {
    const { chatId, messageId } = await sendContentPreview(contentItem.id, imageUrl, previewCaption)
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { telegramChatId: chatId, telegramMessageId: messageId },
    })
  } catch (error) {
    await sendAlert(`Telegram önizlemesi gönderilemedi: ${(error as Error).message}`)
    try {
      await prisma.contentItem.update({
        where: { id: contentItem.id },
        data: { status: 'GENERATION_FAILED' },
      })
    } catch {
      // Durum güncellenemedi; uyarı zaten gönderildi.
    }
    return NextResponse.json({ error: 'telegram_send_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: contentItem.id, status: 'PENDING_APPROVAL' })
}
