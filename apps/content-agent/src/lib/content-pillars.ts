import type { ContentPillar } from '@prisma/client'

export type PillarStore = {
  contentItem: {
    findFirst: (args: {
      orderBy: { createdAt: 'desc' }
    }) => Promise<{ pillar: ContentPillar } | null>
    findMany: (args: {
      where: { pillar: ContentPillar }
      orderBy: { createdAt: 'desc' }
      take: number
      select: { topic: true }
    }) => Promise<{ topic: string }[]>
  }
}

export async function getNextPillar(db: PillarStore): Promise<ContentPillar> {
  const lastItem = await db.contentItem.findFirst({ orderBy: { createdAt: 'desc' } })

  if (!lastItem) {
    return 'AI_AUTOMATION'
  }

  return lastItem.pillar === 'AI_AUTOMATION' ? 'WEB_QR_CASE_STUDY' : 'AI_AUTOMATION'
}

export async function getRecentTopics(
  db: PillarStore,
  pillar: ContentPillar,
  limit = 20
): Promise<string[]> {
  const items = await db.contentItem.findMany({
    where: { pillar },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { topic: true },
  })

  return items.map((item) => item.topic)
}
