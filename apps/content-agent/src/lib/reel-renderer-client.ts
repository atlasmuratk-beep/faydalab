export type RenderSegment = {
  text: string
  audioUrl: string
  durationMs: number
}

export type RenderReelInput = {
  backgroundImageUrl: string
  segments: RenderSegment[]
}

export type RenderReelResult = {
  videoUrl: string
}

export async function renderReel(input: RenderReelInput): Promise<RenderReelResult> {
  const rendererUrl = process.env.REEL_RENDERER_URL
  if (!rendererUrl) {
    throw new Error('REEL_RENDERER_URL ortam değişkeni tanımlı değil')
  }

  const response = await fetch(`${rendererUrl}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Reel render isteği başarısız: ${response.status} ${await response.text()}`)
  }

  return response.json()
}
