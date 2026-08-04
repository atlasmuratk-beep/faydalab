# FaydaLab Faz 2 — Kurumsal Web Sitesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FaydaLab'ın kurumsal web sitesini (`apps/website`) inşa etmek — panelden bölüm ekle/sil/sırala/gizle özellikli, tek admin hesabıyla korunan, iletişim formu Telegram bildirimi tetikleyen, 3 vaka çalışmasıyla seed edilmiş tek sayfalık bir site.

**Architecture:** Mevcut monorepo'ya sibling bir Next.js 15 (App Router) + TypeScript + Tailwind + Prisma uygulaması. Section-tabanlı içerik modeli: sayfa, veritabanındaki sıralı `Section` kayıtlarını render eder, her section'ın tipi (`HERO`/`SERVICES`/`CASE_STUDY`/`TEXT_BLOCK`/`CONTACT`) kendi React bileşenine ve Zod içerik şemasına sahiptir. Admin panel (`/admin`), gazi-usta'daki HMAC-imzalı session + bcrypt credentials deseniyle korunur.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma + Postgres (Neon), Vercel Blob, bcryptjs, Zod, Vitest.

## Global Constraints

- Tüm kullanıcıya görünen metin Türkçe; kod/tanımlayıcılar İngilizce (mevcut monorepo konvansiyonu).
- Görsel kimlik `01-brand-identity.md`'den birebir: arka plan `#0B0B0D`, ana metin `#F5F5F5`, altın vurgu `#D4AF37`, ikincil metin `#B8BDC7`, kart/ayraç `#2A2A2F`. Başlık fontu Bebas Neue, alt başlık Sora SemiBold, gövde Inter Regular.
- Admin auth: tek admin hesabı, bcrypt hash, HMAC-imzalı session cookie (gazi-usta'daki `src/lib/session.ts` deseni — yeni bir auth kütüphanesi/NextAuth eklenmez).
- API route'ları ve `lib/` fonksiyonları (Zod şemaları, session imzalama/doğrulama, reorder mantığı, iletişim formu) Vitest ile test edilir — content-agent konvansiyonu (`vi.mock` ile Prisma client'ı mock'lamak, gerçek veritabanı bağlantısı testlerde asla kullanılmaz).
- UI sayfaları/bileşenleri (admin panel ekranları, public section bileşenleri) için otomatik test yazılmaz — gazi-usta'da kurulu konvansiyon; bunun yerine bu planın son görevinde tarayıcıda manuel duman testi yapılır. Bu, yeni bir test altyapısı (React Testing Library vb.) icat etmekten kaçınmak için bilinçli bir seçim.
- `export const dynamic = 'force-dynamic'` — DB'den okunan her sayfaya eklenir (gazi-usta'da bulunan "panel değişiklikleri statik prerender yüzünden yansımıyor" hatasını baştan önlemek için).
- Section'ın `content` alanı Prisma'da `Json` tipinde tutulur; tip-bazlı şekil zorunluluğu veritabanı seviyesinde değil, uygulama katmanında Zod ile sağlanır (`src/lib/sections.ts`).
- Yeni bir markdown/rich-text kütüphanesi eklenmez (YAGNI); `TEXT_BLOCK`'un `bodyMarkdown` alanı MVP'de çift satır sonuyla ayrılmış paragraflar olarak render edilir, gerçek markdown ayrıştırma sonraya bırakılır.
- Vercel Blob upload: sadece `image/jpeg`, `image/png`, `image/webp`, `image/gif`, maksimum 8MB (gazi-usta'daki sınırla aynı).

---

### Task 1: Proje İskeleti (apps/website)

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/next.config.js`
- Create: `apps/website/tailwind.config.ts`
- Create: `apps/website/postcss.config.js`
- Create: `apps/website/vitest.config.ts`
- Create: `apps/website/.env.example`
- Create: `apps/website/.gitignore`
- Create: `apps/website/src/app/globals.css`
- Create: `apps/website/src/app/layout.tsx`
- Create: `apps/website/src/app/page.tsx` (geçici boş sayfa, Task 11'de gerçek içerikle değiştirilecek)

**Interfaces:**
- Produces: `apps/website` çalışan bir Next.js iskeleti; Tailwind renk token'ları (`brand-bg`, `brand-text`, `brand-gold`, `brand-muted`, `brand-border`) ve font değişkenleri (`--font-heading`, `--font-subheading`, `--font-body`) sonraki tüm görevler tarafından kullanılır.

- [ ] **Step 1: package.json oluştur**

```json
{
  "name": "faydalab-website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "@vercel/blob": "^2.6.1",
    "bcryptjs": "^3.0.3",
    "next": "^16.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.5.4",
    "postcss": "^8.5.25",
    "prisma": "^6.0.0",
    "tailwindcss": "^3.4.19",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
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
    "allowJs": true,
    "jsx": "react-jsx",
    "incremental": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.js oluştur**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'gazi-usta.vercel.app' },
    ],
  },
}

module.exports = nextConfig
```

- [ ] **Step 4: tailwind.config.ts oluştur**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0B0B0D',
        'brand-text': '#F5F5F5',
        'brand-gold': '#D4AF37',
        'brand-muted': '#B8BDC7',
        'brand-border': '#2A2A2F',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        subheading: ['var(--font-subheading)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: postcss.config.js oluştur**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: vitest.config.ts oluştur**

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

- [ ] **Step 7: .env.example oluştur**

```
DATABASE_URL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_SESSION_SECRET=""
BLOB_READ_WRITE_TOKEN=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

- [ ] **Step 8: .gitignore oluştur**

```
node_modules/
.next/
.env
.env.local
tsconfig.tsbuildinfo
.vercel
next-env.d.ts
.env*
```

- [ ] **Step 9: globals.css oluştur**

