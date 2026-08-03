import OpenAI from 'openai'
import { put } from '@vercel/blob'

// İstemci tembel kurulur: SDK, anahtar yoksa kurucuda hata fırlattığı için
// modül seviyesinde kurmak `next build` sırasında (env yokken) derlemeyi bozar.
let client: OpenAI | null = null

function openaiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export type SpeechResult = {
  audioUrl: string
  durationMs: number
}

// WAV başlığını elle ayrıştırır: her cümle ayrı seslendirildiği için süresi
// kesin bilinmeli (Remotion segment senkronu buna dayanır) — harici bir
// ses-süre kütüphanesi eklemeden, WAV formatının kendi meta verisinden okunur.
function parseWavDurationMs(buffer: Buffer): number {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Geçersiz WAV dosyası: RIFF/WAVE başlığı bulunamadı')
  }

  let offset = 12
  let byteRate: number | null = null
  let dataSize: number | null = null

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataStart = offset + 8

    if (chunkId === 'fmt ') {
      byteRate = buffer.readUInt32LE(chunkDataStart + 8)
    } else if (chunkId === 'data') {
      dataSize = chunkSize
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }

  if (byteRate === null || dataSize === null) {
    throw new Error('Geçersiz WAV dosyası: fmt veya data chunk bulunamadı')
  }

  return Math.round((dataSize / byteRate) * 1000)
}

export async function generateSpeech(text: string): Promise<SpeechResult> {
  const response = await openaiClient().audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input: text,
    response_format: 'wav',
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  const durationMs = parseWavDurationMs(buffer)

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const blob = await put(`reel-audio/${uniqueSuffix}.wav`, buffer, {
    access: 'public',
    contentType: 'audio/wav',
  })

  return { audioUrl: blob.url, durationMs }
}
