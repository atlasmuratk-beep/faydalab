# FaydaLab Faz 1b — Reels/Video Otomasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statik post hattının (Faz 1a, tamamlandı ve canlıda) yanına, yüzsüz AI seslendirmeli, tek şablonlu ("kinetic typography" + Ken Burns) reels üretim ve yayın hattı eklemek.

**Architecture:** `apps/content-agent`'a yeni bir `/api/generate-reel` endpoint'i eklenir (Claude senaryo → OpenAI TTS seslendirme → OpenAI görsel → render isteği). Render, ayrı bir monorepo uygulaması olan yeni `apps/reel-renderer`'da (Remotion, Railway'de Docker konteyner) yapılır. Onay/yayın akışı statik postlarla aynı `ContentItem`/`ContentStatus` durum makinesini ve Telegram webhook'unu paylaşır; sadece medya tipi (`STATIC` vs `REEL`) ve Instagram Graph API çağrısı (`image_url` vs `video_url`/`REELS`) farklılaşır.

**Tech Stack:** Next.js/Prisma/Vercel (content-agent, mevcut), Remotion + Express + Node.js (reel-renderer, yeni), OpenAI TTS (`tts-1`), Railway (Docker deploy), Vercel Blob (ses/video dosyaları), Instagram Graph API (REELS media_type).

## Global Constraints

- Tüm yeni endpoint'ler `verifyInternalAuthHeader` (Bearer `INTERNAL_API_SECRET`) ile korunur — mevcut `src/lib/auth.ts` aynen kullanılır, yeni bir auth mekanizması icat edilmez.
- `apps/reel-renderer` da aynı `INTERNAL_API_SECRET` değerini paylaşır (content-agent → reel-renderer çağrısının kimlik doğrulaması için); tek bir "iç servisler arası secret" ilkesi korunur, yeni bir secret türü eklenmez.
- Her dış çağrı (Claude, OpenAI TTS, OpenAI görsel, reel-renderer HTTP çağrısı) mevcut `withRetry()` yardımcı fonksiyonuyla sarılır ve kalıcı hatada `sendAlert()` ile Telegram'a bildirim gider — sessiz düşme yok (statik post hattındaki kural).
- Marka görsel kimliği (`#0B0B0D` arka plan, `#D4AF37` vurgu, `#F5F5F5`/`#B8BDC7` metin) reel şablonunda da uygulanır.
- `PUBLISH_MODE=draft` iken hiçbir gerçek Instagram API çağrısı yapılmaz (mevcut `publishImage`'daki desen `publishReel`'de de aynen tekrarlanır).
- Yeni harici hesap: yok — OpenAI (zaten var), Vercel Blob (zaten var), Railway (kullanıcı tarafında kurulacak, AWS değil).

---

## Task 1: Prisma Şeması — REEL formatı ve videoUrl alanı

**Files:**
- Modify: `apps/content-agent/prisma/schema.prisma`
- Create: `apps/content-agent/prisma/migrations/20260803000000_add_reel_format/migration.sql`

**Interfaces:**
- Produces: `ContentFormat` enum'una `REEL` değeri eklenir; `ContentItem.videoUrl: String | null` alanı — sonraki tüm task'lar bu alanı ve enum değerini kullanır.

- [ ] **Step 1: `schema.prisma`'yı güncelle**

`enum ContentFormat` bloğunu şu şekilde değiştir:

```prisma
enum ContentFormat {
  STATIC
  REEL
}
```

`model ContentItem` içinde `imageUrl` satırının hemen altına ekle:

```prisma
  imageUrl          String?
  videoUrl          String?
```

- [ ] **Step 2: Migration dosyasını elle oluştur**

Bu sandbox'ta gerçek `DATABASE_URL` yok, bu yüzden `prisma migrate dev` çalıştırılamaz (canlı veritabanına bağlanmaya çalışır). Migration SQL'i doğrudan yaz — bu, Faz 1a'nın ilk migration'ında da izlenen yöntemdir.

`apps/content-agent/prisma/migrations/20260803000000_add_reel_format/migration.sql` dosyasını oluştur:

```sql
-- AlterEnum
ALTER TYPE "ContentFormat" ADD VALUE 'REEL';

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "videoUrl" TEXT;
```

- [ ] **Step 3: Prisma Client'ı yeniden üret**

Run: `cd apps/content-agent && npx prisma generate`

Bu komut `DATABASE_URL` gerektirmez, sadece `schema.prisma`'yı okuyup TypeScript tiplerini üretir. Beklenen: `✔ Generated Prisma Client` çıktısı, hatasız.

- [ ] **Step 4: Typecheck ile doğrula**

Run: `cd apps/content-agent && npm run typecheck`

Expected: Hatasız geçer (yeni `REEL`/`videoUrl` henüz hiçbir yerde kullanılmadığı için mevcut kodu bozmamalı).

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/prisma/schema.prisma apps/content-agent/prisma/migrations/20260803000000_add_reel_format
git commit -m "feat: ContentFormat enum'una REEL ekle, ContentItem'a videoUrl alanı"
```

**Not (orkestratöre):** Bu migration'ın gerçek Neon veritabanına uygulanması (`npx prisma migrate deploy`), tüm kodlama task'ları bittikten sonra, gerçek `DATABASE_URL`'e erişimi olan oturum tarafından yapılmalı — Faz 1a'daki ilk migration'da izlenen yöntemin aynısı.

---

## Task 2: İçerik sütunu rotasyonunu format'a göre ayır

**Files:**
- Modify: `apps/content-agent/src/lib/content-pillars.ts`
- Modify: `apps/content-agent/src/lib/content-pillars.test.ts`
- Modify: `apps/content-agent/src/app/api/generate/route.ts:33-34`

**Interfaces:**
- Consumes: `ContentFormat` (Task 1'de eklendi, `@prisma/client`'tan import edilir)
- Produces: `getNextPillar(db: PillarStore, format: ContentFormat): Promise<ContentPillar>`, `getRecentTopics(db: PillarStore, pillar: ContentPillar, format: ContentFormat, limit?: number): Promise<string[]>` — Task 10'daki `/api/generate-reel` bu imzayı kullanır.

**Neden gerekli:** Mevcut `getNextPillar`, formattan bağımsız olarak en son eklenen `ContentItem`'a bakıyor. Reels haftada 2, statik postlar haftada 5 üretildiği için aynı sayaç paylaşılırsa bir reel üretimi, ertesi günkü statik postun hangi sütundan geleceğini beklenmedik şekilde değiştirir. Format bazında ayrı rotasyon bunu önler.

- [ ] **Step 1: Testleri güncelle — önce başarısız olmalarını sağla**

`apps/content-agent/src/lib/content-pillars.test.ts` dosyasının tamamını şu içerikle değiştir:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getNextPillar, getRecentTopics } from './content-pillars'

describe('getNextPillar', () => {
  it('hiç içerik yoksa AI_AUTOMATION döner', async () => {
    const db = { contentItem: { findFirst: vi.fn().mockResolvedValue(null) } }
    const result = await getNextPillar(db as any, 'STATIC')
    expect(result).toBe('AI_AUTOMATION')
  })

  it('son içerik AI_AUTOMATION ise WEB_QR_CASE_STUDY döner', async () => {
    const db = {
      contentItem: { findFirst: vi.fn().mockResolvedValue({ pillar: 'AI_AUTOMATION' }) },
    }
    const result = await getNextPillar(db as any, 'STATIC')
    expect(result).toBe('WEB_QR_CASE_STUDY')
  })

  it('son içerik WEB_QR_CASE_STUDY ise AI_AUTOMATION döner', async () => {
    const db = {
      contentItem: { findFirst: vi.fn().mockResolvedValue({ pillar: 'WEB_QR_CASE_STUDY' }) },
    }
    const result = await getNextPillar(db as any, 'STATIC')
    expect(result).toBe('AI_AUTOMATION')
  })

  it('sorguyu verilen format ile filtreler', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const db = { contentItem: { findFirst } }
    await getNextPillar(db as any, 'REEL')
    expect(findFirst).toHaveBeenCalledWith({
      where: { format: 'REEL' },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('getRecentTopics', () => {
  it('verilen sütun ve format için son konuları döner', async () => {
    const findMany = vi.fn().mockResolvedValue([{ topic: 'A' }, { topic: 'B' }])
    const db = { contentItem: { findMany } }
    const result = await getRecentTopics(db as any, 'AI_AUTOMATION', 'STATIC', 20)
    expect(result).toEqual(['A', 'B'])
    expect(findMany).toHaveBeenCalledWith({
      where: { pillar: 'AI_AUTOMATION', format: 'STATIC' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { topic: true },
    })
  })
})
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/content-pillars.test.ts`
Expected: FAIL (fonksiyonlar henüz 2 parametre almıyor / `format` filtresi yok)

