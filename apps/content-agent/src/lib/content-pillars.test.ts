import { describe, it, expect, vi } from 'vitest'
import { getNextPillar, getRecentTopics } from './content-pillars'

describe('getNextPillar', () => {
  it('hiç içerik yoksa AI_AUTOMATION döner', async () => {
    const db = { contentItem: { findFirst: vi.fn().mockResolvedValue(null) } }
    const result = await getNextPillar(db as any)
    expect(result).toBe('AI_AUTOMATION')
  })

  it('son içerik AI_AUTOMATION ise WEB_QR_CASE_STUDY döner', async () => {
    const db = {
      contentItem: { findFirst: vi.fn().mockResolvedValue({ pillar: 'AI_AUTOMATION' }) },
    }
    const result = await getNextPillar(db as any)
    expect(result).toBe('WEB_QR_CASE_STUDY')
  })

  it('son içerik WEB_QR_CASE_STUDY ise AI_AUTOMATION döner', async () => {
    const db = {
      contentItem: { findFirst: vi.fn().mockResolvedValue({ pillar: 'WEB_QR_CASE_STUDY' }) },
    }
    const result = await getNextPillar(db as any)
    expect(result).toBe('AI_AUTOMATION')
  })
})

describe('getRecentTopics', () => {
  it('verilen sütun için son konuları döner', async () => {
    const findMany = vi.fn().mockResolvedValue([{ topic: 'A' }, { topic: 'B' }])
    const db = { contentItem: { findMany } }
    const result = await getRecentTopics(db as any, 'AI_AUTOMATION', 20)
    expect(result).toEqual(['A', 'B'])
    expect(findMany).toHaveBeenCalledWith({
      where: { pillar: 'AI_AUTOMATION' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { topic: true },
    })
  })
})