`apps/website/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Root layout oluştur (marka fontları)**

`apps/website/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Bebas_Neue, Sora, Inter } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-heading' })
const sora = Sora({ subsets: ['latin'], variable: '--font-subheading' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'FaydaLab',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${bebasNeue.variable} ${sora.variable} ${inter.variable}`}>
      <body className="bg-brand-bg font-body text-brand-text antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 11: Geçici ana sayfa oluştur**

`apps/website/src/app/page.tsx` (Task 11'de gerçek section render mantığıyla değiştirilecek):

```typescript
export default function HomePage() {
  return <main className="p-10">FaydaLab — yapım aşamasında.</main>
}
```

- [ ] **Step 12: Bağımlılıkları kur ve doğrula**

Run: `cd apps/website && npm install`
Expected: hatasız kurulum tamamlanır.

Run: `npm run dev` (kısa süre çalıştırıp durdur, ör. `timeout 15s npm run dev` veya manuel kontrol)
Expected: `localhost:3000`'de "FaydaLab — yapım aşamasında." metni görünür, konsol hatası yok.

Run: `npm run build`
Expected: derleme hatasız tamamlanır.

- [ ] **Step 13: Commit**

```bash
git add apps/website
git commit -m "feat(website): proje iskeleti - Next.js/Tailwind/Vitest kurulumu, marka fontları"
```

---

### Task 2: Prisma Şeması ve DB Client

**Files:**
- Create: `apps/website/prisma/schema.prisma`
- Create: `apps/website/src/lib/db.ts`

**Interfaces:**
- Consumes: yok (bağımsız temel görev).
- Produces: `prisma` (PrismaClient instance, `@/lib/db`'den export edilir), Prisma modelleri `Section` (`type: SectionType`, `order: Int`, `visible: Boolean`, `content: Json`), `SiteSettings` (singleton, `id=1`), `ContactMessage`, `AdminUser` (`username`, `passwordHash`). Sonraki tüm görevler bu modelleri ve `prisma` client'ını kullanır.

- [ ] **Step 1: schema.prisma yaz**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SectionType {
  HERO
  SERVICES
  CASE_STUDY
  TEXT_BLOCK
  CONTACT
}

model Section {
  id        String      @id @default(cuid())
  type      SectionType
  order     Int
  visible   Boolean     @default(true)
  content   Json
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([order])
}

model SiteSettings {
  id              Int      @id @default(1)
  siteTitle       String
  metaDescription String
  faviconUrl      String?
  logoUrl         String?
  instagramUrl    String?
  contactEmail    String?
  updatedAt       DateTime @updatedAt
}

model ContactMessage {
  id        String   @id @default(cuid())
  name      String
  email     String
  message   String
  createdAt DateTime @default(now())
}

model AdminUser {
  id           String @id @default(cuid())
  username     String @unique
  passwordHash String
}
```

- [ ] **Step 2: db.ts yaz**

`apps/website/src/lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 3: Prisma client'ı üret ve doğrula**

Run: `cd apps/website && npx prisma generate`
Expected: `Generated Prisma Client` mesajıyla hatasız tamamlanır (canlı veritabanı bağlantısı gerekmez, sadece şemadan tip üretir).

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add apps/website/prisma apps/website/src/lib/db.ts
git commit -m "feat(website): Prisma şeması - Section, SiteSettings, ContactMessage, AdminUser"
```

---

### Task 3: Section İçerik Zod Şemaları

**Files:**
- Create: `apps/website/src/lib/sections.ts`
- Test: `apps/website/src/lib/sections.test.ts`

**Interfaces:**
- Consumes: yok.
- Produces: `SECTION_TYPES` (readonly tuple `['HERO', 'SERVICES', 'CASE_STUDY', 'TEXT_BLOCK', 'CONTACT']`), `SectionType` tipi, `validateSectionContent(type: SectionType, content: unknown): SafeParseReturnType` fonksiyonu, tip export'ları `HeroContent`, `ServicesContent`, `CaseStudyContent`, `TextBlockContent`, `ContactContent`. Task 6 (CRUD API), Task 11 (public render) ve Task 12 (admin form) bunları tüketir.

- [ ] **Step 1: Başarısız testi yaz**

`apps/website/src/lib/sections.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateSectionContent } from './sections'

describe('validateSectionContent', () => {
  it('geçerli HERO içeriğini kabul eder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: '#iletisim',
    })
    expect(result.success).toBe(true)
  })

  it('eksik alanlı HERO içeriğini reddeder', () => {
    const result = validateSectionContent('HERO', { title: 'Başlık' })
    expect(result.success).toBe(false)
  })

  it('geçerli SERVICES içeriğini kabul eder', () => {
    const result = validateSectionContent('SERVICES', {
      title: 'Hizmetler',
      items: [{ icon: '🤖', name: 'AI', description: 'açıklama' }],
    })
    expect(result.success).toBe(true)
  })

  it('boş items listesi olan SERVICES içeriğini reddeder', () => {
    const result = validateSectionContent('SERVICES', { title: 'Hizmetler', items: [] })
    expect(result.success).toBe(false)
  })

  it('geçerli CASE_STUDY içeriğini kabul eder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'https://example.com/img.jpg',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(true)
  })

  it('geçersiz URL alanlı CASE_STUDY içeriğini reddeder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'not-a-url',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(false)
  })

  it('geçerli TEXT_BLOCK içeriğini kabul eder', () => {
    const result = validateSectionContent('TEXT_BLOCK', { title: 'Başlık', bodyMarkdown: 'metin' })
    expect(result.success).toBe(true)
  })

  it('geçerli CONTACT içeriğini kabul eder', () => {
    const result = validateSectionContent('CONTACT', { title: 'İletişim', subtitle: 'Bize ulaşın' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/lib/sections.test.ts`
Expected: FAIL — `sections.ts` modülü bulunamadı.

- [ ] **Step 3: sections.ts implementasyonu**

```typescript
import { z } from 'zod'

export const heroContentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  ctaText: z.string().min(1),
  ctaLink: z.string().min(1),
})

export const serviceItemSchema = z.object({
  icon: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
})

export const servicesContentSchema = z.object({
  title: z.string().min(1),
  items: z.array(serviceItemSchema).min(1),
})

export const caseStudyContentSchema = z.object({
  projectName: z.string().min(1),
  needText: z.string().min(1),
  solutionText: z.string().min(1),
  resultText: z.string().min(1),
  imageUrl: z.string().url(),
  liveUrl: z.string().url(),
})

export const textBlockContentSchema = z.object({
  title: z.string().min(1),
  bodyMarkdown: z.string().min(1),
})

export const contactContentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
})

export const SECTION_TYPES = ['HERO', 'SERVICES', 'CASE_STUDY', 'TEXT_BLOCK', 'CONTACT'] as const
export type SectionType = (typeof SECTION_TYPES)[number]

const contentSchemaByType = {
  HERO: heroContentSchema,
  SERVICES: servicesContentSchema,
  CASE_STUDY: caseStudyContentSchema,
  TEXT_BLOCK: textBlockContentSchema,
  CONTACT: contactContentSchema,
} as const

export function validateSectionContent(type: SectionType, content: unknown) {
  return contentSchemaByType[type].safeParse(content)
}

export type HeroContent = z.infer<typeof heroContentSchema>
export type ServicesContent = z.infer<typeof servicesContentSchema>
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>
export type TextBlockContent = z.infer<typeof textBlockContentSchema>
export type ContactContent = z.infer<typeof contactContentSchema>
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/lib/sections.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/sections.ts apps/website/src/lib/sections.test.ts
git commit -m "feat(website): section içerik Zod şemaları"
```

---

### Task 4: Admin Session ve Auth API Route'ları

**Files:**
- Create: `apps/website/src/lib/session.ts`
- Test: `apps/website/src/lib/session.test.ts`
- Create: `apps/website/src/app/api/auth/login/route.ts`
- Test: `apps/website/src/app/api/auth/login/route.test.ts`
- Create: `apps/website/src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `AdminUser` modeli.
- Produces: `SESSION_COOKIE` (cookie adı), `signSession(userId: string): string`, `verifySession(token: string | undefined | null): string | null`. Task 5 (middleware) bunları tüketir.

- [ ] **Step 1: session.ts başarısız testini yaz**

`apps/website/src/lib/session.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { signSession, verifySession } from './session'

describe('session', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('imzalanan bir token doğru şekilde doğrulanır', () => {
    const token = signSession('user-1')
    expect(verifySession(token)).toBe('user-1')
  })

  it('değiştirilmiş (tamper edilmiş) token reddedilir', () => {
    const token = signSession('user-1')
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifySession(tampered)).toBeNull()
  })

  it('boş token null döner', () => {
    expect(verifySession(undefined)).toBeNull()
    expect(verifySession(null)).toBeNull()
  })

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1')).toThrow('ADMIN_SESSION_SECRET')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/lib/session.test.ts`
Expected: FAIL — `session.ts` bulunamadı.

- [ ] **Step 3: session.ts implementasyonu**

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_admin_session'

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string): string {
  const sig = createHmac('sha256', secret()).update(userId).digest('hex')
  return `${userId}.${sig}`
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null
  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex === -1) return null
  const userId = token.slice(0, separatorIndex)
  const sig = token.slice(separatorIndex + 1)
  const expected = createHmac('sha256', secret()).update(userId).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}