- [ ] **Step 3: `content-pillars.ts`'yi güncelle**

Dosyanın tamamını şu içerikle değiştir:

```typescript
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
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/content-pillars.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Çağrı noktasını güncelle**

`apps/content-agent/src/app/api/generate/route.ts` dosyasında şu satırları:

```typescript
    pillar = await getNextPillar(prisma)
    recentTopics = await getRecentTopics(prisma, pillar)
```

şununla değiştir:

```typescript
    pillar = await getNextPillar(prisma, 'STATIC')
    recentTopics = await getRecentTopics(prisma, pillar, 'STATIC')
```

- [ ] **Step 6: Mevcut generate route testlerinin hâlâ geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/generate/route.test.ts`
Expected: PASS (7 test) — bu test dosyası `getNextPillar`/`getRecentTopics`'i mock'ladığı için imza değişikliğinden etkilenmez.

- [ ] **Step 7: Commit**

```bash
git add apps/content-agent/src/lib/content-pillars.ts apps/content-agent/src/lib/content-pillars.test.ts apps/content-agent/src/app/api/generate/route.ts
git commit -m "feat: içerik sütunu rotasyonunu format bazında ayır (STATIC/REEL)"
```

---

## Task 3: Claude ile reel senaryosu üretimi

**Files:**
- Modify: `apps/content-agent/src/lib/claude.ts`
- Modify: `apps/content-agent/src/lib/claude.test.ts`

**Interfaces:**
- Consumes: `anthropicClient()`, `STYLE_GUIDE`, `PILLAR_PROMPTS` (dosyada zaten mevcut, aynen tekrar kullanılır)
- Produces: `generateReelScript(pillar: ContentPillar, recentTopics: string[]): Promise<GeneratedReelScript>` — `GeneratedReelScript = { topic: string; hook: string; beats: string[]; cta: string; hashtags: string[] }`. Task 10'daki `/api/generate-reel` bu fonksiyonu ve tipi kullanır.

- [ ] **Step 1: Testi yaz**

`apps/content-agent/src/lib/claude.test.ts` dosyasının en altına (`describe('generateCaption', ...)` bloğundan sonra, dosya sonundan önce) ekle:

```typescript
describe('generateReelScript', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('Claude yanıtını parse edip GeneratedReelScript döner', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'AI ile randevu yönetimi',
            hook: 'Randevularınızı unutmaktan bıktınız mı?',
            beats: ['Birinci fayda cümlesi.', 'İkinci fayda cümlesi.'],
            cta: 'Konuşalım.',
            hashtags: ['yapayzeka', 'otomasyon'],
          }),
        },
      ],
    })

    const result = await generateReelScript('AI_AUTOMATION', [])

    expect(result.hook).toBe('Randevularınızı unutmaktan bıktınız mı?')
    expect(result.beats).toHaveLength(2)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' })
    )
  })

  it('şemaya uymayan JSON yanıtında hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ topic: 'Konu' }) }],
    })

    await expect(generateReelScript('AI_AUTOMATION', [])).rejects.toThrow()
  })

  it('beats dizisi boşsa hata fırlatır', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'Konu',
            hook: 'Kanca',
            beats: [],
            cta: 'CTA',
            hashtags: [],
          }),
        },
      ],
    })

    await expect(generateReelScript('AI_AUTOMATION', [])).rejects.toThrow()
  })
})
```

Ve dosyanın en üstündeki import satırını güncelle:

```typescript
import { generateCaption, generateReelScript } from './claude'
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/claude.test.ts`
Expected: FAIL (`generateReelScript` tanımlı değil)

- [ ] **Step 3: `claude.ts`'ye ekle**

`apps/content-agent/src/lib/claude.ts` dosyasının sonuna (mevcut `generateCaption` fonksiyonundan sonra) ekle:

```typescript
export const generatedReelScriptSchema = z.object({
  topic: z.string(),
  hook: z.string(),
  beats: z.array(z.string()).min(1),
  cta: z.string(),
  hashtags: z.array(z.string()),
})

export type GeneratedReelScript = z.infer<typeof generatedReelScriptSchema>

export async function generateReelScript(
  pillar: ContentPillar,
  recentTopics: string[]
): Promise<GeneratedReelScript> {
  const message = await anthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: `Sen FaydaLab için bilgilendirici ve ikna edici, yüzsüz (seslendirmeli) Instagram reels senaryoları yazan bir içerik yazarısın. ${STYLE_GUIDE}`,
    messages: [
      {
        role: 'user',
        content: [
          PILLAR_PROMPTS[pillar],
          recentTopics.length > 0
            ? `Şu konular son zamanlarda kullanıldı, tekrar etme: ${recentTopics.join(', ')}.`
            : '',
          'Bu konuda 20-30 saniyelik bir reel senaryosu yaz. Kısa, güçlü cümleler kullan; her cümle tek başına seslendirilecek ve altyazı olarak ekranda görünecek. Açılış kancası (hook), 2-4 bilgi/fayda cümlesi (beats) ve bir kapanış çağrısı (cta) olsun.',
          'Yanıtı sadece şu JSON formatında ver, başka hiçbir metin ekleme: {"topic": string, "hook": string, "beats": string[], "cta": string, "hashtags": string[]}',
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

  return generatedReelScriptSchema.parse(JSON.parse(textBlock.text))
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/claude.test.ts`
Expected: PASS (7 test: mevcut 4 + yeni 3)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/claude.ts apps/content-agent/src/lib/claude.test.ts
git commit -m "feat: Claude ile reel senaryosu üretimi (generateReelScript)"
```

---

## Task 4: OpenAI TTS ile seslendirme

**Files:**
- Create: `apps/content-agent/src/lib/tts.ts`
- Create: `apps/content-agent/src/lib/tts.test.ts`

**Interfaces:**
- Produces: `generateSpeech(text: string): Promise<{ audioUrl: string; durationMs: number }>` — Task 10'daki `/api/generate-reel` bu fonksiyonu kullanır.

- [ ] **Step 1: Testi yaz**

`apps/content-agent/src/lib/tts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSpeechCreate, mockPut } = vi.hoisted(() => ({
  mockSpeechCreate: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    audio = { speech: { create: mockSpeechCreate } }
  },
}))

