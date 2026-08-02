import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publishImage } from '@/lib/instagram'
import { sendAlert } from '@/lib/telegram'
import { verifyInternalAuthHeader } from '@/lib/auth'

// Birden fazla içeriği sırayla yayınlar; her biri Instagram gidiş-dönüşü içerir.
export const maxDuration = 300

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const isLive = process.env.PUBLISH_MODE === 'live'

  // Token yalnızca canlı modda gerekli; draft modda publishImage gerçek token kullanmıyor.
  let accessToken = ''
  if (isLive) {
    const token = await prisma.integrationToken.findUnique({ where: { provider: 'instagram' } })
    if (!token) {
      await sendAlert('Instagram token bulunamadı, yayın yapılamıyor')
      return NextResponse.json({ processed: 0, results: [] })
    }
    accessToken = token.accessToken
  }

  const now = new Date()
  const claimed = await prisma.contentItem.findMany({
    where: { status: 'APPROVED', scheduledFor: { lte: now }, imageUrl: { not: null } },
  })

  const results: { id: string; status: 'published' | 'failed' | 'skipped' }[] = []

  for (const item of claimed) {
    // İyimser kilit: yalnızca hâlâ APPROVED olan kaydı SCHEDULED'a çevirebilen çalışma
    // yayını üstlenir. Cron çakışması/tekrar denemesinde çift yayını önler.
    const claim = await prisma.contentItem.updateMany({
      where: { id: item.id, status: 'APPROVED' },
      data: { status: 'SCHEDULED' },
    })
    if (claim.count === 0) {
      results.push({ id: item.id, status: 'skipped' })
      continue
    }

    try {
      const fullCaption = `${item.caption}\n\n${item.hashtags.map((h: string) => `#${h}`).join(' ')}`
      const { mediaId } = await publishImage(
        accessToken,
        process.env.INSTAGRAM_USER_ID!,
        item.imageUrl!,
        fullCaption
      )
      try {
        await prisma.contentItem.update({
          where: { id: item.id },
          data: { status: 'PUBLISHED', publishedAt: new Date(), instagramMediaId: mediaId },
        })
        results.push({ id: item.id, status: 'published' })
      } catch (dbError) {
        await sendAlert(
          `Yayınlandı ama durum güncellenemedi, manuel kontrol gerekiyor (mediaId: ${mediaId}, item: ${item.id}): ${(dbError as Error).message}`
        )
        results.push({ id: item.id, status: 'published' })
      }
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