```

- [ ] **Step 4: session.ts testini çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/lib/session.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: login route başarısız testini yaz**

`apps/website/src/app/api/auth/login/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { adminUser: { findUnique: mocks.findUnique } } }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.compare.mockReset()
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('eksik alanlarda 400 döner', async () => {
    const response = await POST(makeRequest({ username: 'admin' }))
    expect(response.status).toBe(400)
  })

  it('kullanıcı bulunamazsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('şifre yanlışsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', username: 'admin', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(false)
    const response = await POST(makeRequest({ username: 'admin', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('geçerli girişte 200 döner ve session cookie set eder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', username: 'admin', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(true)
    const response = await POST(makeRequest({ username: 'admin', password: 'correct' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('faydalab_admin_session=')
  })
})
```

- [ ] **Step 6: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npx vitest run src/app/api/auth/login/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 7: login route.ts implementasyonu**

`apps/website/src/app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signSession, SESSION_COOKIE } from '@/lib/session'

export async function POST(req: Request) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanıcı adı ve şifre gerekli' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { username } })
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false
  if (!user || !valid) {
    return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
```

- [ ] **Step 8: login route testini çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/auth/login/route.test.ts`
Expected: PASS (4 test).

- [ ] **Step 9: logout route.ts implementasyonu (test gerekmez — tek satırlık cookie temizleme)**

`apps/website/src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
```

- [ ] **Step 10: Tüm test paketini çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/website/src/lib/session.ts apps/website/src/lib/session.test.ts apps/website/src/app/api/auth
git commit -m "feat(website): admin session imzalama + login/logout API route'ları"
```

---

### Task 5: Middleware Route Guard + Login/Protected Sayfa İskeleti

**Files:**
- Create: `apps/website/src/middleware.ts`
- Test: `apps/website/src/middleware.test.ts`
- Create: `apps/website/src/app/admin/(public)/login/page.tsx`
- Create: `apps/website/src/app/admin/(protected)/layout.tsx`
- Create: `apps/website/src/components/admin/AdminNav.tsx`
- Create: `apps/website/src/app/admin/(protected)/page.tsx`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE` (Task 4).
- Produces: `/admin/*` altındaki tüm sayfalar ve `/api/admin/*` altındaki tüm route'lar middleware ile korunur. Task 12/13 bu korumalı layout içine kendi sayfalarını ekler.

- [ ] **Step 1: middleware başarısız testini yaz**

`apps/website/src/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  SESSION_COOKIE: 'faydalab_admin_session',
}))

import { middleware } from './middleware'
import { verifySession } from '@/lib/session'

describe('middleware', () => {
  beforeEach(() => {
    vi.mocked(verifySession).mockReset()
  })

  it('geçerli session ile /admin isteğini geçirir', () => {
    vi.mocked(verifySession).mockReturnValue('user-1')
    const req = new NextRequest('http://localhost/admin/sections')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('geçersiz session ile /admin isteğini login sayfasına yönlendirir', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/sections')
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('geçersiz session ile /api/admin isteğine 401 döner', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/api/admin/sections')
    const res = middleware(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/middleware.test.ts`
Expected: FAIL — `middleware.ts` bulunamadı.

- [ ] **Step 3: middleware.ts implementasyonu**

`apps/website/src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const userId = verifySession(token)
  if (!userId) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/((?!login).*)', '/api/admin/:path*'],
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/middleware.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Login sayfası oluştur**

`apps/website/src/app/admin/(public)/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Giriş başarısız')
      return
    }
    router.push('/admin/sections')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-brand-bg px-4">
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Yönetim Paneli Girişi</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          name="username"
          placeholder="Kullanıcı adı"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        <input
          name="password"
          type="password"
          placeholder="Şifre"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold py-3 font-subheading font-semibold text-brand-bg hover:opacity-90"
        >
          Giriş Yap
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: AdminNav bileşeni oluştur**

`apps/website/src/components/admin/AdminNav.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function AdminNav() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <nav className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-6 py-4">
      <div className="flex gap-6 font-subheading text-brand-text">
        <Link href="/admin/sections">Bölümler</Link>
        <Link href="/admin/settings">Site Ayarları</Link>
        <Link href="/admin/messages">Mesajlar</Link>
      </div>
      <button onClick={handleLogout} className="text-sm text-brand-muted underline">
        Çıkış Yap
      </button>
    </nav>
  )
}
```

- [ ] **Step 7: Korumalı layout oluştur**

`apps/website/src/app/admin/(protected)/layout.tsx`:

```typescript
import { AdminNav } from '@/components/admin/AdminNav'

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 8: /admin kök sayfası (Bölümler'e yönlendirme)**

`apps/website/src/app/admin/(protected)/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function AdminRootPage() {
  redirect('/admin/sections')
}
```

- [ ] **Step 9: Tüm test paketini çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/middleware.ts apps/website/src/middleware.test.ts apps/website/src/app/admin apps/website/src/components/admin/AdminNav.tsx
git commit -m "feat(website): middleware route guard, login sayfası, korumalı admin layout"
```

---

### Task 6: Section CRUD API Route'ları

**Files:**
- Create: `apps/website/src/app/api/admin/sections/route.ts`
- Test: `apps/website/src/app/api/admin/sections/route.test.ts`
- Create: `apps/website/src/app/api/admin/sections/[id]/route.ts`
- Test: `apps/website/src/app/api/admin/sections/[id]/route.test.ts`

**Interfaces:**
- Consumes: `prisma.section` (Task 2), `SECTION_TYPES`, `validateSectionContent` (Task 3).
- Produces: `GET /api/admin/sections` (liste), `POST /api/admin/sections` (oluştur, `{ type, content }` body, sıradaki `order` otomatik atanır), `PATCH /api/admin/sections/[id]` (`{ content? , visible? }` body), `DELETE /api/admin/sections/[id]`. Task 12 (admin UI) bu endpoint'leri tüketir.

- [ ] **Step 1: sections/route.ts başarısız testini yaz**

`apps/website/src/app/api/admin/sections/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { section: { findMany: mocks.findMany, create: mocks.create, aggregate: mocks.aggregate } },
}))

import { GET, POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/sections', () => {
  it('sıralı section listesini döner', async () => {
    mocks.findMany.mockResolvedValue([{ id: '1', order: 0 }])
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual([{ id: '1', order: 0 }])
    expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { order: 'asc' } })
  })
})

describe('POST /api/admin/sections', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.aggregate.mockReset()
  })

  it('geçersiz tip için 400 döner', async () => {
    const response = await POST(makeRequest({ type: 'INVALID', content: {} }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('geçersiz içerik için 400 döner', async () => {
    const response = await POST(makeRequest({ type: 'HERO', content: { title: 'a' } }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('geçerli veriyle section oluşturur ve sıradaki order değerini atar', async () => {
    mocks.aggregate.mockResolvedValue({ _max: { order: 2 } })
    mocks.create.mockResolvedValue({ id: 'new-1', order: 3 })
    const response = await POST(
      makeRequest({ type: 'HERO', content: { title: 't', subtitle: 's', ctaText: 'c', ctaLink: '#x' } })
    )
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 3, visible: true }) })
    )
  })

  it('hiç section yokken order 0 atanır', async () => {
    mocks.aggregate.mockResolvedValue({ _max: { order: null } })
    mocks.create.mockResolvedValue({ id: 'new-1', order: 0 })
    await POST(makeRequest({ type: 'CONTACT', content: { title: 't', subtitle: 's' } }))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }))
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/app/api/admin/sections/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 3: sections/route.ts implementasyonu**

`apps/website/src/app/api/admin/sections/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SECTION_TYPES, validateSectionContent, type SectionType } from '@/lib/sections'

export async function GET() {
  const sections = await prisma.section.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(sections)
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!SECTION_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Geçersiz section tipi' }, { status: 400 })
  }

  const type = body.type as SectionType
  const validation = validateSectionContent(type, body.content)
  if (!validation.success) {
    return NextResponse.json({ error: 'invalid_content', details: validation.error.flatten() }, { status: 400 })
  }

  const maxOrder = await prisma.section.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  const section = await prisma.section.create({
    data: { type, content: validation.data, order, visible: true },
  })
  return NextResponse.json(section, { status: 201 })
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/sections/route.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: sections/[id]/route.ts başarısız testini yaz**

`apps/website/src/app/api/admin/sections/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { section: { findUnique: mocks.findUnique, update: mocks.update, delete: mocks.delete } },
}))

import { PATCH, DELETE } from './route'

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections/sec-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/sections/[id]', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
  })

  it('içerik güncellemesinde bulunamayan section için 404 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await PATCH(makePatchRequest({ content: { title: 't' } }), { params: { id: 'sec-1' } })
    expect(response.status).toBe(404)
  })

  it('geçersiz içerik güncellemesinde 400 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', type: 'CONTACT' })
    const response = await PATCH(makePatchRequest({ content: { title: 'sadece başlık' } }), {
      params: { id: 'sec-1' },
    })
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('geçerli içerik güncellemesi kaydeder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', type: 'CONTACT' })
    mocks.update.mockResolvedValue({ id: 'sec-1' })
    const response = await PATCH(
      makePatchRequest({ content: { title: 'Başlık', subtitle: 'Alt' } }),
      { params: { id: 'sec-1' } }
    )
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sec-1' }, data: { content: { title: 'Başlık', subtitle: 'Alt' } } })
    )
  })

  it('sadece visible güncellemesi içerik doğrulaması gerektirmez', async () => {
    mocks.update.mockResolvedValue({ id: 'sec-1' })
    const response = await PATCH(makePatchRequest({ visible: false }), { params: { id: 'sec-1' } })
    expect(response.status).toBe(200)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'sec-1' }, data: { visible: false } })
  })
})

describe('DELETE /api/admin/sections/[id]', () => {
  it('section siler', async () => {
    mocks.delete.mockResolvedValue({ id: 'sec-1' })
    const response = await DELETE(new Request('http://localhost/api/admin/sections/sec-1', { method: 'DELETE' }), {
      params: { id: 'sec-1' },
    })
    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'sec-1' } })
  })
})
```

- [ ] **Step 6: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npx vitest run src/app/api/admin/sections/\[id\]/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 7: sections/[id]/route.ts implementasyonu**

`apps/website/src/app/api/admin/sections/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSectionContent, type SectionType } from '@/lib/sections'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updateData: { content?: unknown; visible?: boolean } = {}

  if (body.content !== undefined) {
    const existing = await prisma.section.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
    }
    const validation = validateSectionContent(existing.type as SectionType, body.content)
    if (!validation.success) {
      return NextResponse.json({ error: 'invalid_content', details: validation.error.flatten() }, { status: 400 })
    }
    updateData.content = validation.data
  }
  if (body.visible !== undefined) {
    updateData.visible = Boolean(body.visible)
  }

  const section = await prisma.section.update({ where: { id: params.id }, data: updateData })
  return NextResponse.json(section)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.section.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/sections/\[id\]/route.test.ts`
Expected: PASS (5 test).

- [ ] **Step 9: Tüm test paketini çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/app/api/admin/sections
git commit -m "feat(website): section CRUD API route'ları (list/create/update/delete)"
```

---

### Task 7: Section Sıralama (Reorder) API Route'u

**Files:**
- Create: `apps/website/src/app/api/admin/sections/reorder/route.ts`
- Test: `apps/website/src/app/api/admin/sections/reorder/route.test.ts`

**Interfaces:**
- Consumes: `prisma.section` (Task 2).
- Produces: `POST /api/admin/sections/reorder` (`{ id, direction: 'up' | 'down' }` body — komşu section ile `order` değerini takas eder). Task 12 (admin UI) bu endpoint'i tüketir.

- [ ] **Step 1: Başarısız testi yaz**

`apps/website/src/app/api/admin/sections/reorder/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    section: { findUnique: mocks.findUnique, findFirst: mocks.findFirst, update: mocks.update },
    $transaction: mocks.transaction,
  },
}))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/sections/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/sections/reorder', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.findFirst.mockReset()
    mocks.transaction.mockReset()
  })

  it('geçersiz yön için 400 döner', async () => {
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'sideways' }))
    expect(response.status).toBe(400)
  })

  it('bulunamayan section için 404 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'up' }))
    expect(response.status).toBe(404)
  })

  it('en üstteki section yukarı taşınmak istendiğinde komşu yoksa sessizce başarılı döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-1', order: 0 })
    mocks.findFirst.mockResolvedValue(null)
    const response = await POST(makeRequest({ id: 'sec-1', direction: 'up' }))
    expect(response.status).toBe(200)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('geçerli istekte komşu ile order değerlerini takas eder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'sec-2', order: 1 })
    mocks.findFirst.mockResolvedValue({ id: 'sec-1', order: 0 })
    mocks.transaction.mockResolvedValue([{}, {}])
    const response = await POST(makeRequest({ id: 'sec-2', direction: 'up' }))
    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/app/api/admin/sections/reorder/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 3: reorder/route.ts implementasyonu**

`apps/website/src/app/api/admin/sections/reorder/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { id, direction } = await req.json()
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'Geçersiz yön' }, { status: 400 })
  }

  const current = await prisma.section.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: 'Section bulunamadı' }, { status: 404 })
  }

  const neighbor = await prisma.section.findFirst({
    where: direction === 'up' ? { order: { lt: current.order } } : { order: { gt: current.order } },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  })
  if (!neighbor) {
    return NextResponse.json({ ok: true })
  }

  await prisma.$transaction([
    prisma.section.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.section.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/sections/reorder/route.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/api/admin/sections/reorder
git commit -m "feat(website): section sıralama (reorder) API route'u"
```

---

### Task 8: Site Ayarları ve Görsel Yükleme API Route'ları

**Files:**
- Create: `apps/website/src/app/api/admin/settings/route.ts`
- Test: `apps/website/src/app/api/admin/settings/route.test.ts`
- Create: `apps/website/src/app/api/admin/upload/route.ts`
- Test: `apps/website/src/app/api/admin/upload/route.test.ts`

**Interfaces:**
- Consumes: `prisma.siteSettings` (Task 2), `put` (`@vercel/blob`).
- Produces: `GET /api/admin/settings`, `PATCH /api/admin/settings` (upsert singleton `id=1`), `POST /api/admin/upload` (`FormData` içinde `file`, döner `{ url }`). Task 12/13 (admin UI) bu endpoint'leri tüketir.

- [ ] **Step 1: settings/route.ts başarısız testini yaz**

`apps/website/src/app/api/admin/settings/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { siteSettings: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}))

import { GET, PATCH } from './route'

describe('GET /api/admin/settings', () => {
  it('singleton ayar kaydını döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 1, siteTitle: 'FaydaLab' })
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual({ id: 1, siteTitle: 'FaydaLab' })
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})

describe('PATCH /api/admin/settings', () => {
  beforeEach(() => {
    mocks.upsert.mockReset()
  })

  it('ayarları upsert eder', async () => {
    mocks.upsert.mockResolvedValue({ id: 1, siteTitle: 'Yeni Başlık' })
    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteTitle: 'Yeni Başlık', metaDescription: 'açıklama' }),
    })
    const response = await PATCH(req)
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/app/api/admin/settings/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 3: settings/route.ts implementasyonu**

`apps/website/src/app/api/admin/settings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const data = {
    siteTitle: body.siteTitle,
    metaDescription: body.metaDescription,
    faviconUrl: body.faviconUrl || null,
    logoUrl: body.logoUrl || null,
    instagramUrl: body.instagramUrl || null,
    contactEmail: body.contactEmail || null,
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
  return NextResponse.json(settings)
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/settings/route.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: upload/route.ts başarısız testini yaz**

`apps/website/src/app/api/admin/upload/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: mocks.put }))

import { POST } from './route'

function makeRequestWithFile(file: File): Request {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost/api/admin/upload', { method: 'POST', body: form })
}

describe('POST /api/admin/upload', () => {
  beforeEach(() => {
    mocks.put.mockReset()
  })

  it('dosya eksikse 400 döner', async () => {
    const response = await POST(new Request('http://localhost/api/admin/upload', { method: 'POST', body: new FormData() }))
    expect(response.status).toBe(400)
  })

  it('izin verilmeyen dosya tipinde 400 döner', async () => {
    const file = new File(['x'], 'dosya.txt', { type: 'text/plain' })
    const response = await POST(makeRequestWithFile(file))
    expect(response.status).toBe(400)
  })

  it('8MB üzeri dosyada 400 döner', async () => {
    const bigContent = new Uint8Array(8 * 1024 * 1024 + 1)
    const file = new File([bigContent], 'buyuk.jpg', { type: 'image/jpeg' })
    const response = await POST(makeRequestWithFile(file))
    expect(response.status).toBe(400)
  })

  it('geçerli görseli yükler ve URL döner', async () => {
    mocks.put.mockResolvedValue({ url: 'https://blob.vercel-storage.com/foto.jpg' })
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    const response = await POST(makeRequestWithFile(file))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toEqual({ url: 'https://blob.vercel-storage.com/foto.jpg' })
  })
})
```

- [ ] **Step 6: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npx vitest run src/app/api/admin/upload/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 7: upload/route.ts implementasyonu**

`apps/website/src/app/api/admin/upload/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 8 * 1024 * 1024

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Sadece JPEG, PNG, WEBP veya GIF yüklenebilir' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Dosya çok büyük (maksimum 8MB)' }, { status: 400 })
  }
  const blob = await put(`faydalab-website/${Date.now()}-${file.name}`, file, { access: 'public' })
  return NextResponse.json({ url: blob.url })
}
```

- [ ] **Step 8: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/upload/route.test.ts`
Expected: PASS (4 test).

- [ ] **Step 9: Tüm test paketini çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/app/api/admin/settings apps/website/src/app/api/admin/upload
git commit -m "feat(website): site ayarları + görsel yükleme API route'ları"
```

---

### Task 9: İletişim Formu API Route'u

**Files:**
- Create: `apps/website/src/lib/telegram.ts`
- Create: `apps/website/src/app/api/contact/route.ts`
- Test: `apps/website/src/app/api/contact/route.test.ts`

**Interfaces:**
- Consumes: `prisma.contactMessage` (Task 2).
- Produces: `sendAlert(message: string): Promise<void>` (hiçbir zaman hata fırlatmaz), `POST /api/contact` (`{ name, email, message }` body → `ContactMessage` kaydı + Telegram bildirimi). Task 11 (public ContactSection) bu endpoint'i tüketir.

- [ ] **Step 1: telegram.ts implementasyonu (test gerekmez — content-agent'taki aynı deseni tekrar eder, hata durumunda sessizce loglar)**

`apps/website/src/lib/telegram.ts`:

```typescript
function apiBase(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

// Çağıranın akışını asla kesmemesi için hata fırlatmaz.
export async function sendAlert(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return

  try {
    await fetch(`${apiBase()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })
  } catch (error) {
    console.error('Telegram uyarısı gönderilemedi:', error)
  }
}
```

- [ ] **Step 2: contact/route.ts başarısız testini yaz**

`apps/website/src/app/api/contact/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { create: mocks.create } } }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.sendAlert.mockReset()
    mocks.sendAlert.mockResolvedValue(undefined)
  })

  it('geçersiz e-posta için 400 döner ve kayıt oluşturmaz', async () => {
    const response = await POST(makeRequest({ name: 'Ali', email: 'gecersiz', message: 'Merhaba' }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('eksik alan için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com' }))
    expect(response.status).toBe(400)
  })

  it('geçerli veride kaydeder ve Telegram bildirimi gönderir', async () => {
    mocks.create.mockResolvedValue({ id: 'msg-1' })
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }))
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body).toEqual({ id: 'msg-1' })
    expect(mocks.create).toHaveBeenCalledWith({
      data: { name: 'Ali', email: 'ali@example.com', message: 'Merhaba' },
    })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('Ali'))
  })
})
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/app/api/contact/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 4: contact/route.ts implementasyonu**

