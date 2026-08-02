import Anthropic from '@anthropic-ai/sdk'
import type { ContentPillar } from '@prisma/client'
import { STYLE_GUIDE } from './style-guide'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type GeneratedCaption = {
  topic: string
  caption: string
  hashtags: string[]
  imagePrompt: string
}

const PILLAR_PROMPTS: Record<ContentPillar, string> = {
  AI_AUTOMATION:
    'Yapay zeka ve iş otomasyonu konularında, KOBİ sahiplerine ve girişimcilere yönelik, öğretici ve güven veren bir Instagram gönderisi fikri üret.',
  WEB_QR_CASE_STUDY:
    'FaydaLab Digital tarafından teslim edilmiş bir web sitesi veya QR menü projesinden somut bir fayda/sonuç vurgulayan bir vaka çalışması Instagram gönderisi fikri üret.',
}

export async function generateCaption(
  pillar: ContentPillar,
  recentTopics: string[]
): Promise<GeneratedCaption> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: `Sen FaydaLab için içerik üreten bir Instagram içerik yazarısın. ${STYLE_GUIDE}`,
    messages: [
      {
        role: 'user',
        content: [
          PILLAR_PROMPTS[pillar],
          recentTopics.length > 0
            ? `Şu konular son zamanlarda kullanıldı, tekrar etme: ${recentTopics.join(', ')}.`
            : '',
          'Yanıtı sadece şu JSON formatında ver, başka hiçbir metin ekleme: {"topic": string, "caption": string, "hashtags": string[], "imagePrompt": string}',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  })

  const textBlock = message.content.find((block: { type: string }) => block.type === 'text') as
    | { type: 'text'; text: string }
    | undefined

  if (!textBlock) {
    throw new Error('Claude yanıtında metin bloğu bulunamadı')
  }

  return JSON.parse(textBlock.text) as GeneratedCaption
}