vi.mock('@vercel/blob', () => ({ put: mockPut }))

import { generateSpeech } from './tts'

// 1 saniyelik, 8000 Hz, mono, 16-bit sessiz bir WAV dosyası (senkron test verisi).
function makeSilentWavBuffer(durationSeconds: number): Buffer {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const dataSize = byteRate * durationSeconds

  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  // data kısmı zaten sıfırlarla (sessizlik) dolu — Buffer.alloc varsayılanı

  return buffer
}

describe('generateSpeech', () => {
  beforeEach(() => {
    mockSpeechCreate.mockReset()
    mockPut.mockReset()
    mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/fake.wav' })
  })

  it('WAV süresini doğru hesaplar ve Blob\'a yükler', async () => {
    const wavBuffer = makeSilentWavBuffer(2)
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength),
    })

    const result = await generateSpeech('Test cümlesi')

    expect(result.audioUrl).toBe('https://blob.vercel-storage.com/fake.wav')
    expect(result.durationMs).toBe(2000)
    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'tts-1', input: 'Test cümlesi', response_format: 'wav' })
    )
  })

  it('geçersiz WAV verisinde hata fırlatır', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => Buffer.from('not a wav file').buffer,
    })

    await expect(generateSpeech('Test')).rejects.toThrow('Geçersiz WAV')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/tts.test.ts`
Expected: FAIL (`./tts` modülü yok)

- [ ] **Step 3: `tts.ts`'yi oluştur**

```typescript
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
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/tts.test.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/tts.ts apps/content-agent/src/lib/tts.test.ts
git commit -m "feat: OpenAI TTS ile cümle bazlı seslendirme (generateSpeech)"
```

---

## Task 5: `apps/reel-renderer` — Remotion kompozisyon iskeleti

**Files:**
- Create: `apps/reel-renderer/package.json`
- Create: `apps/reel-renderer/tsconfig.json`
- Create: `apps/reel-renderer/src/ReelComposition.tsx`
- Create: `apps/reel-renderer/src/ReelComposition.test.ts`
- Create: `apps/reel-renderer/src/Root.tsx`
- Create: `apps/reel-renderer/src/index.ts`

**Interfaces:**
- Produces: `ReelComposition` React bileşeni, `ReelSegment = { text: string; audioUrl: string; durationMs: number }`, `ReelCompositionProps = { backgroundImageUrl: string; segments: ReelSegment[] }`, `totalDurationInFrames(segments: ReelSegment[]): number` — Task 6'daki render sunucusu bu tipleri ve fonksiyonu kullanır.

**Not:** Bu, `apps/content-agent`'tan tamamen bağımsız yeni bir Node.js uygulamasıdır — kendi `package.json`'ı, kendi `node_modules`'ı vardır (monorepo'da kardeş klasör).

- [ ] **Step 1: `package.json` oluştur**

```json
{
  "name": "faydalab-reel-renderer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@vercel/blob": "^2.6.1",
    "express": "^4.19.0",
    "remotion": "^4.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

**Uyarı (implementer'a):** `npm install` sırasında React sürümüyle ilgili bir peer-dependency uyarısı/hatası alırsan, `npm info remotion peerDependencies` ile Remotion'ın o an desteklediği tam React sürüm aralığını kontrol et ve `react`/`react-dom`/`@types/react`/`@types/react-dom` sürümlerini buna göre ayarla. Bu, `apps/content-agent`'ın React 19 kullanımından tamamen bağımsızdır (ayrı `package.json`).

- [ ] **Step 2: `tsconfig.json` oluştur**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "outDir": "dist",
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Bağımlılıkları kur**

Run: `cd apps/reel-renderer && npm install`
Expected: Hatasız tamamlanır (yukarıdaki uyarıyı gözönünde bulundur).

- [ ] **Step 4: Testi yaz**

`apps/reel-renderer/src/ReelComposition.test.ts`:

```typescript
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
```

- [ ] **Step 5: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/reel-renderer && npx vitest run src/ReelComposition.test.ts`
Expected: FAIL (`./ReelComposition` modülü yok)

- [ ] **Step 6: `ReelComposition.tsx`'i oluştur**

```tsx
import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export type ReelSegment = {
  text: string
  audioUrl: string
  durationMs: number
}

export type ReelCompositionProps = {
  backgroundImageUrl: string
  segments: ReelSegment[]
}

export const FPS = 30

function msToFrames(ms: number): number {
  return Math.round((ms / 1000) * FPS)
}

export function totalDurationInFrames(segments: ReelSegment[]): number {
  return segments.reduce((sum, segment) => sum + msToFrames(segment.durationMs), 0)
}

function KenBurnsBackground({ imageUrl }: { imageUrl: string }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0B0B0D' }}>
      <Img
        src={imageUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      <AbsoluteFill style={{ backgroundColor: 'rgba(11, 11, 13, 0.35)' }} />
    </AbsoluteFill>
  )
}

export function ReelComposition({ backgroundImageUrl, segments }: ReelCompositionProps) {
  let startFrame = 0
  const sequences = segments.map((segment, index) => {
    const durationInFrames = msToFrames(segment.durationMs)
    const element = (
      <Sequence key={index} from={startFrame} durationInFrames={durationInFrames}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <Audio src={segment.audioUrl} />
          <div
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 600,
              fontSize: 56,
              color: '#F5F5F5',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {segment.text}
          </div>
        </AbsoluteFill>
      </Sequence>
    )
    startFrame += durationInFrames
    return element
  })

  return (
    <AbsoluteFill>
      <KenBurnsBackground imageUrl={backgroundImageUrl} />
      {sequences}
    </AbsoluteFill>
  )
}
```

- [ ] **Step 7: Testin geçtiğini doğrula**

Run: `cd apps/reel-renderer && npx vitest run src/ReelComposition.test.ts`
Expected: PASS (2 test)

- [ ] **Step 8: `Root.tsx`'i oluştur**

```tsx
import { Composition } from 'remotion'
import { ReelComposition, totalDurationInFrames, FPS, type ReelCompositionProps } from './ReelComposition'

const DEFAULT_PROPS: ReelCompositionProps = {
  backgroundImageUrl: '',
  segments: [],
}

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={ReelComposition}
      durationInFrames={90}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(totalDurationInFrames(props.segments), 1),
      })}
    />
  )
}
```

- [ ] **Step 9: `index.ts`'i oluştur (Remotion bundle giriş noktası)**

```typescript
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