`apps/website/src/app/api/contact/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendAlert } from '@/lib/telegram'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const saved = await prisma.contactMessage.create({ data: parsed.data })
  await sendAlert(`Yeni iletişim mesajı:\n${parsed.data.name} (${parsed.data.email})\n${parsed.data.message}`)

  return NextResponse.json({ id: saved.id }, { status: 201 })
}
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/contact/route.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/telegram.ts apps/website/src/app/api/contact
git commit -m "feat(website): iletişim formu API route'u + Telegram bildirimi"
```

---

### Task 10: Site Ayarları API Route Testleri Tamam — Görsel Yükleme Bileşeni

**Files:**
- Create: `apps/website/src/components/admin/ImageUploadField.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/upload` (Task 8).
- Produces: `ImageUploadField({ value, onChange })` React bileşeni. Task 12/13 bunu kullanır.

- [ ] **Step 1: ImageUploadField.tsx implementasyonu (UI bileşeni, otomatik test yazılmaz — Global Constraints)**

`apps/website/src/components/admin/ImageUploadField.tsx`:

```typescript
'use client'

import { useState } from 'react'

export function ImageUploadField({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const body = await res.json()
      if (res.ok) onChange(body.url)
      else alert(body.error ?? 'Yükleme başarısız')
    } catch {
      alert('Yükleme başarısız, lütfen tekrar deneyin')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Yüklenen görsel" className="mb-2 h-24 w-40 rounded object-cover" />
      )}
      <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <p className="text-sm text-brand-muted">Yükleniyor...</p>}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck çalıştır**

Run: `cd apps/website && npm run typecheck`
Expected: hatasız tamamlanır.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/admin/ImageUploadField.tsx
git commit -m "feat(website): admin görsel yükleme bileşeni"
```

