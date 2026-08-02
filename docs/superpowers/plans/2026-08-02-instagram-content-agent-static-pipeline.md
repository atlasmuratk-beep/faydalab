# FaydaLab Faz 1a — Instagram İçerik Ajanı: Statik Post Temel Hattı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statik görsel+metin Instagram postları için uçtan uca çalışan bir üretim → Telegram onayı → yayın hattı kurmak (draft modda doğrulanmış, Meta onayı sonrası canlıya alınabilir durumda).

**Architecture:** Next.js (App Router) API servisi (`apps/content-agent`), Neon Postgres + Prisma veri katmanı, Anthropic Claude ile metin üretimi, OpenAI görsel üretimi, Telegram Bot API ile onay akışı, Instagram Graph API ile yayın. n8n Cloud bu servisi HTTP çağrılarıyla tetikler (bu planın kapsamında n8n workflow'ları kod olarak değil, kurulum rehberi olarak ele alınır).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma, Neon Postgres, @anthropic-ai/sdk, openai, zod, Vitest.

## Global Constraints

- Onaylanmamış içerik süresiz beklemede kalır — zaman aşımıyla otomatik yayınlanmaz (spec: Onay Akışı)
- Görsel/metin üretimi başarısız olursa sistem bir kez otomatik tekrar dener, yine başarısız olursa Telegram'a hata bildirimi gider (spec: Hata Yönetimi)
- Yayın başarısız olursa sessizce düşmez, Telegram'a hata detayıyla bildirim gider (spec: Hata Yönetimi)
- `PUBLISH_MODE` ortam değişkeni `live` olmadıkça gerçek Instagram `publish` çağrısı yapılmaz — sistem draft modda çalışır (spec: Ön Koşullar)
- Instagram token'ları ~60 günde bir yenilenmelidir; yenileme başarısız olursa Telegram'a ACİL uyarı gider (spec: Token Yönetimi)
- Görsel üretim prompt'ları [01-brand-identity.md](../../01-brand-identity.md) ve bu planın style-guide sabitinde tanımlı tutarlılık kurallarına uymalı
- İki içerik sütunü (AI_AUTOMATION, WEB_QR_CASE_STUDY) dönüşümlü kullanılır (spec: İçerik Üretim Hattı)
- Bu plan **sadece statik postları** kapsar. Reels/video (Remotion) ayrı bir plan (Faz 1b) olarak yürütülecek — aynı veri modelini kullanacağı için `ContentFormat` enum'u ileride `VIDEO` değeriyle genişletilebilir şekilde tasarlanmalı.

---

### Task 1: Ön koşul hesapları ve ortam değişkenleri checklist'i

Bu görev kod içermez — sonraki tüm görevlerin dayandığı hesapları ve gizli anahtarları hazırlar.

**Files:**
- Create: `apps/content-agent/.env.example`
- Create: `docs/superpowers/plans/2026-08-02-prerequisites-checklist.md`

**Interfaces:**
- Produces: Sonraki tüm görevlerin `process.env.*` üzerinden okuyacağı değişken adları

- [ ] **Step 1: Prerequisites checklist dokümanını yaz**

`docs/superpowers/plans/2026-08-02-prerequisites-checklist.md`:

```markdown
# Faz 1a Ön Koşul Checklist'i

Kod yazmaya başlamadan önce aşağıdaki hesaplar/anahtarlar hazır olmalı (hepsi olmadan da geliştirme sürdürülebilir — testler mock kullanır — ama gerçek entegrasyon testi için gereklidir):

- [ ] Neon Postgres veritabanı oluşturuldu, `DATABASE_URL` alındı
- [ ] Anthropic API anahtarı alındı (`ANTHROPIC_API_KEY`)
- [ ] OpenAI API anahtarı alındı (`OPENAI_API_KEY`)
- [ ] Telegram'da BotFather ile bot oluşturuldu, `TELEGRAM_BOT_TOKEN` alındı
- [ ] Kişisel Telegram `chat_id` öğrenildi (bota bir mesaj atıp `getUpdates` ile bulunur), `TELEGRAM_CHAT_ID` olarak not edildi
- [ ] Instagram hesabı iş hesabına çevrildi, bağlı Facebook Sayfası oluşturuldu
- [ ] Meta Developer'da uygulama oluşturuldu, Instagram Graph API için App Review başvurusu yapıldı (bu adım günler sürebilir, bloklamaz — sistem draft modda geliştirilmeye devam eder)
- [ ] Minimal gizlilik politikası + iletişim sayfası yayınlandı (Meta App Review için gereken URL)
- [ ] Vercel projesi oluşturuldu, `apps/content-agent` root directory olarak ayarlandı

Bu adımların hiçbiri Task 2-12'yi bloklamaz (tüm dış servisler testlerde mock'lanır). Task 15 (uçtan uca doğrulama) için gereklidir.
```

- [ ] **Step 2: .env.example dosyasını yaz**

`apps/content-agent/.env.example`:

```bash
# Veritabanı
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Claude (metin üretimi)
ANTHROPIC_API_KEY=""

# OpenAI (görsel üretimi)
OPENAI_API_KEY=""

# Telegram (onay akışı)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
TELEGRAM_WEBHOOK_SECRET=""

# Instagram Graph API
INSTAGRAM_USER_ID=""
PUBLISH_MODE="draft"

# İç servisler arası kimlik doğrulama (n8n -> bu servis)
INTERNAL_API_SECRET=""
```

- [ ] **Step 3: Commit**

```bash
git add apps/content-agent/.env.example docs/superpowers/plans/2026-08-02-prerequisites-checklist.md
git commit -m "docs: Faz 1a ön koşul checklist'i ve env örneği"
```

---

### Task 2: Proje iskeleti

**Files:**
- Create: `apps/content-agent/package.json`
- Create: `apps/content-agent/tsconfig.json`
- Create: `apps/content-agent/next.config.js`
- Create: `apps/content-agent/vitest.config.ts`

**Interfaces:**
- Produces: `@/*` path alias → `apps/content-agent/src/*`; `npm test`, `npm run dev`, `npm run build` komutları

- [ ] **Step 1: package.json oluştur**

```json
{
  "name": "faydalab-content-agent",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0",
    "@anthropic-ai/sdk": "^0.32.0",
    "openai": "^4.70.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "prisma": "^6.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json oluştur**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.js oluştur**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

- [ ] **Step 4: vitest.config.ts oluştur**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Bağımlılıkları kur ve doğrula**

Run: `cd apps/content-agent && npm install`
Expected: `node_modules` oluşur, hata yok

- [ ] **Step 6: Commit**

```bash
git add apps/content-agent/package.json apps/content-agent/tsconfig.json apps/content-agent/next.config.js apps/content-agent/vitest.config.ts apps/content-agent/package-lock.json
git commit -m "chore: content-agent proje iskeletini kur"
```

---

### Task 3: Prisma şeması ve veritabanı bağlantısı

**Files:**
- Create: `apps/content-agent/prisma/schema.prisma`
- Create: `apps/content-agent/src/lib/db.ts`

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton) `@/lib/db`; `ContentItem`, `IntegrationToken`, `ContentPillar`, `ContentFormat`, `ContentStatus` Prisma tipleri

- [ ] **Step 1: schema.prisma oluştur**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ContentPillar {
  AI_AUTOMATION
  WEB_QR_CASE_STUDY
}

enum ContentFormat {
  STATIC
}

enum ContentStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  SCHEDULED
  PUBLISHED
  GENERATION_FAILED
  PUBLISH_FAILED
}

model ContentItem {
  id                String        @id @default(cuid())
  pillar            ContentPillar
  format            ContentFormat @default(STATIC)
  topic             String
  caption           String
  hashtags          String[]
  imageUrl          String?
  status            ContentStatus @default(DRAFT)
  telegramChatId    String?
  telegramMessageId String?
  scheduledFor      DateTime?
  publishedAt       DateTime?
  instagramMediaId  String?
  rejectionNote     String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([pillar, createdAt])
  @@index([status, scheduledFor])
}

model IntegrationToken {
  id          String   @id @default(cuid())
  provider    String   @unique
  accessToken String
  expiresAt   DateTime
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Prisma client singleton yaz**

`apps/content-agent/src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 3: Prisma client'ı üret ve doğrula**

Run: `cd apps/content-agent && npx prisma generate`
Expected: "Generated Prisma Client" mesajı, hata yok

- [ ] **Step 4: (DATABASE_URL tanımlıysa) migration'ı uygula**

Run: `cd apps/content-agent && npx prisma migrate dev --name init`
Expected: `ContentItem` ve `IntegrationToken` tabloları Neon'da oluşur. `DATABASE_URL` henüz yoksa bu adım atlanır, Task 15'te tamamlanır.

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/prisma apps/content-agent/src/lib/db.ts
git commit -m "feat: ContentItem ve IntegrationToken Prisma şeması"
```

---

### Task 4: İçerik sütunu rotasyon mantığı

**Files:**
- Create: `apps/content-agent/src/lib/content-pillars.ts`
- Test: `apps/content-agent/src/lib/content-pillars.test.ts`

**Interfaces:**
- Consumes: Hiçbir önceki task'a bağımlı değil (sadece Prisma tipleri, Task 3'ten)
- Produces: `getNextPillar(db: PillarStore): Promise<ContentPillar>`, `getRecentTopics(db: PillarStore, pillar: ContentPillar, limit?: number): Promise<string[]>`, `PillarStore` tipi — Task 8 bu fonksiyonları kullanacak

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/lib/content-pillars.test.ts`:

```typescript
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
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/content-pillars.test.ts`
Expected: FAIL — `content-pillars` modülü bulunamadı

- [ ] **Step 3: Implementasyonu yaz**

`apps/content-agent/src/lib/content-pillars.ts`:

```typescript
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
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/content-pillars.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/content-pillars.ts apps/content-agent/src/lib/content-pillars.test.ts
git commit -m "feat: içerik sütunu rotasyon mantığı"
```

---

### Task 5: Claude ile caption/hashtag üretimi

**Files:**
- Create: `apps/content-agent/src/lib/style-guide.ts`
- Create: `apps/content-agent/src/lib/claude.ts`
- Test: `apps/content-agent/src/lib/claude.test.ts`

**Interfaces:**
- Consumes: `PillarLabel` (= `ContentPillar` Prisma tipi, Task 3)
- Produces: `generateCaption(pillar, recentTopics): Promise<GeneratedCaption>`, `GeneratedCaption` tipi `{ topic, caption, hashtags, imagePrompt }` — Task 8 bunu kullanacak

- [ ] **Step 1: style-guide.ts oluştur**

`apps/content-agent/src/lib/style-guide.ts`:

```typescript
export const STYLE_GUIDE = `Görsel ve metin üretiminde şu stil kurallarına uy: sakin ve güven veren bir renk paleti (koyu lacivert, beyaz, tek vurgu rengi olarak turkuaz), bol boşluklu minimal kompozisyon, abartısız profesyonel bir ton. Emoji kullanımı ölçülü olsun. Vaat edilemeyecek sonuçlar asla vaat edilmesin.`
```

- [ ] **Step 2: Başarısız testi yaz**

`apps/content-agent/src/lib/claude.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

import { generateCaption } from './claude'

describe('generateCaption', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('Claude yanıtını parse edip GeneratedCaption döner', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            topic: 'AI ile fatura otomasyonu',
            caption: 'Örnek caption metni',
            hashtags: ['yapayzeka', 'otomasyon'],
            imagePrompt: 'minimal dashboard illustration',
          }),
        },
      ],
    })

    const result = await generateCaption('AI_AUTOMATION', ['önceki konu'])

    expect(result.topic).toBe('AI ile fatura otomasyonu')
    expect(result.hashtags).toEqual(['yapayzeka', 'otomasyon'])
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' })
    )
  })

  it('metin bloğu yoksa hata fırlatır', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(generateCaption('AI_AUTOMATION', [])).rejects.toThrow(
      'Claude yanıtında metin bloğu bulunamadı'
    )
  })
})
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/claude.test.ts`
Expected: FAIL — `claude` modülü bulunamadı

- [ ] **Step 4: Implementasyonu yaz**

`apps/content-agent/src/lib/claude.ts`:

```typescript
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
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/claude.test.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add apps/content-agent/src/lib/style-guide.ts apps/content-agent/src/lib/claude.ts apps/content-agent/src/lib/claude.test.ts
git commit -m "feat: Claude ile caption/hashtag üretimi"
```

---

### Task 6: OpenAI ile görsel üretimi

**Files:**
- Create: `apps/content-agent/src/lib/image-gen.ts`
- Test: `apps/content-agent/src/lib/image-gen.test.ts`

**Interfaces:**
- Consumes: `GeneratedCaption.imagePrompt` (Task 5)
- Produces: `generateImage(prompt: string): Promise<string>` — Task 8 bunu kullanacak

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/lib/image-gen.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerate = vi.fn()

vi.mock('openai', () => ({
  default: class MockOpenAI {
    images = { generate: mockGenerate }
  },
}))

import { generateImage } from './image-gen'

describe('generateImage', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
  })

  it('OpenAI yanıtından görsel URL döner', async () => {
    mockGenerate.mockResolvedValue({ data: [{ url: 'https://example.com/image.png' }] })

    const result = await generateImage('minimal dashboard illustration')

    expect(result).toBe('https://example.com/image.png')
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-1', prompt: 'minimal dashboard illustration' })
    )
  })

  it('URL dönmezse hata fırlatır', async () => {
    mockGenerate.mockResolvedValue({ data: [{}] })

    await expect(generateImage('prompt')).rejects.toThrow('Görsel üretiminden URL dönmedi')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/image-gen.test.ts`
Expected: FAIL — `image-gen` modülü bulunamadı

- [ ] **Step 3: Implementasyonu yaz**

`apps/content-agent/src/lib/image-gen.ts`:

```typescript
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
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/image-gen.test.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/image-gen.ts apps/content-agent/src/lib/image-gen.test.ts
git commit -m "feat: OpenAI ile görsel üretimi"
```

---

### Task 7: Telegram Bot API client'ı

**Files:**
- Create: `apps/content-agent/src/lib/telegram.ts`
- Test: `apps/content-agent/src/lib/telegram.test.ts`

**Interfaces:**
- Consumes: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` ortam değişkenleri
- Produces: `sendContentPreview(contentItemId, imageUrl, caption): Promise<{chatId, messageId}>`, `answerCallbackQuery(callbackQueryId, text): Promise<void>`, `sendAlert(message): Promise<void>` — Task 8, 9, 11, 12 bunları kullanacak

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/lib/telegram.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendContentPreview, answerCallbackQuery, sendAlert } from './telegram'

describe('telegram', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { chat: { id: 12345 }, message_id: 999 } }),
        text: async () => '',
      })
    )
  })

  it('sendContentPreview onay/red butonlarıyla fotoğraf gönderir', async () => {
    const result = await sendContentPreview('content-1', 'https://example.com/img.png', 'Caption')

    expect(result).toEqual({ chatId: '12345', messageId: '999' })
    const [url, options] = (fetch as any).mock.calls[0]
    expect(url).toContain('/sendPhoto')
    const body = JSON.parse(options.body)
    expect(body.reply_markup.inline_keyboard[0][0].callback_data).toBe('approve:content-1')
    expect(body.reply_markup.inline_keyboard[0][1].callback_data).toBe('reject:content-1')
  })

  it('sendContentPreview API hatasında hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    )

    await expect(sendContentPreview('content-1', 'url', 'caption')).rejects.toThrow(
      'Telegram sendPhoto başarısız'
    )
  })

  it('answerCallbackQuery doğru endpointi çağırır', async () => {
    await answerCallbackQuery('cb-1', 'Onaylandı')

    const [url] = (fetch as any).mock.calls[0]
    expect(url).toContain('/answerCallbackQuery')
  })

  it('sendAlert TELEGRAM_CHAT_ID yoksa sessizce çıkar', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await sendAlert('test uyarı')
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/telegram.test.ts`
Expected: FAIL — `telegram` modülü bulunamadı

- [ ] **Step 3: Implementasyonu yaz**

`apps/content-agent/src/lib/telegram.ts`:

```typescript
function apiBase(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

export type TelegramSendResult = {
  chatId: string
  messageId: string
}

export async function sendContentPreview(
  contentItemId: string,
  imageUrl: string,
  caption: string
): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID ortam değişkeni tanımlı değil')
  }

  const response = await fetch(`${apiBase()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
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
    throw new Error(`Telegram sendPhoto başarısız: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return { chatId: String(data.result.chat.id), messageId: String(data.result.message_id) }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await fetch(`${apiBase()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function sendAlert(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return

  await fetch(`${apiBase()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  })
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/telegram.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/telegram.ts apps/content-agent/src/lib/telegram.test.ts
git commit -m "feat: Telegram Bot API client'ı"
```

---

### Task 8: `withRetry` yardımcı fonksiyonu ve `/api/generate` üretim orkestrasyonu

**Files:**
- Create: `apps/content-agent/src/lib/with-retry.ts`
- Create: `apps/content-agent/src/app/api/generate/route.ts`
- Test: `apps/content-agent/src/lib/with-retry.test.ts`
- Test: `apps/content-agent/src/app/api/generate/route.test.ts`

**Interfaces:**
- Consumes: `getNextPillar`, `getRecentTopics` (Task 4), `generateCaption` (Task 5), `generateImage` (Task 6), `sendContentPreview`, `sendAlert` (Task 7), `prisma` (Task 3)
- Produces: `POST /api/generate` — n8n'in günlük tetikleyicisi tarafından çağrılır, `INTERNAL_API_SECRET` ile korunur, üretilen `ContentItem.id` döner

- [ ] **Step 1: withRetry için başarısız testi yaz**

`apps/content-agent/src/lib/with-retry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './with-retry'

describe('withRetry', () => {
  it('ilk denemede başarılı olursa tekrar denemez', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ilk deneme başarısız olursa bir kez tekrar dener', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ikinci deneme de başarısız olursa hatayı fırlatır', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('kalıcı hata'))
    await expect(withRetry(fn)).rejects.toThrow('kalıcı hata')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/with-retry.test.ts`
Expected: FAIL — `with-retry` modülü bulunamadı

- [ ] **Step 3: withRetry implementasyonunu yaz**

`apps/content-agent/src/lib/with-retry.ts`:

```typescript
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/with-retry.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: /api/generate route için başarısız testi yaz**

`apps/content-agent/src/app/api/generate/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getNextPillar: vi.fn(),
  getRecentTopics: vi.fn(),
  generateCaption: vi.fn(),
  generateImage: vi.fn(),
  sendContentPreview: vi.fn(),
  sendAlert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/content-pillars', () => ({
  getNextPillar: mocks.getNextPillar,
  getRecentTopics: mocks.getRecentTopics,
}))
vi.mock('@/lib/claude', () => ({ generateCaption: mocks.generateCaption }))
vi.mock('@/lib/image-gen', () => ({ generateImage: mocks.generateImage }))
vi.mock('@/lib/telegram', () => ({
  sendContentPreview: mocks.sendContentPreview,
  sendAlert: mocks.sendAlert,
}))
vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { create: mocks.create, update: mocks.update } },
}))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/generate', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mocks.getNextPillar.mockResolvedValue('AI_AUTOMATION')
    mocks.getRecentTopics.mockResolvedValue([])
    mocks.generateCaption.mockResolvedValue({
      topic: 'Konu',
      caption: 'Caption',
      hashtags: ['ai'],
      imagePrompt: 'prompt',
    })
    mocks.generateImage.mockResolvedValue('https://example.com/img.png')
    mocks.create.mockResolvedValue({ id: 'content-1' })
    mocks.sendContentPreview.mockResolvedValue({ chatId: '1', messageId: '2' })
    mocks.update.mockResolvedValue({})
  })

  it('yetkisiz istekte 401 döner', async () => {
    const request = new Request('http://localhost/api/generate', { method: 'POST' })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('başarılı akışta içerik üretir ve Telegram\'a gönderir', async () => {
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ id: 'content-1', status: 'PENDING_APPROVAL' })
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_APPROVAL', pillar: 'AI_AUTOMATION' }),
      })
    )
    expect(mocks.sendContentPreview).toHaveBeenCalled()
  })

  it('caption üretimi iki denemede de başarısız olursa 500 döner ve uyarı gönderir', async () => {
    mocks.generateCaption.mockRejectedValue(new Error('claude hatası'))

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('claude hatası'))
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/generate/route.test.ts`
Expected: FAIL — `./route` modülü bulunamadı

- [ ] **Step 7: Route implementasyonunu yaz**

`apps/content-agent/src/app/api/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getNextPillar, getRecentTopics } from '@/lib/content-pillars'
import { generateCaption } from '@/lib/claude'
import { generateImage } from '@/lib/image-gen'
import { sendContentPreview, sendAlert } from '@/lib/telegram'
import { withRetry } from '@/lib/with-retry'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const pillar = await getNextPillar(prisma)
  const recentTopics = await getRecentTopics(prisma, pillar)

  let generated
  try {
    generated = await withRetry(() => generateCaption(pillar, recentTopics))
  } catch (error) {
    await sendAlert(`İçerik metni üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'caption_generation_failed' }, { status: 500 })
  }

  let imageUrl: string
  try {
    imageUrl = await withRetry(() => generateImage(generated.imagePrompt))
  } catch (error) {
    await sendAlert(`Görsel üretimi başarısız oldu: ${(error as Error).message}`)
    return NextResponse.json({ error: 'image_generation_failed' }, { status: 500 })
  }

  const contentItem = await prisma.contentItem.create({
    data: {
      pillar,
      format: 'STATIC',
      topic: generated.topic,
      caption: generated.caption,
      hashtags: generated.hashtags,
      imageUrl,
      status: 'PENDING_APPROVAL',
    },
  })

  const fullCaption = `${generated.caption}\n\n${generated.hashtags.map((h: string) => `#${h}`).join(' ')}`

  try {
    const { chatId, messageId } = await sendContentPreview(contentItem.id, imageUrl, fullCaption)
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { telegramChatId: chatId, telegramMessageId: messageId },
    })
  } catch {
    await prisma.contentItem.update({
      where: { id: contentItem.id },
      data: { status: 'GENERATION_FAILED' },
    })
    return NextResponse.json({ error: 'telegram_send_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: contentItem.id, status: 'PENDING_APPROVAL' })
}
```

- [ ] **Step 8: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/generate/route.test.ts`
Expected: PASS (3 test)

- [ ] **Step 9: Commit**

```bash
git add apps/content-agent/src/lib/with-retry.ts apps/content-agent/src/lib/with-retry.test.ts apps/content-agent/src/app/api/generate
git commit -m "feat: içerik üretim orkestrasyonu (/api/generate)"
```

---

### Task 9: Telegram webhook — onay/red callback handler

**Files:**
- Create: `apps/content-agent/src/app/api/telegram/webhook/route.ts`
- Test: `apps/content-agent/src/app/api/telegram/webhook/route.test.ts`

**Interfaces:**
- Consumes: `answerCallbackQuery` (Task 7), `prisma` (Task 3)
- Produces: `POST /api/telegram/webhook?secret=...` — Telegram tarafından çağrılır; `ContentItem.status`'u `APPROVED`/`REJECTED` yapar

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/app/api/telegram/webhook/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  answerCallbackQuery: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { contentItem: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/telegram', () => ({ answerCallbackQuery: mocks.answerCallbackQuery }))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/telegram/webhook?secret=test-secret', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    mocks.findUnique.mockResolvedValue({ id: 'content-1' })
    mocks.update.mockResolvedValue({})
  })

  it('yanlış secret ile 401 döner', async () => {
    const request = new Request('http://localhost/api/telegram/webhook?secret=wrong', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('approve callback\'inde ContentItem APPROVED olur ve scheduledFor set edilir', async () => {
    const response = await POST(
      makeRequest({ callback_query: { id: 'cb-1', data: 'approve:content-1' } })
    )

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    )
    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-1', expect.any(String))
  })

  it('reject callback\'inde ContentItem REJECTED olur', async () => {
    await POST(makeRequest({ callback_query: { id: 'cb-2', data: 'reject:content-1' } }))

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    )
  })

  it('geçersiz payload\'da hata fırlatmadan 200 döner', async () => {
    const response = await POST(makeRequest({ not_a_callback: true }))
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/telegram/webhook/route.test.ts`
Expected: FAIL — `./route` modülü bulunamadı

- [ ] **Step 3: Route implementasyonunu yaz**

`apps/content-agent/src/app/api/telegram/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { answerCallbackQuery } from '@/lib/telegram'

const callbackSchema = z.object({
  callback_query: z.object({
    id: z.string(),
    data: z.string(),
  }),
})

function nextScheduleSlot(): Date {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(10, 0, 0, 0)
  return next
}

export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = callbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }

  const { id: callbackQueryId, data } = parsed.data.callback_query
  const [action, contentItemId] = data.split(':')

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: true })
  }

  const contentItem = await prisma.contentItem.findUnique({ where: { id: contentItemId } })
  if (!contentItem) {
    await answerCallbackQuery(callbackQueryId, 'İçerik bulunamadı')
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve') {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'APPROVED', scheduledFor: nextScheduleSlot() },
    })
    await answerCallbackQuery(callbackQueryId, 'Onaylandı, yayın kuyruğuna eklendi')
  } else {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: 'REJECTED' },
    })
    await answerCallbackQuery(callbackQueryId, 'Reddedildi')
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/telegram/webhook/route.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/app/api/telegram
git commit -m "feat: Telegram onay/red webhook handler"
```

---

### Task 10: Instagram Graph API client'ı

**Files:**
- Create: `apps/content-agent/src/lib/instagram.ts`
- Test: `apps/content-agent/src/lib/instagram.test.ts`

**Interfaces:**
- Consumes: `PUBLISH_MODE` ortam değişkeni
- Produces: `publishImage(accessToken, igUserId, imageUrl, caption): Promise<{mediaId}>`, `refreshLongLivedToken(currentToken): Promise<{accessToken, expiresInSeconds}>` — Task 11, 12 bunları kullanacak

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/lib/instagram.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishImage, refreshLongLivedToken } from './instagram'

describe('publishImage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUBLISH_MODE draft ise gerçek API çağrısı yapmadan sahte mediaId döner', async () => {
    process.env.PUBLISH_MODE = 'draft'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toContain('draft-mode-')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('PUBLISH_MODE live ise media oluşturur ve yayınlar', async () => {
    process.env.PUBLISH_MODE = 'live'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'creation-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')

    expect(result.mediaId).toBe('media-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('PUBLISH_MODE live ve media oluşturma başarısız olursa hata fırlatır', async () => {
    process.env.PUBLISH_MODE = 'live'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, text: async () => 'bad request' })
    )

    await expect(
      publishImage('token', 'user-1', 'https://example.com/img.png', 'caption')
    ).rejects.toThrow('Instagram media oluşturma başarısız')
  })
})

describe('refreshLongLivedToken', () => {
  it('yeni access token ve süresini döner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 5184000 }),
      })
    )

    const result = await refreshLongLivedToken('old-token')

    expect(result).toEqual({ accessToken: 'new-token', expiresInSeconds: 5184000 })
  })

  it('API hatasında hata fırlatır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'error' }))

    await expect(refreshLongLivedToken('old-token')).rejects.toThrow('Token yenileme başarısız')
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/instagram.test.ts`
Expected: FAIL — `instagram` modülü bulunamadı

