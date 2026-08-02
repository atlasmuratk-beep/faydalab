import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getNextPillar, getRecentTopics } from '@/lib/content-pillars'
import { generateCaption } from '@/lib/claude'
import { generateImage } from '@/lib/image-gen'
import { sendContentPreview, sendAlert } from '@/lib/telegram'
import { withRetry } from '@/lib/with-retry'
import { verifyInternalAuthHeader } from '@/lib/auth'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const pillar = await getNextPillar(prisma)
  const recentTopics = await getRecentTopics(prisma, pillar)

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

  const contentItem = await prisma.contentItem.create({
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

  const fullCaption = `${generated.caption}\n\n${generated.hashtags.map((h: string) => `#${h}`).join(' ')}`

  try {
    const { chatId, messageId } = await sendContentPreview(contentItem.id, imageUrl, fullCaption)
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { telegramChatId: chatId, telegramMessageId: messageId },
    })
  } catch {
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { status: 'GENERATION_FAILED' },
    })
    return NextResponse.json({ error: 'telegram_send_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: contentItem.id, status: 'PENDING_APPROVAL' })
}
