import { describe, it, expect } from 'vitest'
import { totalDurationInFrames, type ReelSegment } from './ReelComposition'

describe('totalDurationInFrames', () => {
  it('segment sürelerinin toplamını 30fps çerçeveye çevirir', () => {
    const segments: ReelSegment[] = [
      { text: 'a', audioUrl: 'x', durationMs: 1000 },
      { text: 'b', audioUrl: 'y', durationMs: 2500 },
    ]

    // 1000ms = 30 frame, 2500ms = 75 frame → toplam 105
    expect(totalDurationInFrames(segments)).toBe(105)
  })

  it('boş segment listesinde 0 döner', () => {
    expect(totalDurationInFrames([])).toBe(0)
  })
})
