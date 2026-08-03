import type { ContentFormat, ContentPillar } from '@prisma/client'

export type PillarStore = {
  contentItem: {
    findFirst: (args: {
      where: { format: ContentFormat }
      orderBy: { createdAt: 'desc' }
    }) => Promise<{ pillar: ContentPillar } | null>
    findMany: (args: {
      where: { pillar: ContentPillar; format: ContentFormat }
      orderBy: { createdAt: 'desc' }
      take: number
      select: { topic: true }
    }) => Promise<{ topic: string }[]>
  }
}

export async function getNextPillar(
  db: PillarStore,
  format: ContentFormat
): Promise<ContentPillar> {
  const lastItem = await db.contentItem.findFirst({
    where: { format },
    orderBy: { createdAt: 'desc' },
  })

  if (!lastItem) {
    return 'AI_AUTOMATION'
  }

  return lastItem.pillar === 'AI_AUTOMATION' ? 'WEB_QR_CASE_STUDY' : 'AI_AUTOMATION'
}

export async function getRecentTopics(
  db: PillarStore,
  pillar: ContentPillar,
  format: ContentFormat,
  limit = 20
): Promise<string[]> {
  const items = await db.contentItem.findMany({
    where: { pillar, format },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { topic: true },
  })

  return items.map((item) => item.topic)
}