registerRoot(RemotionRoot)
```

- [ ] **Step 10: Commit**

```bash
git add apps/reel-renderer/package.json apps/reel-renderer/tsconfig.json apps/reel-renderer/src/ReelComposition.tsx apps/reel-renderer/src/ReelComposition.test.ts apps/reel-renderer/src/Root.tsx apps/reel-renderer/src/index.ts
git commit -m "feat: apps/reel-renderer Remotion kompozisyon iskeleti"
```

---

## Task 6: `apps/reel-renderer` — Render HTTP sunucusu

**Files:**
- Create: `apps/reel-renderer/src/server.ts`
- Create: `apps/reel-renderer/src/server.test.ts`

**Interfaces:**
- Consumes: `ReelComposition.tsx`'ten `totalDurationInFrames`, `ReelSegment` (Task 5)
- Produces: `POST /render` HTTP endpoint — Task 8'deki `reel-renderer-client.ts` bu endpoint'i çağırır. İstek gövdesi: `{ backgroundImageUrl: string; segments: ReelSegment[] }`. Yanıt: `{ videoUrl: string }` (200) ya da `{ error: string }` (401/400/500).

- [ ] **Step 1: Testi yaz**

`apps/reel-renderer/src/server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'http'

const { mockBundle, mockSelectComposition, mockRenderMedia, mockPut, mockReadFile } = vi.hoisted(() => ({
  mockBundle: vi.fn(),
  mockSelectComposition: vi.fn(),
  mockRenderMedia: vi.fn(),
  mockPut: vi.fn(),
  mockReadFile: vi.fn(),
}))

vi.mock('@remotion/bundler', () => ({ bundle: mockBundle }))
vi.mock('@remotion/renderer', () => ({
  selectComposition: mockSelectComposition,
  renderMedia: mockRenderMedia,
}))
vi.mock('@vercel/blob', () => ({ put: mockPut }))
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from './server'

function jsonRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const payload = JSON.stringify(body)
      const req = request.request(
        { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            server.close()
            resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null })
          })
        }
      )
      req.on('error', reject)
      req.write(payload)
      req.end()
    })
  })
}

describe('POST /render', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mockBundle.mockReset().mockResolvedValue('/tmp/bundle')
    mockSelectComposition.mockReset().mockResolvedValue({ id: 'Reel' })
    mockRenderMedia.mockReset().mockResolvedValue(undefined)
    mockReadFile.mockReset().mockResolvedValue(Buffer.from('fake-mp4-bytes'))
    mockPut.mockReset().mockResolvedValue({ url: 'https://blob.vercel-storage.com/fake.mp4' })
  })

  it('yetkisiz istekte 401 döner', async () => {
    const app = createApp()
    const result = await jsonRequest(app, '/render', { backgroundImageUrl: 'https://x/img.png', segments: [] })
    expect(result.status).toBe(401)
  })

  it('geçersiz gövdede 400 döner', async () => {
    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      { backgroundImageUrl: 'not-a-url' },
      { authorization: 'Bearer test-secret' }
    )
    expect(result.status).toBe(400)
  })

  it('geçerli istekte video render edip Blob URL döner', async () => {
    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      {
        backgroundImageUrl: 'https://x/img.png',
        segments: [{ text: 'merhaba', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
      },
      { authorization: 'Bearer test-secret' }
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ videoUrl: 'https://blob.vercel-storage.com/fake.mp4' })
    expect(mockRenderMedia).toHaveBeenCalled()
    expect(mockPut).toHaveBeenCalled()
  })

  it('render başarısız olursa 500 döner', async () => {
    mockRenderMedia.mockRejectedValue(new Error('render patladı'))

    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      {
        backgroundImageUrl: 'https://x/img.png',
        segments: [{ text: 'merhaba', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
      },
      { authorization: 'Bearer test-secret' }
    )

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('render_failed')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/reel-renderer && npx vitest run src/server.test.ts`
Expected: FAIL (`./server` modülü yok)

- [ ] **Step 3: `server.ts`'yi oluştur**

```typescript
import express, { type Express } from 'express'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { put } from '@vercel/blob'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'

const segmentSchema = z.object({
  text: z.string(),
  audioUrl: z.string().url(),
  durationMs: z.number().positive(),
})

const renderRequestSchema = z.object({
  backgroundImageUrl: z.string().url(),
  segments: z.array(segmentSchema).min(1),
})

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function verifyAuth(authHeader: string | undefined): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret || !authHeader) return false
  return timingSafeEqualStrings(authHeader, `Bearer ${secret}`)
}

let bundleLocationPromise: Promise<string> | null = null

function getBundleLocation(): Promise<string> {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({ entryPoint: path.join(process.cwd(), 'src', 'index.ts') })
  }
  return bundleLocationPromise
}

export function createApp(): Express {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.post('/render', async (req, res) => {
    if (!verifyAuth(req.headers.authorization)) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const parsed = renderRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const { backgroundImageUrl, segments } = parsed.data
    const inputProps = { backgroundImageUrl, segments }

    try {
      const serveUrl = await getBundleLocation()
      const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps })

      const outputPath = path.join(os.tmpdir(), `reel-${Date.now()}.mp4`)

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: { enableMultiProcessOnLinux: true },
      })

      const fileBuffer = await readFile(outputPath)
      const blob = await put(`reel-videos/${Date.now()}.mp4`, fileBuffer, {
        access: 'public',
        contentType: 'video/mp4',
      })

      await unlink(outputPath).catch(() => {})

      res.json({ videoUrl: blob.url })
    } catch (error) {
      res.status(500).json({ error: 'render_failed', message: (error as Error).message })
    }
  })

  return app
}

if (require.main === module) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => {
    console.log(`reel-renderer listening on port ${port}`)
  })
}
```

**Not:** `createApp()` fonksiyonu test edilebilirlik için sunucu kurulumunu `app.listen()` çağrısından ayırır — test dosyası gerçek bir port açıp kapatarak HTTP üzerinden test eder (mock'lanan Remotion çağrıları anında döner, gerçek render/Chromium hiç çalışmaz).

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/reel-renderer && npx vitest run src/server.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add apps/reel-renderer/src/server.ts apps/reel-renderer/src/server.test.ts
git commit -m "feat: apps/reel-renderer render HTTP sunucusu (POST /render)"
```

---

## Task 7: content-agent → reel-renderer HTTP istemcisi

**Files:**
- Create: `apps/content-agent/src/lib/reel-renderer-client.ts`
- Create: `apps/content-agent/src/lib/reel-renderer-client.test.ts`

**Interfaces:**
- Produces: `renderReel(input: { backgroundImageUrl: string; segments: RenderSegment[] }): Promise<{ videoUrl: string }>`, `RenderSegment = { text: string; audioUrl: string; durationMs: number }` — Task 10 bunu kullanır.

- [ ] **Step 1: Testi yaz**

`apps/content-agent/src/lib/reel-renderer-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderReel } from './reel-renderer-client'

describe('renderReel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    process.env.REEL_RENDERER_URL = 'https://reel-renderer.example.com'
    process.env.INTERNAL_API_SECRET = 'test-secret'
  })

  it('render servisine doğru istek atar ve videoUrl döner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://blob.vercel-storage.com/video.mp4' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await renderReel({
      backgroundImageUrl: 'https://x/img.png',
      segments: [{ text: 'a', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
    })

    expect(result.videoUrl).toBe('https://blob.vercel-storage.com/video.mp4')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://reel-renderer.example.com/render',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-secret' }),
      })
    )
  })

  it('REEL_RENDERER_URL tanımlı değilse hata fırlatır', async () => {
    delete process.env.REEL_RENDERER_URL

    await expect(
      renderReel({ backgroundImageUrl: 'https://x/img.png', segments: [] })
    ).rejects.toThrow('REEL_RENDERER_URL')
  })

  it('render servisi hata dönerse hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'render_failed' })
    )

    await expect(
      renderReel({ backgroundImageUrl: 'https://x/img.png', segments: [] })
    ).rejects.toThrow('Reel render isteği başarısız')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/reel-renderer-client.test.ts`