- [ ] **Step 3: Implementasyonu yaz**

`apps/content-agent/src/lib/instagram.ts`:

```typescript
const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0'

export type PublishResult = {
  mediaId: string
}

export async function publishImage(
  accessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
): Promise<PublishResult> {
  if (process.env.PUBLISH_MODE !== 'live') {
    return { mediaId: `draft-mode-${Date.now()}` }
  }

  const createResponse = await fetch(
    `${GRAPH_API_BASE}/${igUserId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption }),
    }
  )

  if (!createResponse.ok) {
    throw new Error(`Instagram media oluşturma başarısız: ${await createResponse.text()}`)
  }

  const { id: creationId } = await createResponse.json()

  const publishResponse = await fetch(
    `${GRAPH_API_BASE}/${igUserId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId }),
    }
  )

  if (!publishResponse.ok) {
    throw new Error(`Instagram yayınlama başarısız: ${await publishResponse.text()}`)
  }

  const { id: mediaId } = await publishResponse.json()
  return { mediaId }
}

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  )

  if (!response.ok) {
    throw new Error(`Token yenileme başarısız: ${await response.text()}`)
  }

  const data = await response.json()
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/lib/instagram.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/lib/instagram.ts apps/content-agent/src/lib/instagram.test.ts
git commit -m "feat: Instagram Graph API client'ı (draft/live mod, token yenileme)"
```

---

### Task 11: `/api/publish` — zamanlanmış yayın endpoint'i

**Files:**
- Create: `apps/content-agent/src/app/api/publish/route.ts`
- Test: `apps/content-agent/src/app/api/publish/route.test.ts`

**Interfaces:**
- Consumes: `publishImage` (Task 10), `sendAlert` (Task 7), `prisma` (Task 3)
- Produces: `POST /api/publish` — n8n'in zamanlanmış cron tetikleyicisi tarafından çağrılır

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/app/api/publish/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  publishImage: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contentItem: { findMany: mocks.findMany, update: mocks.update },
    integrationToken: { findUnique: mocks.findUnique },
  },
}))
vi.mock('@/lib/instagram', () => ({ publishImage: mocks.publishImage }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/publish', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/publish', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
    process.env.INSTAGRAM_USER_ID = 'ig-user-1'
    mocks.findUnique.mockResolvedValue({ accessToken: 'token' })
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(new Request('http://localhost/api/publish', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('zamanı gelen onaylı içerikleri yayınlar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: ['a'], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockResolvedValue({ mediaId: 'media-1' })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(1)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'content-1' },
        data: expect.objectContaining({ status: 'PUBLISHED', instagramMediaId: 'media-1' }),
      })
    )
  })

  it('yayın başarısız olursa PUBLISH_FAILED işaretler ve uyarı gönderir', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])
    mocks.publishImage.mockRejectedValue(new Error('graph api hatası'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.results[0]).toEqual({ id: 'content-1', status: 'failed' })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PUBLISH_FAILED' } })
    )
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('graph api hatası'))
  })

  it('token bulunamazsa uyarı gönderip döngüyü durdurur', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([
      { id: 'content-1', caption: 'C', hashtags: [], imageUrl: 'https://x/img.png' },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.processed).toBe(0)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('token bulunamadı'))
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/publish/route.test.ts`
Expected: FAIL — `./route` modülü bulunamadı

- [ ] **Step 3: Route implementasyonunu yaz**

`apps/content-agent/src/app/api/publish/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publishImage } from '@/lib/instagram'
import { sendAlert } from '@/lib/telegram'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dueItems = await prisma.contentItem.findMany({
    where: { status: 'APPROVED', scheduledFor: { lte: now } },
  })

  const results: { id: string; status: 'published' | 'failed' }[] = []

  for (const item of dueItems) {
    const token = await prisma.integrationToken.findUnique({ where: { provider: 'instagram' } })
    if (!token) {
      await sendAlert('Instagram token bulunamadı, yayın yapılamıyor')
      break
    }

    try {
      const fullCaption = `${item.caption}\n\n${item.hashtags.map((h: string) => `#${h}`).join(' ')}`
      const { mediaId } = await publishImage(
        token.accessToken,
        process.env.INSTAGRAM_USER_ID!,
        item.imageUrl!,
        fullCaption
      )
      await prisma.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), instagramMediaId: mediaId },
      })
      results.push({ id: item.id, status: 'published' })
    } catch (error) {
      await prisma.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISH_FAILED' },
      })
      await sendAlert(`Yayın başarısız (${item.id}): ${(error as Error).message}`)
      results.push({ id: item.id, status: 'failed' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/publish/route.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add apps/content-agent/src/app/api/publish
git commit -m "feat: zamanlanmış yayın endpoint'i (/api/publish)"
```

---

### Task 12: `/api/token/refresh` — haftalık token yenileme endpoint'i

**Files:**
- Create: `apps/content-agent/src/app/api/token/refresh/route.ts`
- Test: `apps/content-agent/src/app/api/token/refresh/route.test.ts`

**Interfaces:**
- Consumes: `refreshLongLivedToken` (Task 10), `sendAlert` (Task 7), `prisma` (Task 3)
- Produces: `POST /api/token/refresh` — n8n'in haftalık cron tetikleyicisi tarafından çağrılır

- [ ] **Step 1: Başarısız testi yaz**

`apps/content-agent/src/app/api/token/refresh/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  refreshLongLivedToken: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { integrationToken: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/instagram', () => ({ refreshLongLivedToken: mocks.refreshLongLivedToken }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(): Request {
  return new Request('http://localhost/api/token/refresh', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  })
}

describe('POST /api/token/refresh', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
    process.env.INTERNAL_API_SECRET = 'test-secret'
  })

  it('yetkisiz istekte 401 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/token/refresh', { method: 'POST' })
    )
    expect(response.status).toBe(401)
  })

  it('kayıtlı token yoksa 404 döner ve uyarı gönderir', async () => {
    mocks.findUnique.mockResolvedValue(null)

    const response = await POST(makeRequest())

    expect(response.status).toBe(404)
    expect(mocks.sendAlert).toHaveBeenCalled()
  })

  it('başarılı yenilemede token günceller', async () => {
    mocks.findUnique.mockResolvedValue({ accessToken: 'old-token' })
    mocks.refreshLongLivedToken.mockResolvedValue({
      accessToken: 'new-token',
      expiresInSeconds: 5184000,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'instagram' },
        data: expect.objectContaining({ accessToken: 'new-token' }),
      })
    )
  })

  it('yenileme başarısız olursa ACİL uyarı gönderir', async () => {
    mocks.findUnique.mockResolvedValue({ accessToken: 'old-token' })
    mocks.refreshLongLivedToken.mockRejectedValue(new Error('refresh hatası'))

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('ACİL'))
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/token/refresh/route.test.ts`
Expected: FAIL — `./route` modülü bulunamadı

- [ ] **Step 3: Route implementasyonunu yaz**

`apps/content-agent/src/app/api/token/refresh/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { refreshLongLivedToken } from '@/lib/instagram'
import { sendAlert } from '@/lib/telegram'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = await prisma.integrationToken.findUnique({ where: { provider: 'instagram' } })
  if (!token) {
    await sendAlert('Token yenileme atlandı: kayıtlı Instagram token yok')
    return NextResponse.json({ error: 'no_token' }, { status: 404 })
  }

  try {
    const { accessToken, expiresInSeconds } = await refreshLongLivedToken(token.accessToken)
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

    await prisma.integrationToken.update({
      where: { provider: 'instagram' },
      data: { accessToken, expiresAt },
    })

    return NextResponse.json({ ok: true, expiresAt })
  } catch (error) {
    await sendAlert(
      `Instagram token yenileme başarısız oldu, ACİL müdahale gerekiyor: ${(error as Error).message}`
    )
    return NextResponse.json({ error: 'refresh_failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `cd apps/content-agent && npx vitest run src/app/api/token/refresh/route.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Tüm test paketini çalıştır**

Run: `cd apps/content-agent && npm test`
Expected: PASS — tüm testler (content-pillars, claude, image-gen, telegram, with-retry, generate, webhook, publish, token/refresh) yeşil

- [ ] **Step 6: Commit**

```bash
git add apps/content-agent/src/app/api/token
git commit -m "feat: haftalık token yenileme endpoint'i (/api/token/refresh)"
```

---

### Task 13: Gizlilik politikası sayfası, README ve Vercel deploy hazırlığı

**Files:**
- Create: `apps/content-agent/src/app/privacy/page.tsx`
- Create: `apps/content-agent/README.md`
- Create: `apps/content-agent/.gitignore`

**Interfaces:**
- Produces: Deploy edilebilir, dokümante edilmiş bir Vercel projesi; Meta App Review için `/privacy` sayfası

- [ ] **Step 1: .gitignore oluştur**

```
node_modules/
.next/
.env
.env.local
```

- [ ] **Step 2: Meta App Review için minimal gizlilik politikası sayfası oluştur**

`apps/content-agent/src/app/privacy/page.tsx`:

```tsx
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>FaydaLab — Gizlilik Politikası</h1>
      <p>
        FaydaLab Content Agent, FaydaLab'ın Instagram hesabı için içerik üretimi ve
        yayınlama amacıyla Instagram Graph API'yi kullanır. Bu sistem yalnızca FaydaLab'ın
        kendi Instagram Business hesabına erişir; üçüncü taraf kullanıcı verisi
        toplanmaz veya paylaşılmaz.
      </p>
      <h2>İletişim</h2>
      <p>Sorularınız için: atlasmuratk@gmail.com</p>
    </main>
  )
}
```

Bu sayfa, Meta App Review başvurusunda istenen canlı gizlilik politikası URL'si olarak kullanılır (`https://<vercel-domain>/privacy`) — Task 1'deki ön koşul checklist'inin karşılığıdır.

- [ ] **Step 3: README.md yaz**

```markdown
# FaydaLab Content Agent

FaydaLab Faz 1a — Instagram statik içerik üretim, onay ve yayın hattı. Tasarım: [../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md](../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md)

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyala, değerleri doldur (bkz. [prerequisites checklist](../../docs/superpowers/plans/2026-08-02-prerequisites-checklist.md))
2. `npm install`
3. `npm run db:generate && npm run db:migrate`
4. `npm run dev`

## Endpoint'ler

| Endpoint | Tetikleyici | Amaç |
|---|---|---|
| `POST /api/generate` | n8n günlük tetikleyici | Yeni içerik üretir, Telegram'a önizleme gönderir |
| `POST /api/telegram/webhook?secret=...` | Telegram | Onay/red callback'lerini işler |
| `POST /api/publish` | n8n zamanlanmış cron | Onaylı ve zamanı gelen içeriği yayınlar |
| `POST /api/token/refresh` | n8n haftalık cron | Instagram access token'ını yeniler |

Tüm iç endpoint'ler (`/api/generate`, `/api/publish`, `/api/token/refresh`) `Authorization: Bearer $INTERNAL_API_SECRET` header'ı gerektirir.

## Vercel Deploy

Vercel projesinde Root Directory `apps/content-agent` olarak ayarlanmalı. `.env.example`'daki tüm değişkenler Vercel Environment Variables'a eklenmeli.

## Test

`npm test` — tüm birim ve route testlerini çalıştırır (dış servisler mock'lanır, gerçek API çağrısı yapılmaz).
```

- [ ] **Step 4: Commit**

```bash
git add apps/content-agent/src/app/privacy apps/content-agent/README.md apps/content-agent/.gitignore
git commit -m "feat: gizlilik politikası sayfası; docs: README ve Vercel deploy notları"
```

---

### Task 14: n8n workflow kurulum rehberi

Bu görev n8n Cloud'da (kod dışı, görsel arayüzde) kurulacak üç workflow'u adım adım belgeler. n8n workflow'ları bu repoda kod olarak yaşamaz; rehber, kurulumu tekrarlanabilir kılar.

**Files:**
- Create: `apps/content-agent/docs/n8n-workflows.md`

**Interfaces:**
- Consumes: Task 8/11/12'de tanımlanan `/api/generate`, `/api/publish`, `/api/token/refresh` endpoint'leri

- [ ] **Step 1: Rehberi yaz**

`apps/content-agent/docs/n8n-workflows.md`:

```markdown
# n8n Cloud Workflow Kurulumu

Üç ayrı workflow kurulacak. Her birinde bir **Schedule Trigger** node'u ve bir **HTTP Request** node'u var; HTTP Request node'unda `Authorization: Bearer {{ $env.INTERNAL_API_SECRET }}` header'ı ayarlanmalı (n8n Cloud'un Environment Variables/Credentials bölümünden `INTERNAL_API_SECRET` tanımlanmalı).

## Workflow 1 — Günlük İçerik Üretimi

- **Trigger:** Schedule — her gün 09:00 (Europe/Istanbul)
- **Node:** HTTP Request → `POST https://<vercel-domain>/api/generate`
- **Amaç:** Haftada 5 statik post hedefine ulaşmak için hafta içi her gün bir içerik üretir (hafta sonları devre dışı bırakılabilir — Schedule node'da gün filtresi kullanılır)

## Workflow 2 — Zamanlanmış Yayın

- **Trigger:** Schedule — her saat başı
- **Node:** HTTP Request → `POST https://<vercel-domain>/api/publish`
- **Amaç:** Zamanı gelen (`scheduledFor <= now`) onaylı içerikleri yayınlar. Saatlik çalışması, onaydan sonra makul bir gecikmeyle yayının gerçekleşmesini sağlar.

## Workflow 3 — Haftalık Token Yenileme

- **Trigger:** Schedule — her Pazartesi 08:00 (Europe/Istanbul)
- **Node:** HTTP Request → `POST https://<vercel-domain>/api/token/refresh`
- **Amaç:** Instagram token'ının ~60 günlük ömrü dolmadan düzenli yenilenmesini sağlar. Haftalık çalışma, bir yenileme başarısız olsa bile bir sonraki haftada tekrar denenmesini garanti eder.

## Telegram Webhook Kaydı (n8n dışı, tek seferlik)

n8n'e bağlı değil — Telegram'ın kendisine, bot güncellemelerini `/api/telegram/webhook` adresine yönlendirmesini söylemek için bir kerelik şu çağrı yapılır:

\`\`\`bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://<vercel-domain>/api/telegram/webhook?secret=$TELEGRAM_WEBHOOK_SECRET"
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add apps/content-agent/docs/n8n-workflows.md
git commit -m "docs: n8n Cloud workflow kurulum rehberi"
```

---

### Task 15: Draft modda uçtan uca doğrulama

**Files:**
- Modify: `docs/10-roadmap.md` (Faz 1a durumunu güncelle)

**Interfaces:**
- Consumes: Tüm önceki task'ların canlı deploy'u

- [ ] **Step 1: Gerçek ortam değişkenlerini Vercel'e gir**

Task 1'in checklist'indeki tüm hesaplar hazırsa, `.env.example`'daki tüm değişkenleri Vercel Environment Variables'a gir. `PUBLISH_MODE=draft` olarak bırak.

- [ ] **Step 2: n8n workflow'larını kur**

`apps/content-agent/docs/n8n-workflows.md` rehberini takip ederek 3 workflow'u n8n Cloud'da kur, `<vercel-domain>` yerine gerçek deploy URL'sini kullan.

- [ ] **Step 3: Manuel tetikleme ile Workflow 1'i test et**

n8n'de Workflow 1'i manuel tetikle. Telegram'da bir önizleme mesajı (görsel + caption + Onayla/Reddet butonları) gelmeli.

- [ ] **Step 4: Onay akışını doğrula**

Telegram'da "Onayla" butonuna bas. `ContentItem.status`'un `APPROVED` olduğunu, `scheduledFor`'un set edildiğini Neon konsolundan veya `npx prisma studio` ile doğrula.

- [ ] **Step 5: Draft modda yayın akışını doğrula**

Workflow 2'yi manuel tetikle. `ContentItem.status`'un `PUBLISHED` olduğunu ve `instagramMediaId`'nin `draft-mode-` ile başladığını doğrula (gerçek Instagram'a hiçbir şey gitmemeli).

- [ ] **Step 6: 10-roadmap.md'yi güncelle**

`docs/10-roadmap.md` içinde Faz 1 satırına şu notu ekle: "Faz 1a (statik post temel hattı) draft modda doğrulandı. Spec'teki 5 kabul kriterinden 3'ü karşılandı: Telegram onay/red akışı çalışıyor, token otomatik yenileme mekanizması kuruldu, konu tekrarını önleyen dedup çalışıyor. Kalan 2 kriter (haftada 5 statik + 2 reel — reel kısmı Faz 1b'de; Meta App Review tamamlanıp PUBLISH_MODE=live'a geçilmesi) bekliyor. Sıradaki adım: Meta onayı tamamlanınca canlıya geçiş, ardından Faz 1b (reels/video)."

- [ ] **Step 7: Commit**

```bash
git add docs/10-roadmap.md
git commit -m "docs: Faz 1a draft modda doğrulandı, roadmap güncellendi"
```