---

### Task 11: Public Section Bileşenleri ve Ana Sayfa

**Files:**
- Create: `apps/website/src/components/sections/HeroSection.tsx`
- Create: `apps/website/src/components/sections/ServicesSection.tsx`
- Create: `apps/website/src/components/sections/CaseStudySection.tsx`
- Create: `apps/website/src/components/sections/TextBlockSection.tsx`
- Create: `apps/website/src/components/sections/ContactSection.tsx`
- Create: `apps/website/src/components/sections/SectionRenderer.tsx`
- Modify: `apps/website/src/app/page.tsx` (Task 1'deki geçici içeriği gerçek section render mantığıyla değiştir)

**Interfaces:**
- Consumes: `prisma.section` (Task 2), `validateSectionContent` (Task 3), `POST /api/contact` (Task 9).
- Produces: Ana sayfa, veritabanındaki görünür section'ları sırayla render eder; geçersiz içerikli bir section sayfanın geri kalanını bozmadan atlanır (Global Constraints — hata yönetimi).

- [ ] **Step 1: HeroSection.tsx**

`apps/website/src/components/sections/HeroSection.tsx`:

```typescript
import type { HeroContent } from '@/lib/sections'

export function HeroSection({ content }: { content: HeroContent }) {
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-5xl uppercase tracking-wide text-brand-text md:text-7xl">
        {content.title}
      </h1>
      <p className="mt-6 max-w-2xl font-subheading text-lg text-brand-muted">{content.subtitle}</p>
      <a
        href={content.ctaLink}
        className="mt-8 rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg transition hover:opacity-90"
      >
        {content.ctaText}
      </a>
    </section>
  )
}
```

- [ ] **Step 2: ServicesSection.tsx**

`apps/website/src/components/sections/ServicesSection.tsx`:

```typescript
import type { ServicesContent } from '@/lib/sections'

export function ServicesSection({ content }: { content: ServicesContent }) {
  return (
    <section className="px-6 py-20">
      <h2 className="mb-12 text-center font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-brand-border bg-brand-bg p-6">
            <div className="mb-3 text-3xl">{item.icon}</div>
            <h3 className="mb-2 font-subheading text-xl text-brand-text">{item.name}</h3>
            <p className="text-brand-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: CaseStudySection.tsx**

`apps/website/src/components/sections/CaseStudySection.tsx`:

```typescript
import Image from 'next/image'
import type { CaseStudyContent } from '@/lib/sections'

export function CaseStudySection({ content }: { content: CaseStudyContent }) {
  return (
    <section className="border-t border-brand-border px-6 py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-lg">
          <Image src={content.imageUrl} alt={content.projectName} fill className="object-cover" />
        </div>
        <div>
          <h3 className="mb-4 font-heading text-3xl uppercase text-brand-text">{content.projectName}</h3>
          <p className="mb-2 text-brand-muted">
            <span className="font-subheading text-brand-gold">İhtiyaç: </span>
            {content.needText}
          </p>
          <p className="mb-2 text-brand-muted">
            <span className="font-subheading text-brand-gold">Çözüm: </span>
            {content.solutionText}
          </p>
          <p className="mb-4 text-brand-muted">
            <span className="font-subheading text-brand-gold">Sonuç: </span>
            {content.resultText}
          </p>
          <a
            href={content.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-subheading text-brand-gold underline"
          >
            Canlı siteyi görüntüle →
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: TextBlockSection.tsx**

`apps/website/src/components/sections/TextBlockSection.tsx`:

```typescript
import type { TextBlockContent } from '@/lib/sections'

export function TextBlockSection({ content }: { content: TextBlockContent }) {
  const paragraphs = content.bodyMarkdown.split('\n\n').filter(Boolean)
  return (
    <section className="border-t border-brand-border px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 font-heading text-3xl uppercase text-brand-text">{content.title}</h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 text-brand-muted">
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: ContactSection.tsx**

`apps/website/src/components/sections/ContactSection.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { ContactContent } from '@/lib/sections'

export function ContactSection({ content }: { content: ContactContent }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        message: form.get('message'),
      }),
    })
    if (res.ok) {
      setStatus('sent')
      e.currentTarget.reset()
    } else {
      setStatus('error')
    }
  }

  return (
    <section className="border-t border-brand-border px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mb-2 font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
        <p className="mb-8 text-brand-muted">{content.subtitle}</p>
        {status === 'sent' ? (
          <p className="text-brand-gold">Mesajınız alındı, en kısa sürede dönüş yapacağız.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <input
              name="name"
              placeholder="İsim"
              required
              className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
            />
            <input
              name="email"
              type="email"
              placeholder="E-posta"
              required
              className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
            />
            <textarea
              name="message"
              placeholder="Mesajınız"
              required
              rows={4}
              className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
            />
            {status === 'error' && <p className="text-sm text-red-400">Gönderim başarısız, lütfen tekrar deneyin.</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: SectionRenderer.tsx**

`apps/website/src/components/sections/SectionRenderer.tsx`:

```typescript
import type { Section } from '@prisma/client'
import { HeroSection } from './HeroSection'
import { ServicesSection } from './ServicesSection'
import { CaseStudySection } from './CaseStudySection'
import { TextBlockSection } from './TextBlockSection'
import { ContactSection } from './ContactSection'
import type {
  HeroContent,
  ServicesContent,
  CaseStudyContent,
  TextBlockContent,
  ContactContent,
} from '@/lib/sections'

export function SectionRenderer({ section }: { section: Section }) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection content={section.content as unknown as HeroContent} />
    case 'SERVICES':
      return <ServicesSection content={section.content as unknown as ServicesContent} />
    case 'CASE_STUDY':
      return <CaseStudySection content={section.content as unknown as CaseStudyContent} />
    case 'TEXT_BLOCK':
      return <TextBlockSection content={section.content as unknown as TextBlockContent} />
    case 'CONTACT':
      return <ContactSection content={section.content as unknown as ContactContent} />
    default:
      return null
  }
}
```

- [ ] **Step 7: page.tsx'i gerçek section render mantığıyla değiştir**

`apps/website/src/app/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { validateSectionContent, type SectionType } from '@/lib/sections'
import { SectionRenderer } from '@/components/sections/SectionRenderer'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return {
    title: settings?.siteTitle ?? 'FaydaLab',
    description: settings?.metaDescription ?? '',
    icons: settings?.faviconUrl ? [{ url: settings.faviconUrl }] : undefined,
  }
}

export default async function HomePage() {
  const sections = await prisma.section.findMany({
    where: { visible: true },
    orderBy: { order: 'asc' },
  })

  const validSections = sections.filter((section) => {
    const result = validateSectionContent(section.type as SectionType, section.content)
    if (!result.success) {
      console.error(`Geçersiz section içeriği atlandı: ${section.id} (${section.type})`, result.error.flatten())
    }
    return result.success
  })

  return (
    <main>
      {validSections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </main>
  )
}
```

- [ ] **Step 8: Typecheck ve build çalıştır**

Run: `cd apps/website && npm run typecheck && npm run build`
Expected: hatasız tamamlanır (build sırasında `DATABASE_URL` gerekebilir; yoksa bu adımı Task 14'teki uçtan uca kontrolde tekrar doğrula ve şimdilik sadece `npm run typecheck`'in geçtiğini teyit et).

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/components/sections apps/website/src/app/page.tsx
git commit -m "feat(website): public section bileşenleri ve ana sayfa render mantığı"
```

---

### Task 12: Admin Panel — Section Yönetimi Ekranı

**Files:**
- Create: `apps/website/src/components/admin/SectionForm.tsx`
- Create: `apps/website/src/app/admin/(protected)/sections/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/sections`, `PATCH/DELETE /api/admin/sections/[id]`, `POST /api/admin/sections/reorder` (Task 6, 7), `ImageUploadField` (Task 10).
- Produces: `/admin/sections` sayfası — liste + ekle/sil/sırala/gizle + tip-bazlı düzenleme formu.

- [ ] **Step 1: SectionForm.tsx implementasyonu (UI bileşeni, otomatik test yazılmaz)**

`apps/website/src/components/admin/SectionForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ImageUploadField } from './ImageUploadField'

type SectionType = 'HERO' | 'SERVICES' | 'CASE_STUDY' | 'TEXT_BLOCK' | 'CONTACT'
type ServiceItem = { icon: string; name: string; description: string }

export function SectionForm({
  type,
  initialContent,
  onSave,
}: {
  type: SectionType
  initialContent: Record<string, unknown>
  onSave: (content: Record<string, unknown>) => Promise<void>
}) {
  const [content, setContent] = useState<Record<string, unknown>>(initialContent)
  const [saving, setSaving] = useState(false)

  function setField(key: string, value: unknown) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  function textField(key: string, label: string, multiline = false) {
    const value = (content[key] as string) ?? ''
    return (
      <label key={key} className="flex flex-col gap-1 text-sm text-brand-muted">
        {label}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            rows={4}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        )}
      </label>
    )
  }

  function serviceItemsField() {
    const items = (content.items as ServiceItem[]) ?? []

    function updateItem(index: number, key: keyof ServiceItem, value: string) {
      const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
      setField('items', next)
    }

    function addItem() {
      setField('items', [...items, { icon: '', name: '', description: '' }])
    }

    function removeItem(index: number) {
      setField('items', items.filter((_, i) => i !== index))
    }

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-brand-muted">Hizmet Kartları</p>
        {items.map((item, index) => (
          <div key={index} className="flex flex-col gap-2 rounded border border-brand-border p-3">
            <input
              placeholder="İkon (emoji)"
              value={item.icon}
              onChange={(e) => updateItem(index, 'icon', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <input
              placeholder="Ad"
              value={item.name}
              onChange={(e) => updateItem(index, 'name', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <textarea
              placeholder="Açıklama"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <button type="button" onClick={() => removeItem(index)} className="self-start text-sm text-red-400">
              Kartı Sil
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="self-start text-sm text-brand-gold">
          + Kart Ekle
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(content)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {type === 'HERO' && (
        <>
          {textField('title', 'Başlık')}
          {textField('subtitle', 'Alt Başlık', true)}
          {textField('ctaText', 'Buton Metni')}
          {textField('ctaLink', 'Buton Linki')}
        </>
      )}
      {type === 'SERVICES' && (
        <>
          {textField('title', 'Bölüm Başlığı')}
          {serviceItemsField()}
        </>
      )}
      {type === 'CASE_STUDY' && (
        <>
          {textField('projectName', 'Proje Adı')}
          {textField('needText', 'İhtiyaç', true)}
          {textField('solutionText', 'Çözüm', true)}
          {textField('resultText', 'Sonuç', true)}
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            Görsel
            <ImageUploadField value={(content.imageUrl as string) ?? ''} onChange={(url) => setField('imageUrl', url)} />
          </label>
          {textField('liveUrl', 'Canlı Site Linki')}
        </>
      )}
      {type === 'TEXT_BLOCK' && (
        <>
          {textField('title', 'Başlık')}
          {textField('bodyMarkdown', 'Metin', true)}
        </>
      )}
      {type === 'CONTACT' && (
        <>
          {textField('title', 'Başlık')}
          {textField('subtitle', 'Alt Başlık', true)}
        </>
      )}
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-brand-gold px-6 py-2 font-subheading font-semibold text-brand-bg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: sections/page.tsx implementasyonu (UI bileşeni, otomatik test yazılmaz)**

`apps/website/src/app/admin/(protected)/sections/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { SectionForm } from '@/components/admin/SectionForm'

type SectionType = 'HERO' | 'SERVICES' | 'CASE_STUDY' | 'TEXT_BLOCK' | 'CONTACT'

type SectionRecord = {
  id: string
  type: SectionType
  order: number
  visible: boolean
  content: Record<string, unknown>
}

const TYPE_LABELS: Record<SectionType, string> = {
  HERO: 'Hero',
  SERVICES: 'Hizmetler',
  CASE_STUDY: 'Vaka Çalışması',
  TEXT_BLOCK: 'Metin Bloğu',
  CONTACT: 'İletişim',
}

const DEFAULT_CONTENT: Record<SectionType, Record<string, unknown>> = {
  HERO: { title: '', subtitle: '', ctaText: '', ctaLink: '' },
  SERVICES: { title: '', items: [] },
  CASE_STUDY: { projectName: '', needText: '', solutionText: '', resultText: '', imageUrl: '', liveUrl: '' },
  TEXT_BLOCK: { title: '', bodyMarkdown: '' },
  CONTACT: { title: '', subtitle: '' },
}

export default function SectionsPage() {
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<SectionType | ''>('')

  async function load() {
    const res = await fetch('/api/admin/sections')
    setSections(await res.json())
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReorder(id: string, direction: 'up' | 'down') {
    await fetch('/api/admin/sections/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, direction }),
    })
    load()
  }

  async function handleToggleVisible(section: SectionRecord) {
    await fetch(`/api/admin/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !section.visible }),
    })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu section silinsin mi?')) return
    await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' })
    load()
  }

  async function handleUpdate(id: string, content: Record<string, unknown>) {
    await fetch(`/api/admin/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setEditingId(null)
    load()
  }

  async function handleCreate(type: SectionType, content: Record<string, unknown>) {
    await fetch('/api/admin/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    })
    setAddingType('')
    load()
  }

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Bölümler</h1>

      <div className="mb-8 flex flex-col gap-3">
        {sections.map((section, index) => (
          <div key={section.id} className="rounded border border-brand-border p-4">
            <div className="flex items-center justify-between">
              <span className="font-subheading text-brand-text">
                {TYPE_LABELS[section.type]} {!section.visible && <span className="text-brand-muted">(gizli)</span>}
              </span>
              <div className="flex gap-3 text-sm">
                <button onClick={() => handleReorder(section.id, 'up')} disabled={index === 0} className="text-brand-gold disabled:opacity-30">
                  ↑
                </button>
                <button
                  onClick={() => handleReorder(section.id, 'down')}
                  disabled={index === sections.length - 1}
                  className="text-brand-gold disabled:opacity-30"
                >
                  ↓
                </button>
                <button onClick={() => handleToggleVisible(section)} className="text-brand-gold">
                  {section.visible ? 'Gizle' : 'Göster'}
                </button>
                <button onClick={() => setEditingId(editingId === section.id ? null : section.id)} className="text-brand-gold">
                  Düzenle
                </button>
                <button onClick={() => handleDelete(section.id)} className="text-red-400">
                  Sil
                </button>
              </div>
            </div>
            {editingId === section.id && (
              <div className="mt-4">
                <SectionForm type={section.type} initialContent={section.content} onSave={(content) => handleUpdate(section.id, content)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-brand-border p-4">
        <h2 className="mb-3 font-subheading text-brand-text">Yeni Bölüm Ekle</h2>
        <select
          value={addingType}
          onChange={(e) => setAddingType(e.target.value as SectionType | '')}
          className="mb-3 rounded border border-brand-border bg-transparent p-2 text-brand-text"
        >
          <option value="">Tip seçin</option>
          {(Object.keys(TYPE_LABELS) as SectionType[]).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {addingType && (
          <SectionForm type={addingType} initialContent={DEFAULT_CONTENT[addingType]} onSave={(content) => handleCreate(addingType, content)} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck çalıştır**

Run: `cd apps/website && npm run typecheck`
Expected: hatasız tamamlanır.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/admin/SectionForm.tsx "apps/website/src/app/admin/(protected)/sections"
git commit -m "feat(website): admin panel section yönetimi ekranı (ekle/düzenle/sil/sırala/gizle)"
```

---

### Task 13: Admin Panel — Site Ayarları ve Gelen Mesajlar Ekranları

**Files:**
- Create: `apps/website/src/app/admin/(protected)/settings/page.tsx`
- Create: `apps/website/src/app/api/admin/messages/route.ts`
- Test: `apps/website/src/app/api/admin/messages/route.test.ts`
- Create: `apps/website/src/app/admin/(protected)/messages/page.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/admin/settings` (Task 8), `ImageUploadField` (Task 10), `prisma.contactMessage` (Task 2).
- Produces: `/admin/settings` sayfası, `GET /api/admin/messages`, `/admin/messages` sayfası (salt-okunur liste).

- [ ] **Step 1: settings/page.tsx implementasyonu (UI bileşeni, otomatik test yazılmaz)**

`apps/website/src/app/admin/(protected)/settings/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'

type Settings = {
  siteTitle: string
  metaDescription: string
  faviconUrl: string
  logoUrl: string
  instagramUrl: string
  contactEmail: string
}

const EMPTY: Settings = {
  siteTitle: '',
  metaDescription: '',
  faviconUrl: '',
  logoUrl: '',
  instagramUrl: '',
  contactEmail: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings({ ...EMPTY, ...data })
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
  }

  function field(key: keyof Settings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Site Ayarları</h1>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Site Başlığı
          <input
            value={settings.siteTitle}
            onChange={(e) => field('siteTitle', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Meta Açıklama
          <textarea
            value={settings.metaDescription}
            onChange={(e) => field('metaDescription', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Favicon
          <ImageUploadField value={settings.faviconUrl} onChange={(url) => field('faviconUrl', url)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Logo
          <ImageUploadField value={settings.logoUrl} onChange={(url) => field('logoUrl', url)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Instagram Linki
          <input
            value={settings.instagramUrl}
            onChange={(e) => field('instagramUrl', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          İletişim E-postası
          <input
            value={settings.contactEmail}
            onChange={(e) => field('contactEmail', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        {saved && <p className="text-brand-gold">Kaydedildi.</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold px-6 py-3 font-subheading font-semibold text-brand-bg hover:opacity-90"
        >
          Kaydet
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: messages/route.ts başarısız testini yaz**

`apps/website/src/app/api/admin/messages/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { contactMessage: { findMany: mocks.findMany } } }))

import { GET } from './route'

describe('GET /api/admin/messages', () => {
  it('mesajları en yeniden eskiye sıralı döner', async () => {
    mocks.findMany.mockResolvedValue([{ id: '1' }])
    const response = await GET()
    const body = await response.json()
    expect(body).toEqual([{ id: '1' }])
    expect(mocks.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
  })
})
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd apps/website && npx vitest run src/app/api/admin/messages/route.test.ts`
Expected: FAIL — `route.ts` bulunamadı.

- [ ] **Step 4: messages/route.ts implementasyonu**

`apps/website/src/app/api/admin/messages/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(messages)
}
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/messages/route.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: messages/page.tsx implementasyonu (server component, UI — otomatik test yazılmaz)**

`apps/website/src/app/admin/(protected)/messages/page.tsx`:

```typescript
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Gelen Mesajlar</h1>
      {messages.length === 0 && <p className="text-brand-muted">Henüz mesaj yok.</p>}
      <div className="flex flex-col gap-4">
        {messages.map((m) => (
          <div key={m.id} className="rounded border border-brand-border p-4">
            <p className="font-subheading text-brand-text">
              {m.name} — {m.email}
            </p>
            <p className="mt-1 text-brand-muted">{m.message}</p>
            <p className="mt-2 text-xs text-brand-muted">{m.createdAt.toLocaleString('tr-TR')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Tüm test paketini çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/website/src/app/admin/(protected)/settings" apps/website/src/app/api/admin/messages "apps/website/src/app/admin/(protected)/messages"
git commit -m "feat(website): admin panel site ayarları + gelen mesajlar ekranları"
```

---

### Task 14: Seed Script, README, Uçtan Uca Doğrulama

**Files:**
- Create: `apps/website/prisma/seed.ts`
- Create: `apps/website/README.md`

**Interfaces:**
- Consumes: tüm önceki görevlerin tamamı (Prisma modelleri, section tipleri).
- Produces: `npm run db:seed` ile çalıştırılabilir başlangıç verisi (5+ section, `SiteSettings`, `AdminUser`); site ilk yayınlandığında boş olmaz.

- [ ] **Step 1: seed.ts implementasyonu**

`apps/website/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existingCount = await prisma.section.count()
  if (existingCount === 0) {
    const sections: { type: 'HERO' | 'SERVICES' | 'CASE_STUDY' | 'TEXT_BLOCK' | 'CONTACT'; content: Record<string, unknown> }[] = [
      {
        type: 'HERO',
        content: {
          title: 'FaydaLab',
          subtitle: 'Teknolojiyi ve yapay zekayı anlaşılır, uygulanabilir ve güvenilir kılan teknoloji otorite markası.',
          ctaText: 'İletişime Geç',
          ctaLink: '#iletisim',
        },
      },
      {
        type: 'SERVICES',
        content: {
          title: 'Yaptıklarımız',
          items: [
            {
              icon: '🤖',
              name: 'Instagram İçerik Otomasyonu',
              description: 'Yapay zeka destekli, onaylı yayın akışıyla haftalık sosyal medya içeriği üretimi.',
            },
            {
              icon: '🌐',
              name: 'Web Sitesi ve QR Menü',
              description: 'İşletmeler için hızlı teslim edilen, panelden yönetilebilir web sitesi ve QR menü sistemleri.',
            },
            {
              icon: '🧾',
              name: 'QR Tabanlı Adisyon Sistemleri',
              description: 'Restoran ve kafeler için QR ile entegre sipariş/adisyon çözümleri.',
            },
            {
              icon: '📄',
              name: 'Çoklu Belge Oluşturucu ve Gönderici',
              description: 'Eğitim ve sertifika veren kurumlar için katılım belgelerini toplu oluşturup gönderen sistemler.',
            },
            {
              icon: '💌',
              name: 'Yapay Zeka Destekli Davetiye',
              description: 'Kişiselleştirilmiş, online davetiye ve benzeri dijital ürünler.',
            },
          ],
        },
      },
      {
        type: 'CASE_STUDY',
        content: {
          projectName: 'Gazi-Usta Aile Kebap Salonu',
          needText: '1985’ten beri Kütahya’da hizmet veren işletmenin dijitalde varlığı yoktu; menü güncellemeleri kağıt bastırmaya bağımlıydı.',
          solutionText: 'Panelden yönetilebilen tanıtım sitesi ve dijital menü sistemi kuruldu; menü, fiyat, galeri ve duyurular tek admin panelinden anlık güncellenebiliyor.',
          resultText: 'İşletme artık menü ve kampanyalarını dakikalar içinde güncelleyebiliyor, dijital bir vitrine kavuştu.',
          imageUrl: 'https://gazi-usta.vercel.app/on-cephe.jpg',
          liveUrl: 'https://gazi-usta.vercel.app',
        },
      },
      {
        type: 'CASE_STUDY',
        content: {
          projectName: 'Gelecek Rehberlik',
          needText: 'Gönüllü mentörlük hizmetinin online bir tanıtım ve başvuru yüzeyi yoktu.',
          solutionText: 'Next.js/Prisma tabanlı bir mentörlük platformu geliştirildi: rehber başvurusu, onay akışı, blog ve admin paneli.',
          resultText: 'Hizmet artık profesyonel bir dijital yüzeyle tanıtılıyor ve başvurular otomatik yönetiliyor.',
          imageUrl: 'https://placehold.co/800x450/0B0B0D/D4AF37?text=Gelecek+Rehberlik',
          liveUrl: 'https://gelecegerehberlik.com',
        },
      },
      {
        type: 'CASE_STUDY',
        content: {
          projectName: 'Atlas Murat Koçer — Kişisel Site',
          needText: 'Çok yönlü bir profesyonel profili (girişimcilik, STK, yazılım) tek bir yüzeyde toplayacak bir portföy sitesi ihtiyacı.',
          solutionText: 'Next.js ve Framer Motion ile modern, hareketli bir kişisel tanıtım/portföy sitesi tasarlandı.',
          resultText: 'Profesyonel bir portföy/tanıtım sitesi canlıya alındı.',
          imageUrl: 'https://placehold.co/800x450/0B0B0D/D4AF37?text=Atlas+Murat+Kocer',
          liveUrl: 'https://atlas-murat-kocer.vercel.app',
        },
      },
      {
        type: 'TEXT_BLOCK',
        content: {
          title: 'Hakkımızda',
          bodyMarkdown:
            'FaydaLab, teknolojiyi ve yapay zekayı anlaşılır, uygulanabilir ve güvenilir kılan bir teknoloji otorite markasıdır.\n\nKüçük işletmelerden eğitim kurumlarına kadar farklı ihtiyaçlara somut, abartısız çözümler üretiyoruz — vaat değil, sonuç.',
        },
      },
      {
        type: 'CONTACT',
        content: {
          title: 'İletişime Geçin',
          subtitle: 'Projenizi anlatın, size en uygun çözümü birlikte bulalım.',
        },
      },
    ]

    for (const [index, section] of sections.entries()) {
      await prisma.section.create({
        data: { type: section.type, content: section.content, order: index, visible: true },
      })
    }
  } else {
    console.log(`Section tablosunda zaten ${existingCount} kayıt var, seed atlandı.`)
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      siteTitle: 'FaydaLab — Teknoloji ve Yapay Zeka Otorite Markası',
      metaDescription: 'FaydaLab; Instagram içerik otomasyonu, web sitesi/QR menü, adisyon sistemleri ve daha fazlası için teknoloji ve yapay zeka çözümleri sunar.',
      instagramUrl: 'https://www.instagram.com/faydalab',
    },
    update: {},
  })

  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME ve ADMIN_PASSWORD .env dosyasında tanımlı olmalı')
  }
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { username },
    create: { username, passwordHash },
    update: { passwordHash },
  })

  console.log('Seed tamamlandı.')
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 2: README.md yaz**

`apps/website/README.md`:

```markdown
# FaydaLab — Kurumsal Web Sitesi

Section-tabanlı, panelden yönetilebilir kurumsal site. Tasarım: `docs/superpowers/specs/2026-08-04-faydalab-website-design.md`.

## Kurulum

```bash
npm install
cp .env.example .env
# DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, BLOB_READ_WRITE_TOKEN,
# TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID değerlerini doldur
npm run db:migrate
npm run db:seed
npm run dev
```

## Admin Panel

`/admin/login` — `.env`'deki `ADMIN_USERNAME`/`ADMIN_PASSWORD` ile giriş yapılır (seed sırasında oluşturulur).

- `/admin/sections` — bölüm ekle/düzenle/sil/sırala/gizle
- `/admin/settings` — site başlığı, meta açıklama, favicon, logo, Instagram linki
- `/admin/messages` — iletişim formundan gelen mesajlar

## Test

```bash
npm test
npm run typecheck
```
```

- [ ] **Step 3: DATABASE_URL ile gerçek migration ve seed'i çalıştır (yerel/dev veritabanı gerekir)**

Bu adım gerçek bir Postgres bağlantısı gerektirir — implementer'ın `.env`'inde çalışan bir `DATABASE_URL` yoksa bu adımı atla ve controller'a bildir (deployment aşamasında controller tarafından gerçek Neon veritabanına karşı çalıştırılacak, önceki fazlarda izlenen desenle aynı).

Run: `cd apps/website && npx prisma migrate dev --name init`
Expected: migration başarıyla oluşturulur ve uygulanır.

Run: `ADMIN_USERNAME=test ADMIN_PASSWORD=test123 npm run db:seed`
Expected: `Seed tamamlandı.` mesajı, hatasız.

- [ ] **Step 4: Tüm test paketini ve build'i çalıştır**

Run: `npm test`
Expected: tüm testler PASS.

Run: `npm run typecheck`
Expected: hatasız.

Run: `npm run build` (DATABASE_URL mevcutsa)
Expected: hatasız tamamlanır.

- [ ] **Step 5: Tarayıcıda manuel duman testi**

Run: `npm run dev`, tarayıcıda kontrol et:
- Ana sayfa (`/`): Hero, Hizmetler, 3 vaka çalışması, Hakkımızda, İletişim bölümleri sırayla görünüyor, marka renkleri/fontları doğru uygulanmış
- Mobilde (375px genişlik) sayfa düzeni bozulmuyor
- `/admin/login`: giriş yapılabiliyor
- `/admin/sections`: yeni section eklenebiliyor, sırası değiştirilebiliyor, gizlenebiliyor, silinebiliyor; ana sayfada bu değişiklikler yansıyor
- `/admin/settings`: site başlığı değiştirilip kaydedilebiliyor
- Ana sayfadaki iletişim formu gönderildiğinde `/admin/messages`'ta görünüyor

- [ ] **Step 6: Commit**

```bash
git add apps/website/prisma/seed.ts apps/website/README.md
git commit -m "feat(website): seed script, README, uçtan uca doğrulama"
```

---

## Self-Review Notu (plan yazarı için, implementasyon öncesi)

- **Spec kapsaması:** Section CRUD (Task 6-7), SiteSettings (Task 8, 13), ContactMessage (Task 9, 13), AdminUser/auth (Task 4-5), 5 section tipi + render (Task 3, 11), seed içerik (Task 14), gazi-usta'daki bilinen tuzaklar (`force-dynamic`, mobil test) Global Constraints ve Task 14 Step 5'te kapsandı.
- **Tip tutarlılığı:** `SectionType`, `HeroContent`/`ServicesContent`/`CaseStudyContent`/`TextBlockContent`/`ContactContent` isimleri Task 3'te tanımlandı, Task 6/11/12'de aynı isimlerle tüketiliyor.
- **Kapsam dışı (spec'te de belirtildi):** Şablon/pipeline sistemi (ayrı spec), özel domain bağlama (deployment aşamasında), tam serbest sayfa oluşturucu.
