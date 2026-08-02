import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateImage(prompt: string): Promise<string> {
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
  })

  const image = result.data?.[0]
  if (!image?.url) {
    throw new Error('Görsel üretiminden URL dönmedi')
  }

  return image.url
}
