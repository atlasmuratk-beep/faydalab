import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publishImage } from '@/lib/instagram'
import { sendAlert } from '@/lib/telegram'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dueItems = await prisma.contentItem.findMany({
    where: { status: 'APPROVED', scheduledFor: { lte: now } },
  })

  const results: { id: string; status: 'published' | 'failed' }[] = []

  for (const item of dueItems) {
    const token = await prisma.integrationToken.findUnique({ where: { provider: 'instagram' } })
    if (!token) {
      await sendAlert('Instagram token bulunamadı, yayın yapılamıyor')
      break
    }

    try {
      const fullCaption = `${item.caption}\n\n${item.hashtags.map((h: string) => `#${h}`).join(' ')}`
      const { mediaId } = await publishImage(
        token.accessToken,
        process.env.INSTAGRAM_USER_ID!,
        item.imageUrl!,
        fullCaption
      )
      await prisma.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), instagramMediaId: mediaId },
      })
      results.push({ id: item.id, status: 'published' })
    } catch (error) {
      await prisma.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISH_FAILED' },
      })
      await sendAlert(`Yayın başarısız (${item.id}): ${(error as Error).message}`)
      results.push({ id: item.id, status: 'failed' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
