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

  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET ortam değişkeni tanımlı değil')
  }

  const response = await fetch(`${rendererUrl}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(input),
    // 180 sn: maxDuration=300'lük toplam bütçenin geri kalanını script/TTS/görsel/
    // Telegram adımlarına bırakır ve fonksiyon sessizce öldürülmeden önce hata fırlatmayı sağlar.
    signal: AbortSignal.timeout(180_000),
  })

  if (!response.ok) {
    throw new Error(`Reel render isteği başarısız: ${response.status} ${await response.text()}`)
  }

  return response.json()
}
