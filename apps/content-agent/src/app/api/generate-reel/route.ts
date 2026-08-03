import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getNextPillar, getRecentTopics } from '@/lib/content-pillars'
import { generateReelScript } from '@/lib/claude'
import { generateSpeech } from '@/lib/tts'
import { generateImage } from '@/lib/image-gen'
import { renderReel } from '@/lib/reel-renderer-client'
import { sendReelPreview, sendAlert } from '@/lib/telegram'
import { withRetry } from '@/lib/with-retry'
import { verifyInternalAuthHeader } from '@/lib/auth'

// Script + 4 TTS çağrısı + görsel + render + Telegram yüklemesi zincirleniyor.
export const maxDuration = 300

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
    pillar = await getNextPillar(prisma, 'REEL')
    recentTopics = await getRecentTopics(prisma, pillar, 'REEL')
  } catch (error) {
    await sendAlert(`Reel sütun seçimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'pillar_selection_failed' }, { status: 500 })
  }

  let script
  try {
    script = await withRetry(() => generateReelScript(pillar, recentTopics))
  } catch (error) {
    await sendAlert(`Reel senaryo üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'script_generation_failed' }, { status: 500 })
  }

  const sentences = [script.hook, ...script.beats, script.cta]

  let segments: { text: string; audioUrl: string; durationMs: number }[]
  try {
    segments = await withRetry(() =>
      Promise.all(
        sentences.map(async (text) => {
          const { audioUrl, durationMs } = await generateSpeech(text)
          return { text, audioUrl, durationMs }
        })
      )
    )
  } catch (error) {
    await sendAlert(`Reel seslendirmesi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'speech_generation_failed' }, { status: 500 })
  }

  let backgroundImageUrl: string
  try {
    backgroundImageUrl = await withRetry(() => generateImage(`${script.topic}: ${script.hook}`))
  } catch (error) {
    await sendAlert(`Reel arka plan görseli üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'image_generation_failed' }, { status: 500 })
  }

  let videoUrl: string
  try {
    const rendered = await withRetry(() => renderReel({ backgroundImageUrl, segments }))
    videoUrl = rendered.videoUrl
  } catch (error) {
    await sendAlert(`Reel render işlemi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'render_failed' }, { status: 500 })
  }

  let contentItem
  let previewCaption: string
  try {
    const fullCaption = `${sentences.join(' ')}\n\n${script.hashtags.map((h: string) => `#${h}`).join(' ')}`

    contentItem = await prisma.contentItem.create({
      data: {
        pillar,
        format: 'REEL',
        topic: script.topic,
        caption: sentences.join(' '),
        hashtags: script.hashtags,
        videoUrl,
        status: 'PENDING_APPROVAL',
      },
    })

    previewCaption = truncateForTelegram(fullCaption)
  } catch (error) {
    await sendAlert(`Reel kaydı oluşturulamadı: ${(error as Error).message}`)
    return NextResponse.json({ error: 'content_persist_failed' }, { status: 500 })
  }

  try {
    const { chatId, messageId } = await sendReelPreview(contentItem.id, videoUrl, previewCaption)
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { telegramChatId: chatId, telegramMessageId: messageId },
    })
  } catch (error) {
    await sendAlert(`Reel için Telegram önizlemesi gönderilemedi: ${(error as Error).message}`)
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