Expected: FAIL (modül yok)

- [ ] **Step 3: `reel-renderer-client.ts`'yi oluştur**

```typescript
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
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/reel-renderer-client.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/reel-renderer-client.ts apps/content-agent/src/lib/reel-renderer-client.test.ts
git commit -m "feat: content-agent'tan reel-renderer'a HTTP istemcisi"
```

---

## Task 8: Telegram — reel video önizlemesi

**Files:**
- Modify: `apps/content-agent/src/lib/telegram.ts`
- Modify: `apps/content-agent/src/lib/telegram.test.ts`

**Interfaces:**
- Produces: `sendReelPreview(contentItemId: string, videoUrl: string, caption: string): Promise<TelegramSendResult>` — Task 10 bunu kullanır.

- [ ] **Step 1: Mevcut test dosyasını incele ve yeni testi ekle**

`apps/content-agent/src/lib/telegram.test.ts` dosyasının sonuna (mevcut `sendContentPreview` testlerinden sonra, `sendAlert`/`answerCallbackQuery` testlerinden önce ya da dosya sonuna) ekle. Önce dosyanın importunu güncelle:

```typescript
import { sendContentPreview, sendReelPreview, answerCallbackQuery, sendAlert } from './telegram'
```

Sonra ekle:

```typescript
describe('sendReelPreview', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '12345'
  })

  it('sendVideo çağrısı yapar ve onay/red butonlarını ekler', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { chat: { id: 12345 }, message_id: 99 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendReelPreview('content-1', 'https://x/video.mp4', 'Caption metni')

    expect(result).toEqual({ chatId: '12345', messageId: '99' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/sendVideo')
    const body = JSON.parse(options.body)
    expect(body.video).toBe('https://x/video.mp4')
    expect(body.reply_markup.inline_keyboard[0]).toEqual([
      { text: '✅ Onayla', callback_data: 'approve:content-1' },
      { text: '❌ Reddet', callback_data: 'reject:content-1' },
    ])
  })

  it('TELEGRAM_CHAT_ID tanımlı değilse hata fırlatır', async () => {
    delete process.env.TELEGRAM_CHAT_ID

    await expect(sendReelPreview('content-1', 'https://x/video.mp4', 'Caption')).rejects.toThrow(
      'TELEGRAM_CHAT_ID'
    )
  })

  it('Telegram hata dönerse hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    )

    await expect(sendReelPreview('content-1', 'https://x/video.mp4', 'Caption')).rejects.toThrow(
      'Telegram sendVideo başarısız'
    )
  })
})
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/telegram.test.ts`
Expected: FAIL (`sendReelPreview` tanımlı değil)

- [ ] **Step 3: `telegram.ts`'ye ekle**

`sendContentPreview` fonksiyonundan hemen sonra ekle:

```typescript
export async function sendReelPreview(
  contentItemId: string,
  videoUrl: string,
  caption: string
): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID ortam değişkeni tanımlı değil')
  }

  const response = await fetch(`${apiBase()}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Onayla', callback_data: `approve:${contentItemId}` },
            { text: '❌ Reddet', callback_data: `reject:${contentItemId}` },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram sendVideo başarısız: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return { chatId: String(data.result.chat.id), messageId: String(data.result.message_id) }
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/telegram.test.ts`
Expected: PASS (mevcut testler + yeni 3 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/telegram.ts apps/content-agent/src/lib/telegram.test.ts
git commit -m "feat: Telegram'a sendVideo ile reel önizlemesi (sendReelPreview)"
```

---

## Task 9: Instagram — REELS yayını

**Files:**
- Modify: `apps/content-agent/src/lib/instagram.ts`
- Modify: `apps/content-agent/src/lib/instagram.test.ts`

**Interfaces:**
- Consumes: `waitForContainerReady` (dosyada zaten mevcut, `maxAttempts` parametresi eklenir)
- Produces: `publishReel(accessToken: string, igUserId: string, videoUrl: string, caption: string): Promise<PublishResult>` — Task 11'deki `/api/publish` bunu kullanır.

- [ ] **Step 1: Testleri yaz**

`apps/content-agent/src/lib/instagram.test.ts` dosyasının import satırını güncelle:

```typescript
import { publishImage, publishReel, refreshLongLivedToken } from './instagram'
```

`describe('publishImage', ...)` bloğundan sonra, `describe('refreshLongLivedToken', ...)` bloğundan önce ekle:

```typescript
describe('publishReel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUBLISH_MODE draft ise gerçek API çağrısı yapmadan sahte mediaId döner', async () => {
    process.env.PUBLISH_MODE = 'draft'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')

    expect(result.mediaId).toContain('draft-mode-')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('PUBLISH_MODE live ise REELS media_type ile container oluşturur, bekler ve yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')

    expect(result.mediaId).toBe('media-1')
    const createCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(createCallBody).toEqual({
      media_type: 'REELS',
      video_url: 'https://example.com/video.mp4',
      caption: 'caption',
    })
  })

  it('container oluşturma başarısız olursa hata fırlatır', async () => {
    process.env.PUBLISH_MODE = 'live'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: async () => 'bad request' })
    )

    await expect(
      publishReel('token', 'user-1', 'https://example.com/video.mp4', 'caption')
    ).rejects.toThrow('Instagram reel oluşturma başarısız')
  })
})
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/instagram.test.ts`
Expected: FAIL (`publishReel` tanımlı değil)

- [ ] **Step 3: `instagram.ts`'yi güncelle**

`waitForContainerReady` fonksiyonunun imzasını güncelle (mevcut sabit `CONTAINER_STATUS_MAX_ATTEMPTS` parametre olarak da kullanılabilir hale gelsin):

