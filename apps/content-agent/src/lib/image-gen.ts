import OpenAI from 'openai'
import { put } from '@vercel/blob'
import { BRAND_VISUAL_DIRECTIVE } from './style-guide'

// İstemci tembel kurulur: SDK, anahtar yoksa kurucuda hata fırlattığı için
// modül seviyesinde kurmak `next build` sırasında (env yokken) derlemeyi bozar.
let client: OpenAI | null = null

function openaiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function generateImage(prompt: string): Promise<string> {
  // gpt-image-1 her zaman base64 döner (url alanı bu model için desteklenmiyor).
  // Ayrıca OpenAI görsel URL'leri ~60 dakikada sona erdiği için, yayın ertesi güne
  // zamanlandığından görseli kalıcı depolamaya (Vercel Blob) yüklüyoruz.
  const result = await openaiClient().images.generate({
    model: 'gpt-image-1',
    prompt: `${prompt}\n\n${BRAND_VISUAL_DIRECTIVE}`,
    size: '1024x1024',
  })

  const image = result.data?.[0]
  if (!image?.b64_json) {
    throw new Error('Görsel üretiminden veri dönmedi')
  }

  const buffer = Buffer.from(image.b64_json, 'base64')
  const blob = await put(`content-images/${Date.now()}.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })

  return blob.url
}