```typescript
const CONTAINER_STATUS_MAX_ATTEMPTS = 10
const REEL_CONTAINER_STATUS_MAX_ATTEMPTS = 30
const CONTAINER_STATUS_POLL_INTERVAL_MS = 2000

async function waitForContainerReady(
  creationId: string,
  accessToken: string,
  maxAttempts: number = CONTAINER_STATUS_MAX_ATTEMPTS
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResponse = await requestGraphApi(
      `${GRAPH_API_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
    )

    if (!statusResponse.ok) {
      throw new Error(`Instagram media durum kontrolü başarısız: ${redactAccessToken(await statusResponse.text())}`)
    }

    const { status_code: statusCode } = await statusResponse.json()

    if (statusCode === 'FINISHED') {
      return
    }
    if (statusCode === 'ERROR') {
      throw new Error('Instagram media işleme hatası: status_code=ERROR')
    }

    await new Promise((resolve) => setTimeout(resolve, CONTAINER_STATUS_POLL_INTERVAL_MS))
  }

  throw new Error('Instagram media zaman aşımına uğradı: container hazır olmadı')
}
```

(Bu sadece `maxAttempts` parametresini varsayılan değerle ekler — `publishImage`'daki mevcut çağrı `waitForContainerReady(creationId, accessToken)` değişmeden çalışmaya devam eder.)

Dosyanın sonuna, `refreshLongLivedToken`'dan önce ekle:

```typescript
export async function publishReel(
  accessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  if (process.env.PUBLISH_MODE !== 'live') {
    return { mediaId: `draft-mode-${Date.now()}` }
  }

  const createResponse = await requestGraphApi(
    `${GRAPH_API_BASE}/${igUserId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, caption }),
    }
  )

  if (!createResponse.ok) {
    throw new Error(`Instagram reel oluşturma başarısız: ${redactAccessToken(await createResponse.text())}`)
  }

  const { id: creationId } = await createResponse.json()

  await waitForContainerReady(creationId, accessToken, REEL_CONTAINER_STATUS_MAX_ATTEMPTS)

  const publishResponse = await requestGraphApi(
    `${GRAPH_API_BASE}/${igUserId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId }),
    }
  )

  if (!publishResponse.ok) {
    throw new Error(`Instagram reel yayınlama başarısız: ${redactAccessToken(await publishResponse.text())}`)
  }

  const { id: mediaId } = await publishResponse.json()
  return { mediaId }
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/instagram.test.ts`
Expected: PASS (mevcut testler + yeni 3 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/instagram.ts apps/content-agent/src/lib/instagram.test.ts
git commit -m "feat: Instagram REELS yayını (publishReel)"
```

---

## Task 10: `/api/generate-reel` orkestrasyon endpoint'i

**Files:**
- Create: `apps/content-agent/src/app/api/generate-reel/route.ts`
- Create: `apps/content-agent/src/app/api/generate-reel/route.test.ts`

**Interfaces:**
- Consumes: `getNextPillar`, `getRecentTopics` (Task 2), `generateReelScript` (Task 3), `generateSpeech` (Task 4), `renderReel` (Task 7), `sendReelPreview`, `sendAlert` (Task 8), `generateImage` (mevcut `image-gen.ts`), `withRetry` (mevcut), `verifyInternalAuthHeader` (mevcut)

- [ ] **Step 1: Testi yaz**

`apps/content-agent/src/app/api/generate-reel/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getNextPillar: vi.fn(),
  getRecentTopics: vi.fn(),
  generateReelScript: vi.fn(),
  generateSpeech: vi.fn(),
  generateImage: vi.fn(),
  renderReel: vi.fn(),
  sendReelPreview: vi.fn(),
  sendAlert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/content-pillars', () => ({
  getNextPillar: mocks.getNextPillar,
  getRecentTopics: mocks.getRecentTopics,
}))
vi.mock('@/lib/claude', () => ({ generateReelScript: mocks.generateReelScript }))
vi.mock('@/lib/tts', () => ({ generateSpeech: mocks.generateSpeech }))
vi.mock('@/lib/image-gen', () => ({ generateImage: mocks.generateImage }))
vi.mock('@/lib/reel-renderer-client', () => ({ renderReel: mocks.renderReel }))
vi.mock('@/lib/telegram', () => ({
  sendReelPreview: mocks.sendReelPreview,
  sendAlert: mocks.sendAlert,
}))
vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { create: mocks.create, update: mocks.update } },
}))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/generate-reel', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/generate-reel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mocks.getNextPillar.mockResolvedValue('AI_AUTOMATION')
    mocks.getRecentTopics.mockResolvedValue([])
    mocks.generateReelScript.mockResolvedValue({
      topic: 'Konu',
      hook: 'Kanca',
      beats: ['Birinci', 'İkinci'],
      cta: 'Çağrı',
      hashtags: ['ai'],
    })
    mocks.generateSpeech.mockImplementation(async (text: string) => ({
      audioUrl: `https://x/${text}.wav`,
      durationMs: 1000,
    }))
    mocks.generateImage.mockResolvedValue('https://example.com/bg.png')
    mocks.renderReel.mockResolvedValue({ videoUrl: 'https://example.com/video.mp4' })
    mocks.create.mockResolvedValue({ id: 'reel-1' })
    mocks.sendReelPreview.mockResolvedValue({ chatId: '1', messageId: '2' })
    mocks.update.mockResolvedValue({})
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(new Request('http://localhost/api/generate-reel', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('başarılı akışta 4 cümleyi seslendirir, render eder ve Telegram\'a gönderir', async () => {
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ id: 'reel-1', status: 'PENDING_APPROVAL' })
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(4) // hook + 2 beats + cta
    expect(mocks.renderReel).toHaveBeenCalledWith({
      backgroundImageUrl: 'https://example.com/bg.png',
      segments: expect.arrayContaining([
        expect.objectContaining({ text: 'Kanca' }),
      ]),
    })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ format: 'REEL', videoUrl: 'https://example.com/video.mp4' }),
      })
    )
    expect(mocks.sendReelPreview).toHaveBeenCalled()
  })

  it('sütun seçimi başarısız olursa 500 döner', async () => {
    mocks.getNextPillar.mockRejectedValue(new Error('db hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'pillar_selection_failed' })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('db hatası'))
  })

  it('senaryo üretimi başarısız olursa 500 döner', async () => {
    mocks.generateReelScript.mockRejectedValue(new Error('claude hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'script_generation_failed' })
  })

  it('seslendirme başarısız olursa 500 döner', async () => {
    mocks.generateSpeech.mockRejectedValue(new Error('tts hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'speech_generation_failed' })
  })

  it('render başarısız olursa 500 döner', async () => {
    mocks.renderReel.mockRejectedValue(new Error('render hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'render_failed' })
  })

  it('Telegram gönderimi başarısız olursa GENERATION_FAILED işaretler', async () => {
    mocks.sendReelPreview.mockRejectedValue(new Error('telegram hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'telegram_send_failed' })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'GENERATION_FAILED' } })
    )
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/generate-reel/route.test.ts`
Expected: FAIL (route dosyası yok)

- [ ] **Step 3: `route.ts`'yi oluştur**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getNextPillar, getRecentTopics } from '@/lib/content-pillars'
import { generateReelScript } from '@/lib/claude'
import { generateSpeech } from '@/lib/tts'
import { generateImage } from '@/lib/image-gen'
import { renderReel } from '@/lib/reel-renderer-client'
import { sendReelPreview, sendAlert } from '@/lib/telegram'
import { withRetry } from '@/lib/with-retry'
import { verifyInternalAuthHeader } from '@/lib/auth'

// Script + 4 TTS çağrısı + görsel + render + Telegram yüklemesi zincirleniyor.
export const maxDuration = 300

const TELEGRAM_CAPTION_LIMIT = 1000

function truncateForTelegram(caption: string): string {
  return caption.length > TELEGRAM_CAPTION_LIMIT
    ? `${caption.slice(0, TELEGRAM_CAPTION_LIMIT)}…`
    : caption
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let pillar
  let recentTopics: string[]
  try {
    pillar = await getNextPillar(prisma, 'REEL')
    recentTopics = await getRecentTopics(prisma, pillar, 'REEL')
  } catch (error) {
    await sendAlert(`Reel sütun seçimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'pillar_selection_failed' }, { status: 500 })
  }

  let script
  try {
    script = await withRetry(() => generateReelScript(pillar, recentTopics))
  } catch (error) {
    await sendAlert(`Reel senaryo üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'script_generation_failed' }, { status: 500 })
  }

  const sentences = [script.hook, ...script.beats, script.cta]

  let segments: { text: string; audioUrl: string; durationMs: number }[]
  try {
    segments = await withRetry(() =>
      Promise.all(
        sentences.map(async (text) => {
          const { audioUrl, durationMs } = await generateSpeech(text)
          return { text, audioUrl, durationMs }
        })
      )
    )
  } catch (error) {
    await sendAlert(`Reel seslendirmesi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'speech_generation_failed' }, { status: 500 })
  }

  let backgroundImageUrl: string
  try {
    backgroundImageUrl = await withRetry(() => generateImage(`${script.topic}: ${script.hook}`))
  } catch (error) {
    await sendAlert(`Reel arka plan görseli üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'image_generation_failed' }, { status: 500 })
  }

  let videoUrl: string
  try {
    const rendered = await withRetry(() => renderReel({ backgroundImageUrl, segments }))
    videoUrl = rendered.videoUrl
  } catch (error) {
    await sendAlert(`Reel render işlemi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'render_failed' }, { status: 500 })
  }

  let contentItem
  let previewCaption: string
  try {
    const fullCaption = `${sentences.join(' ')}\n\n${script.hashtags.map((h: string) => `#${h}`).join(' ')}`

    contentItem = await prisma.contentItem.create({
      data: {
        pillar,
        format: 'REEL',
        topic: script.topic,
        caption: sentences.join(' '),
        hashtags: script.hashtags,
        videoUrl,
        status: 'PENDING_APPROVAL',
      },
    })

    previewCaption = truncateForTelegram(fullCaption)
  } catch (error) {
    await sendAlert(`Reel kaydı oluşturulamadı: ${(error as Error).message}`)
    return NextResponse.json({ error: 'content_persist_failed' }, { status: 500 })
  }

  try {
    const { chatId, messageId } = await sendReelPreview(contentItem.id, videoUrl, previewCaption)
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { telegramChatId: chatId, telegramMessageId: messageId },
    })
  } catch (error) {
    await sendAlert(`Reel için Telegram önizlemesi gönderilemedi: ${(error as Error).message}`)
    try {
      await prisma.contentItem.update({
        where: { id: contentItem.id },
        data: { status: 'GENERATION_FAILED' },
      })
    } catch {
      // Durum güncellenemedi; uyarı zaten gönderildi.
    }
    return NextResponse.json({ error: 'telegram_send_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: contentItem.id, status: 'PENDING_APPROVAL' })
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/generate-reel/route.test.ts`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/app/api/generate-reel
git commit -m "feat: /api/generate-reel orkestrasyon endpoint'i"
```

---

## Task 11: `/api/publish` — reel yayınını destekle

**Files:**
- Modify: `apps/content-agent/src/app/api/publish/route.ts`
- Modify: `apps/content-agent/src/app/api/publish/route.test.ts`

**Interfaces:**
- Consumes: `publishReel` (Task 9)

**Neden gerekli:** Mevcut sorgu `imageUrl: { not: null }` şartını zorunlu tutuyor; reels'in `imageUrl`'i yok (sadece `videoUrl`'i var), bu yüzden hiç yakalanmazlardı. Sorgu format-duyarlı hale getirilir.

- [ ] **Step 1: Testleri güncelle**

`apps/content-agent/src/app/api/publish/route.test.ts` dosyasında `'yalnızca görseli olan içerikleri sorgular'` testini şununla değiştir:

```typescript
  it('onaylı ve zamanı gelmiş, medyası hazır içerikleri sorgular', async () => {
    await POST(makeRequest())

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'APPROVED',
          OR: [
            { format: 'STATIC', imageUrl: { not: null } },
            { format: 'REEL', videoUrl: { not: null } },
          ],
        }),
      })
    )
  })
```

Ve `mocks.publishImage` importunun yanına `mocks.publishReel` ekle — dosyanın en üstündeki mock tanımını güncelle:

```typescript
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  publishImage: vi.fn(),
  publishReel: vi.fn(),
  sendAlert: vi.fn(),
}))
```

```typescript
vi.mock('@/lib/instagram', () => ({ publishImage: mocks.publishImage, publishReel: mocks.publishReel }))
```

`describe('POST /api/publish', ...)` bloğunun sonuna yeni bir test ekle:

```typescript
  it('format REEL olan içerikleri publishReel ile yayınlar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'reel-1', format: 'REEL', caption: 'C', hashtags: [], videoUrl: 'https://x/video.mp4' },
    ])
    mocks.publishReel.mockResolvedValue({ mediaId: 'media-reel-1' })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.results[0]).toEqual({ id: 'reel-1', status: 'published' })
    expect(mocks.publishReel).toHaveBeenCalledWith('', 'ig-user-1', 'https://x/video.mp4', expect.any(String))
    expect(mocks.publishImage).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/publish/route.test.ts`
Expected: FAIL (sorgu şekli ve `publishReel` dalı henüz yok)

- [ ] **Step 3: `route.ts`'yi güncelle**

Import satırını değiştir:

```typescript
import { publishImage, publishReel } from '@/lib/instagram'
```

`findMany` çağrısını değiştir:

```typescript
  const now = new Date()
  const claimed = await prisma.contentItem.findMany({
    where: {
      status: 'APPROVED',
      scheduledFor: { lte: now },
      OR: [
        { format: 'STATIC', imageUrl: { not: null } },
        { format: 'REEL', videoUrl: { not: null } },
      ],
    },
  })
```

`try` bloğu içindeki yayın çağrısını değiştir:

```typescript
    try {
      const fullCaption = `${item.caption}\n\n${item.hashtags.map((h: string) => `#${h}`).join(' ')}`
      const { mediaId } =
        item.format === 'REEL'
          ? await publishReel(accessToken, process.env.INSTAGRAM_USER_ID!, item.videoUrl!, fullCaption)
          : await publishImage(accessToken, process.env.INSTAGRAM_USER_ID!, item.imageUrl!, fullCaption)
```

(Geri kalan kod — `catch` blokları, `SCHEDULED` kilidi, stale-claim süpürmesi — değişmeden kalır.)

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/publish/route.test.ts`
Expected: PASS (mevcut testler + yeni test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/app/api/publish/route.ts apps/content-agent/src/app/api/publish/route.test.ts
git commit -m "feat: /api/publish reel (video) yayınını destekler"
```

---

## Task 12: Dockerfile, .env.example ve README güncellemeleri

**Files:**
- Create: `apps/reel-renderer/Dockerfile`
- Create: `apps/reel-renderer/.dockerignore`
- Modify: `apps/content-agent/.env.example`
- Modify: `apps/content-agent/README.md`
- Create: `apps/reel-renderer/README.md`

- [ ] **Step 1: `Dockerfile`'ı oluştur**

Remotion'ın resmi Docker rehberindeki (docs/docker.mdx) desene dayanır — Chrome Headless Shell bağımlılıkları apt ile, tarayıcının kendisi `npx remotion browser ensure` ile kurulur (sistem `chromium` paketi kullanılmaz, Remotion kendi yönettiği sürümü indirir).

```dockerfile
FROM node:22-bookworm-slim

# Chrome Headless Shell bağımlılıkları (Remotion resmi dokümantasyonu:
# https://www.remotion.dev/docs/docker)
RUN apt-get update
RUN apt install -y \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libgbm-dev \
  libasound2 \
  libxrandr2 \
  libxkbcommon-dev \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libatk-bridge2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

# Remotion'ın kendi yönettiği Chrome Headless Shell'i indir.
RUN npx remotion browser ensure

ENV PORT=3001
EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
```

- [ ] **Step 2: `.dockerignore`'u oluştur**

```
node_modules
dist
.git
*.log
```

- [ ] **Step 3: `apps/content-agent/.env.example`'a ekle**

Dosyanın sonuna ekle:

```
# Reel render servisi (apps/reel-renderer, Railway'de ayrı deploy edilir)
REEL_RENDERER_URL=""
```

- [ ] **Step 4: `apps/reel-renderer/README.md`'yi oluştur**

```markdown
# FaydaLab Reel Renderer

FaydaLab Faz 1b — Remotion tabanlı reel/video render servisi. Tasarım: [../../docs/superpowers/specs/2026-08-03-reels-video-automation-design.md](../../docs/superpowers/specs/2026-08-03-reels-video-automation-design.md)

`apps/content-agent`'tan bağımsız bir Node.js servisidir; Railway'de Docker konteyner olarak çalışır.

## Kurulum (yerel)

1. `npm install`
2. Ortam değişkenleri:
   - `INTERNAL_API_SECRET` — `apps/content-agent` ile aynı değer (istek doğrulama için)
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob'a video yüklemek için, `apps/content-agent` ile aynı Blob store
   - `PORT` (opsiyonel, varsayılan 3001)
3. `npm run dev`

## Endpoint

`POST /render` — `Authorization: Bearer $INTERNAL_API_SECRET` gerektirir.

İstek gövdesi:
```json
{
  "backgroundImageUrl": "https://...",
  "segments": [{ "text": "...", "audioUrl": "https://...", "durationMs": 1234 }]
}
```

Yanıt: `{ "videoUrl": "https://..." }`

## Railway'e Deploy

1. Railway'de yeni proje oluştur, bu klasörü (`apps/reel-renderer`) kaynak olarak bağla (monorepo'da "Root Directory" ayarını `apps/reel-renderer` yap)
2. Railway, `Dockerfile`'ı otomatik algılayıp Docker build ile deploy eder
3. Ortam değişkenlerini (`INTERNAL_API_SECRET`, `BLOB_READ_WRITE_TOKEN`) Railway projesinin Variables kısmına ekle
4. Deploy tamamlandığında Railway'in verdiği public URL'i `apps/content-agent`'ın `REEL_RENDERER_URL` ortam değişkenine ekle
```

- [ ] **Step 5: `apps/content-agent/README.md`'yi güncelle**

Başlık altındaki açıklama satırını güncelle:

```markdown
FaydaLab Faz 1a/1b — Instagram statik ve reel içerik üretim, onay ve yayın hattı. Tasarım: [../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md](../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md), [../../docs/superpowers/specs/2026-08-03-reels-video-automation-design.md](../../docs/superpowers/specs/2026-08-03-reels-video-automation-design.md)
```

Endpoint tablosuna yeni satır ekle (`POST /api/generate` satırından hemen sonra):

```markdown
| `POST /api/generate-reel` | n8n haftalık tetikleyici (2x) | Yeni reel üretir (script + TTS + görsel + render), Telegram'a video önizlemesi gönderir |
```

- [ ] **Step 6: Commit**

```bash
git add apps/reel-renderer/Dockerfile apps/reel-renderer/.dockerignore apps/reel-renderer/README.md apps/content-agent/.env.example apps/content-agent/README.md
git commit -m "docs: reel-renderer Dockerfile, README ve env değişkeni dokümantasyonu"
```

---

## Task 13 [Kullanıcı tarafı]: Railway'e reel-renderer deploy

Bu task koddan bağımsızdır ve bir subagent'a dispatch edilmez — kullanıcı hesabı gerektiren interaktif bir kurulumdur (Vercel/Meta/n8n kurulumlarında izlenen yöntemin aynısı).

- [ ] Railway hesabı oluştur (railway.app), yeni proje başlat
- [ ] GitHub reposunu bağla, "Root Directory" olarak `apps/reel-renderer` seç
- [ ] Ortam değişkenlerini ekle: `INTERNAL_API_SECRET` (content-agent'takiyle birebir aynı değer), `BLOB_READ_WRITE_TOKEN` (content-agent'takiyle birebir aynı değer)
- [ ] Deploy'un başarılı olduğunu Railway loglarından doğrula (Chrome Headless Shell indirme adımı dahil)
- [ ] Railway'in verdiği public URL'i `apps/content-agent`'ın Vercel ortam değişkenlerine `REEL_RENDERER_URL` olarak ekle, yeniden deploy et

---

## Task 14 [Kullanıcı tarafı]: n8n Workflow 4 kurulumu

- [ ] `docs/n8n-workflows.md`'ye "Workflow 4 — Haftalık Reel Üretimi" bölümünü ekle (Schedule Trigger: haftada 2 gün örn. Salı/Cuma 09:00 → HTTP Request → `POST /api/generate-reel`, aynı Header Auth credential'ı)
- [ ] n8n Cloud'da yeni workflow'u interaktif olarak kur (mevcut 3 workflow'da izlenen adımlar), Publish et

---

## Task 15 [Kullanıcı tarafı]: Uçtan uca doğrulama

- [ ] `PUBLISH_MODE=draft` iken `/api/generate-reel`'i tetikle, Telegram'a video önizlemesinin geldiğini doğrula
- [ ] Onayla, `scheduledFor`'u elle geçmişe çekip `/api/publish`'i tetikle, `status: PUBLISHED`, `instagramMediaId: draft-mode-...` olduğunu doğrula
- [ ] `PUBLISH_MODE=live` iken kontrollü tek bir gerçek reel testi yap (statik postlarda izlenen yöntem), Instagram'da gerçek bir Reels gönderisinin göründüğünü doğrula

---

## Self-Review Notları (yazar tarafından yapıldı)

- **Spec kapsaması:** Tasarım dokümanındaki her bölüm (script/TTS/görsel/render, veri modeli, onay akışı, n8n, hata yönetimi, kabul kriterleri) yukarıdaki 15 task'ta karşılanıyor.
- **Placeholder taraması:** Yok — her adımda çalışır durumda gerçek kod var.
- **Tip tutarlılığı:** `RenderSegment`/`ReelSegment` iki farklı dosyada (content-agent ve reel-renderer, ayrı paketler) aynı alan adlarıyla (`text`, `audioUrl`, `durationMs`) tanımlanıyor — HTTP sınırı üzerinden JSON olarak taşındığı için ortak bir TypeScript tipi paylaşmaları gerekmiyor, ama alan adları/tipleri birebir eşleşiyor, bu kasıtlı ve kontrol edildi.
