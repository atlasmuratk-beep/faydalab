# FaydaLab Faz 3a — CRM Çekirdeği + AI Lead Kalifikasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni bir `apps/crm` uygulaması kurmak: web sitesi ve Vapi aramalarından gelen lead'leri tek bir yerde toplayan, her lead'i Claude ile otomatik değerlendirip Telegram'a bildirim atan, tek admin hesabıyla yönetilen basit bir CRM.

**Architecture:** Monorepo içinde yeni bir Next.js/App Router/Prisma/Neon app'i (`apps/website` ve `apps/content-agent` ile aynı desenler: credentials+bcrypt+HMAC session auth, `sendAlert` Telegram bildirim deseni, lazy-init Anthropic SDK istemcisi). İki giriş noktası (`/api/leads` jenerik, `/api/webhooks/vapi` Vapi'ye özel) aynı `createLead`+`runQualification` çekirdek mantığını kullanır. AI kalifikasyonu, `next/server`'ın `after()` API'ı ile HTTP yanıtını geciktirmeden arka planda çalışır.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS v3, Prisma + Neon Postgres, `@anthropic-ai/sdk`, `bcryptjs`, Vitest.

## Global Constraints

- Marka renkleri (Tailwind token'ları): `brand-bg #0B0B0D`, `brand-surface #151518`, `brand-text #F5F5F5`, `brand-gold #D4AF37`, `brand-muted #B8BDC7`, `brand-border #2A2A2F`.
- Auth deseni: credentials (bcrypt) + tek admin + HMAC-imzalı session cookie (`apps/website/src/lib/session.ts` ile birebir aynı format: `userId.issuedAt.sig`, 30 gün geçerlilik, `timingSafeEqual` karşılaştırma). Login'de `DUMMY_HASH` ile zamanlama yan kanalı koruması.
- Telegram bildirimleri `sendAlert` deseniyle: asla hata fırlatmaz, çağıranın akışını hiçbir zaman bloklamaz/bozmaz.
- Claude entegrasyonu: `@anthropic-ai/sdk` doğrudan kullanımı (Vercel AI SDK değil), lazy-init istemci (modül seviyesinde kurulmaz — env yokken `next build`'i bozmasın diye), JSON-formatlı prompt + zod `.parse()` (başarısızlıkta throw, çağıran taraf yakalar).
- Test politikası: API route'ları ve `lib/` fonksiyonları Vitest ile test edilir (`vi.mock` ile Prisma/Telegram/Claude mocklanır). Admin UI bileşenleri için otomatik test yazılmaz.
- DB'den okuyan sayfalarda `export const dynamic = 'force-dynamic'` zorunlu.
- Rate limit: basit bellek-içi `Map` tabanlı (`apps/website/src/lib/rate-limit.ts` ile birebir aynı) — dağıtık ortamda sınırlı etkili olduğu bilinen bir YAGNI kararı, sorun değil.
- Next.js 16 dinamik route handler'ları `{ params: Promise<{ id: string }> }` + `await params` şeklinde olmalı (senkron değil).
- Tüm kullanıcıya dönük metinler ve commit mesajları Türkçe; kod/teknik terimler İngilizce kalabilir.

---

## Task 1: Proje İskeleti

**Files:**
- Create: `apps/crm/package.json`
- Create: `apps/crm/tsconfig.json`
- Create: `apps/crm/next.config.js`
- Create: `apps/crm/postcss.config.js`
- Create: `apps/crm/tailwind.config.ts`
- Create: `apps/crm/.gitignore`
- Create: `apps/crm/.env.example`
- Create: `apps/crm/vitest.config.ts`
- Create: `apps/crm/src/app/globals.css`
- Create: `apps/crm/src/app/layout.tsx`
- Create: `apps/crm/src/app/page.tsx`

**Interfaces:**
- Produces: Tailwind `brand-*` renk token'ları (`brand-bg`, `brand-surface`, `brand-text`, `brand-gold`, `brand-muted`, `brand-border`) — sonraki tüm UI görevleri bunları kullanır. `@/*` path alias'ı `src/*`'e işaret eder.

- [ ] **Step 1: package.json oluştur**

```json
{
  "name": "faydalab-crm",
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
    "db:seed": "dotenv -e .env -- tsx prisma/seed.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.0",
    "@prisma/client": "^6.0.0",
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
    "dotenv-cli": "^7.4.0",
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

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

- [ ] **Step 4: postcss.config.js oluştur**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: tailwind.config.ts oluştur**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0B0B0D',
        'brand-surface': '#151518',
        'brand-text': '#F5F5F5',
        'brand-gold': '#D4AF37',
        'brand-muted': '#B8BDC7',
        'brand-border': '#2A2A2F',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 6: .gitignore oluştur**

```
node_modules/
.next/
.env
.env.local
tsconfig.tsbuildinfo
.vercel
next-env.d.ts
.env*
!.env.example
```

- [ ] **Step 7: .env.example oluştur**

```
DATABASE_URL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_SESSION_SECRET=""
ANTHROPIC_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
VAPI_WEBHOOK_SECRET=""
```

- [ ] **Step 8: vitest.config.ts oluştur**

```ts
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

- [ ] **Step 9: globals.css oluştur**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: layout.tsx oluştur**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FaydaLab CRM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-brand-bg text-brand-text antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 11: page.tsx oluştur (kök yönlendirme)**

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/admin/leads')
}
```

- [ ] **Step 12: Bağımlılıkları kur ve derlemeyi doğrula**

Run: `cd apps/crm && npm install && npm run typecheck && npm run build`
Expected: Hatasız tamamlanır (henüz Prisma şeması olmadığı için `next build` sırasında `@prisma/client` importu yoksa sorun olmaz; bu adımda hiçbir dosya `@prisma/client`'ı import etmiyor).

- [ ] **Step 13: Commit**

```bash
git add apps/crm
git commit -m "FaydaLab CRM: proje iskeleti"
```

---

## Task 2: Prisma Şeması + DB İstemcisi + Seed

**Files:**
- Create: `apps/crm/prisma/schema.prisma`
- Create: `apps/crm/src/lib/db.ts`
- Create: `apps/crm/prisma/seed.ts`

**Interfaces:**
- Consumes: Task 1'in `package.json`'daki `db:generate`/`db:seed` script'leri.
- Produces: `prisma.lead` ve `prisma.adminUser` modelleri (Prisma Client), `LeadSource`/`LeadStatus`/`LeadUrgency` enum'ları — Task 3+ tüm görevler bunları kullanır. `prisma` singleton export'u `@/lib/db`'den.

- [ ] **Step 1: schema.prisma oluştur**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum LeadSource {
  WEBSITE
  VAPI
}

enum LeadStatus {
  YENI
  DEGERLENDIRILDI
  ILETISIMDE
  KAZANILDI
  KAYBEDILDI
}

enum LeadUrgency {
  DUSUK
  ORTA
  YUKSEK
}

model Lead {
  id          String       @id @default(cuid())
  name        String
  phone       String?
  email       String?
  requestText String
  source      LeadSource
  sourceMeta  Json
  status      LeadStatus   @default(YENI)

  aiSummary   String?
  aiCategory  String?
  aiUrgency   LeadUrgency?
  aiScore     Int?
  aiError     String?

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([status])
  @@index([source])
}

model AdminUser {
  id           String @id @default(cuid())
  username     String @unique
  passwordHash String
}
```

- [ ] **Step 2: db.ts oluştur**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 3: seed.ts oluştur**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
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

- [ ] **Step 4: Prisma Client'ı üret ve şemayı doğrula**

Run: `cd apps/crm && npx prisma generate`
Expected: `Generated Prisma Client` mesajıyla başarılı biter (gerçek bir `DATABASE_URL`/canlı veritabanı gerekmez, sadece şema söz dizimi doğrulanır ve client tipleri üretilir).

Not: `prisma migrate dev` bu adımda ÇALIŞTIRILMAZ — gerçek bir Neon veritabanı gerektirir, bu controller tarafından implementasyon tamamlandıktan sonra ayrıca yapılacaktır (website projesinde de aynı desen izlendi).

- [ ] **Step 5: typecheck ve build ile doğrula**

Run: `npm run typecheck && npm run build`
Expected: Hatasız tamamlanır.

- [ ] **Step 6: Commit**

```bash
git add apps/crm/prisma apps/crm/src/lib/db.ts
git commit -m "FaydaLab CRM: Prisma şeması (Lead, AdminUser) ve DB istemcisi"
```

---

## Task 3: Session/Auth + Rate Limit + Login/Logout API + Middleware + Login Sayfası

**Files:**
- Create: `apps/crm/src/lib/session.ts`
- Create: `apps/crm/src/lib/session.test.ts`
- Create: `apps/crm/src/lib/auth.ts`
- Create: `apps/crm/src/lib/rate-limit.ts`
- Create: `apps/crm/src/middleware.ts`
- Create: `apps/crm/src/middleware.test.ts`
- Create: `apps/crm/src/app/api/auth/login/route.ts`
- Create: `apps/crm/src/app/api/auth/login/route.test.ts`
- Create: `apps/crm/src/app/api/auth/logout/route.ts`
- Create: `apps/crm/src/app/admin/(public)/login/page.tsx`

**Interfaces:**
- Consumes: `prisma.adminUser` (Task 2), Tailwind `brand-*` token'ları (Task 1).
- Produces: `SESSION_COOKIE` sabiti, `signSession(userId): string`, `verifySession(token): string | null`, `requireSession(): Promise<string | null>` (hepsi `@/lib/session` ve `@/lib/auth`'tan) — Task 6, 8, 9'daki tüm korumalı route/sayfalar bunları kullanır. `isRateLimited(key, maxAttempts, windowMs): boolean` (`@/lib/rate-limit`) — Task 6, 7'deki ingestion route'ları da bunu kullanır.

- [ ] **Step 1: session.ts oluştur**

```ts
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_crm_session'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string): string {
  const payload = `${userId}.${Date.now()}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, issuedAtStr, sig] = parts
  const payload = `${userId}.${issuedAtStr}`
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null
  return userId
}
```

- [ ] **Step 2: session.test.ts oluştur**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { signSession, verifySession } from './session'

describe('session', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('süresi dolmuş (30 günden eski) token reddedilir', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now - 31 * 24 * 60 * 60 * 1000)
    const token = signSession('user-1')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(verifySession(token)).toBeNull()
  })

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1')).toThrow('ADMIN_SESSION_SECRET')
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/lib/session.test.ts`
Expected: 5 test PASS.

- [ ] **Step 4: auth.ts oluştur**

```ts
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from './session'

export async function requireSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifySession(token)
}
```

- [ ] **Step 5: rate-limit.ts oluştur**

```ts
// Basit bellek-içi rate limit. NOT: Bu çözüm sunucusuz/çoklu instance (ör. Vercel
// serverless fonksiyonları) ortamlarında her instance kendi belleğini tuttuğu için
// sınırlı etkilidir — gerçek dağıtık rate limit için Redis/Upstash gibi paylaşımlı bir
// depo gerekir. MVP kapsamında YAGNI gereği bu basit çözüm yeterli kabul edildi.
const attempts = new Map<string, number[]>()

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  timestamps.push(now)
  attempts.set(key, timestamps)
  return timestamps.length > maxAttempts
}
```

- [ ] **Step 6: middleware.ts oluştur**

```ts
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

- [ ] **Step 7: middleware.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  SESSION_COOKIE: 'faydalab_crm_session',
}))

import { middleware } from './middleware'
import { verifySession } from '@/lib/session'

describe('middleware', () => {
  beforeEach(() => {
    vi.mocked(verifySession).mockReset()
  })

  it('geçerli session ile /admin isteğini geçirir', () => {
    vi.mocked(verifySession).mockReturnValue('user-1')
    const req = new NextRequest('http://localhost/admin/leads')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('geçersiz session ile /admin isteğini login sayfasına yönlendirir', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/leads')
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('geçersiz session ile /api/admin isteğine 401 döner', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/api/admin/leads/lead-1')
    const res = middleware(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 8: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/middleware.test.ts`
Expected: 3 test PASS.

- [ ] **Step 9: login route.ts oluştur**

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signSession, SESSION_COOKIE } from '@/lib/session'
import { isRateLimited } from '@/lib/rate-limit'

// Zamanlama yan kanalı koruması: kullanıcı yoksa da bcrypt.compare çağrılacak
const DUMMY_HASH = '$2b$10$RhHop1MRdgOrzn.wsoB68OdJb0cQIupfd4j1r8VVYtPHH1EPA1Mm.'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanıcı adı ve şifre gerekli' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { username } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
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

- [ ] **Step 10: login route.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { adminUser: { findUnique: mocks.findUnique } } }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
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
    expect(response.headers.get('set-cookie')).toContain('faydalab_crm_session=')
  })
})
```

- [ ] **Step 11: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/app/api/auth/login/route.test.ts`
Expected: 4 test PASS.

- [ ] **Step 12: logout route.ts oluştur**

```ts
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
```

- [ ] **Step 13: login sayfası oluştur**

```tsx
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
    router.push('/admin/leads')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">FaydaLab CRM Girişi</h1>
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
          className="rounded-full bg-brand-gold py-3 font-semibold text-brand-bg hover:opacity-90"
        >
          Giriş Yap
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 14: Tüm testleri, typecheck ve build'i çalıştır**

Run: `npm test && npm run typecheck && npm run build`
Expected: Tüm testler PASS, typecheck ve build hatasız.

- [ ] **Step 15: Commit**

```bash
git add apps/crm/src/lib/session.ts apps/crm/src/lib/session.test.ts apps/crm/src/lib/auth.ts apps/crm/src/lib/rate-limit.ts apps/crm/src/middleware.ts apps/crm/src/middleware.test.ts apps/crm/src/app/api/auth apps/crm/src/app/admin
git commit -m "FaydaLab CRM: auth (session/login/logout/middleware) ve login sayfası"
```

---

## Task 4: Telegram Bildirim Kütüphanesi

**Files:**
- Create: `apps/crm/src/lib/telegram.ts`
- Create: `apps/crm/src/lib/telegram.test.ts`

**Interfaces:**
- Produces: `sendAlert(message: string): Promise<void>` (`@/lib/telegram`) — Task 6'daki `runQualification` bunu kullanır.

- [ ] **Step 1: telegram.ts oluştur**

```ts
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

- [ ] **Step 2: telegram.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendAlert } from './telegram'

describe('sendAlert', () => {
  beforeEach(() => {
    process.env.TELEGRAM_CHAT_ID = 'chat-1'
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TELEGRAM_CHAT_ID
    delete process.env.TELEGRAM_BOT_TOKEN
  })

  it('TELEGRAM_CHAT_ID tanımlıysa fetch çağırır', async () => {
    await sendAlert('test mesajı')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bottoken-1/sendMessage'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('TELEGRAM_CHAT_ID tanımlı değilse fetch çağırmaz', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await sendAlert('test mesajı')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetch hata fırlatırsa sendAlert yine de hata fırlatmaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ hatası')))
    await expect(sendAlert('test mesajı')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/lib/telegram.test.ts`
Expected: 3 test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/crm/src/lib/telegram.ts apps/crm/src/lib/telegram.test.ts
git commit -m "FaydaLab CRM: Telegram bildirim kütüphanesi"
```

---

## Task 5: AI Kalifikasyon Kütüphanesi

**Files:**
- Create: `apps/crm/src/lib/qualify.ts`
- Create: `apps/crm/src/lib/qualify.test.ts`

**Interfaces:**
- Produces: `qualifyLead(requestText: string): Promise<Qualification>` ve `Qualification` tipi (`{ summary: string, category: string, urgency: 'DUSUK'|'ORTA'|'YUKSEK', score: number }`), `qualificationSchema` (zod) — Task 6'daki `runQualification` bunu kullanır. Şema doğrulaması veya API çağrısı başarısız olursa **throw eder** (çağıran taraf yakalar).

- [ ] **Step 1: qualify.ts oluştur**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// İstemci tembel kurulur: SDK, anahtar yoksa kurucuda hata fırlattığı için
// modül seviyesinde kurmak `next build` sırasında (env yokken) derlemeyi bozar.
let client: Anthropic | null = null

function anthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export const qualificationSchema = z.object({
  summary: z.string(),
  category: z.string(),
  urgency: z.enum(['DUSUK', 'ORTA', 'YUKSEK']),
  score: z.number().int().min(1).max(5),
})

export type Qualification = z.infer<typeof qualificationSchema>

export async function qualifyLead(requestText: string): Promise<Qualification> {
  const message = await anthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 512,
    system:
      'Sen FaydaLab Digital ajansı için gelen müşteri taleplerini değerlendiren bir satış asistanısın. ' +
      'Talebi oku, kısa bir özet çıkar, hizmet kategorisini belirle (ör. "Web Sitesi", "QR Menü", ' +
      '"Instagram Otomasyonu", "Genel"), aciliyetini DUSUK/ORTA/YUKSEK olarak sınıflandır ve 1-5 arası ' +
      'bir öncelik skoru ver (5 en yüksek öncelik).',
    messages: [
      {
        role: 'user',
        content:
          `Müşteri talebi: "${requestText}"\n\n` +
          'Yanıtı sadece şu JSON formatında ver, başka hiçbir metin ekleme: ' +
          '{"summary": string, "category": string, "urgency": "DUSUK"|"ORTA"|"YUKSEK", "score": number}',
      },
    ],
  })

  const textBlock = message.content.find((block: { type: string }) => block.type === 'text') as
    | { type: 'text'; text: string }
    | undefined

  if (!textBlock) {
    throw new Error('Claude yanıtında metin bloğu bulunamadı')
  }

  return qualificationSchema.parse(JSON.parse(textBlock.text))
}
```

- [ ] **Step 2: qualify.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.create }
  },
}))

import { qualifyLead } from './qualify'

function textResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] }
}

describe('qualifyLead', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('geçerli JSON yanıtını doğrulayıp döner', async () => {
    mocks.create.mockResolvedValue(
      textResponse({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    )
    const result = await qualifyLead('Acil bir web sitesine ihtiyacım var')
    expect(result).toEqual({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
  })

  it('metin bloğu yoksa hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [] })
    await expect(qualifyLead('talep')).rejects.toThrow('metin bloğu bulunamadı')
  })

  it('şemaya uymayan JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue(textResponse({ summary: 'eksik alanlar' }))
    await expect(qualifyLead('talep')).rejects.toThrow()
  })

  it('geçersiz JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [{ type: 'text', text: 'JSON değil' }] })
    await expect(qualifyLead('talep')).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/lib/qualify.test.ts`
Expected: 4 test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/crm/src/lib/qualify.ts apps/crm/src/lib/qualify.test.ts
git commit -m "FaydaLab CRM: Claude ile AI lead kalifikasyon kütüphanesi"
```

---

## Task 6: Lead Veri Katmanı + POST /api/leads

**Files:**
- Create: `apps/crm/src/lib/leads.ts`
- Create: `apps/crm/src/lib/leads.test.ts`
- Create: `apps/crm/src/app/api/leads/route.ts`
- Create: `apps/crm/src/app/api/leads/route.test.ts`

**Interfaces:**
- Consumes: `prisma.lead` (Task 2), `qualifyLead` (Task 5, `@/lib/qualify`), `sendAlert` (Task 4, `@/lib/telegram`), `isRateLimited` (Task 3, `@/lib/rate-limit`).
- Produces: `createLeadSchema` (zod), `createLead(input: CreateLeadInput): Promise<Lead>`, `runQualification(leadId: string): Promise<void>` (hepsi `@/lib/leads`'ten) — Task 7'deki Vapi webhook route'u `createLeadSchema`, `createLead` ve `runQualification`'ı bire bir aynı şekilde kullanır. `POST /api/leads` endpoint'i — Task 10'daki website entegrasyonu buraya POST atar.

- [ ] **Step 1: leads.ts oluştur**

```ts
import { z } from 'zod'
import type { Prisma, LeadSource } from '@prisma/client'
import { prisma } from './db'
import { qualifyLead } from './qualify'
import { sendAlert } from './telegram'

export const createLeadSchema = z
  .object({
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    requestText: z.string().min(1).max(5000),
    source: z.enum(['WEBSITE', 'VAPI']),
    sourceMeta: z.unknown(),
  })
  .refine((data) => Boolean(data.phone) || Boolean(data.email), {
    message: 'phone veya email alanlarından en az biri gerekli',
    path: ['phone'],
  })

export type CreateLeadInput = z.infer<typeof createLeadSchema>

export async function createLead(input: CreateLeadInput) {
  return prisma.lead.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      requestText: input.requestText,
      source: input.source as LeadSource,
      sourceMeta: input.sourceMeta as Prisma.InputJsonValue,
    },
  })
}

export async function runQualification(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return

  try {
    const result = await qualifyLead(lead.requestText)
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiSummary: result.summary,
        aiCategory: result.category,
        aiUrgency: result.urgency,
        aiScore: result.score,
      },
    })
    await sendAlert(
      `Yeni lead (${lead.source}): ${lead.name}\n` +
        `Özet: ${result.summary}\n` +
        `Kategori: ${result.category} | Aciliyet: ${result.urgency} | Skor: ${result.score}/5`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.lead.update({ where: { id: leadId }, data: { aiError: message } })
    await sendAlert(`Yeni lead (${lead.source}): ${lead.name}\nAI değerlendirmesi başarısız: ${message}`)
  }
}
```

- [ ] **Step 2: leads.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  qualifyLead: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { lead: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/qualify', () => ({ qualifyLead: mocks.qualifyLead }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))

import { createLead, runQualification, createLeadSchema } from './leads'

describe('createLeadSchema', () => {
  it('phone ve email ikisi de eksikse doğrulama başarısız olur', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      requestText: 'Web sitesi istiyorum',
      source: 'WEBSITE',
      sourceMeta: {},
    })
    expect(result.success).toBe(false)
  })

  it('sadece phone ile doğrulama başarılı olur', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'VAPI',
      sourceMeta: {},
    })
    expect(result.success).toBe(true)
  })
})

describe('createLead', () => {
  beforeEach(() => {
    mocks.create.mockReset()
  })

  it('geçerli veriyle prisma.lead.create çağırır', async () => {
    mocks.create.mockResolvedValue({ id: 'lead-1' })
    await createLead({
      name: 'Ali',
      phone: '5551234567',
      requestText: 'Web sitesi istiyorum',
      source: 'WEBSITE',
      sourceMeta: { foo: 'bar' },
    })
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        name: 'Ali',
        phone: '5551234567',
        email: undefined,
        requestText: 'Web sitesi istiyorum',
        source: 'WEBSITE',
        sourceMeta: { foo: 'bar' },
      },
    })
  })
})

describe('runQualification', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
    mocks.qualifyLead.mockReset()
    mocks.sendAlert.mockReset()
  })

  it('lead bulunamazsa hiçbir şey yapmaz', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await runQualification('lead-1')
    expect(mocks.qualifyLead).not.toHaveBeenCalled()
  })

  it('başarılı kalifikasyonda Lead güncellenir ve bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockResolvedValue({ summary: 'özet', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    await runQualification('lead-1')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { aiSummary: 'özet', aiCategory: 'Web Sitesi', aiUrgency: 'YUKSEK', aiScore: 5 },
    })
    expect(mocks.sendAlert).toHaveBeenCalledOnce()
  })

  it('kalifikasyon başarısız olursa Lead aiError ile güncellenir ve yine de bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockRejectedValue(new Error('API hatası'))
    await runQualification('lead-1')
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { aiError: 'API hatası' } })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('AI değerlendirmesi başarısız'))
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/lib/leads.test.ts`
Expected: 6 test PASS.

- [ ] **Step 4: POST /api/leads route.ts oluştur**

```ts
import { NextResponse, after } from 'next/server'
import { createLeadSchema, createLead, runQualification } from '@/lib/leads'
import { isRateLimited } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip, 20, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead(parsed.data)
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
```

- [ ] **Step 5: route.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
}))

vi.mock('@/lib/leads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...actual, createLead: mocks.createLead, runQualification: mocks.runQualification }
})
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
  })

  it('geçersiz body için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }))
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçerli body ile lead oluşturur ve 201 döner', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-1' })
    const response = await POST(
      makeRequest({
        name: 'Ali',
        phone: '5551234567',
        requestText: 'Web sitesi istiyorum',
        source: 'WEBSITE',
        sourceMeta: {},
      })
    )
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.id).toBe('lead-1')
    expect(mocks.runQualification).toHaveBeenCalledWith('lead-1')
  })
})
```

- [ ] **Step 6: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/app/api/leads/route.test.ts`
Expected: 2 test PASS.

- [ ] **Step 7: Tüm testleri, typecheck ve build'i çalıştır**

Run: `npm test && npm run typecheck && npm run build`
Expected: Tüm testler PASS, typecheck ve build hatasız.

- [ ] **Step 8: Commit**

```bash
git add apps/crm/src/lib/leads.ts apps/crm/src/lib/leads.test.ts apps/crm/src/app/api/leads
git commit -m "FaydaLab CRM: lead veri katmanı ve POST /api/leads ingestion endpoint'i"
```

---

## Task 7: Vapi Webhook Route

**Files:**
- Create: `apps/crm/src/app/api/webhooks/vapi/route.ts`
- Create: `apps/crm/src/app/api/webhooks/vapi/route.test.ts`

**Interfaces:**
- Consumes: `createLead`, `runQualification` (Task 6, `@/lib/leads`).
- Produces: `POST /api/webhooks/vapi?token=...` endpoint — Task ile ilgisiz olarak, implementasyon tamamlandıktan sonra controller `vapi-telesekreter` reposundaki `assistant.json`'ı bu URL'e yönlendirecek (bu repoya dahil değil, ayrı manuel adım).

Referans: `vapi-telesekreter/apps-script.js`'teki mevcut ayrıştırma mantığı (`message.type === 'end-of-call-report'`, `analysis.structuredData.{name,phone,request}`, yoksa `analysis.summary`, arayan numarası `call.customer.number`) birebir bu route'a taşınıyor.

- [ ] **Step 1: route.ts oluştur**

```ts
import { NextResponse, after } from 'next/server'
import { createLead, runQualification } from '@/lib/leads'

interface VapiEndOfCallBody {
  message?: {
    type?: string
    call?: { customer?: { number?: string } }
    analysis?: {
      summary?: string
      structuredData?: { name?: string; phone?: string; request?: string }
    }
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!process.env.VAPI_WEBHOOK_SECRET || token !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as VapiEndOfCallBody
  const message = body.message

  if (message?.type !== 'end-of-call-report') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const structured = message.analysis?.structuredData ?? {}
  const callerNumber = message.call?.customer?.number ?? 'Bilinmiyor'
  const name = structured.name ?? 'Belirtilmedi'
  const phone = structured.phone ?? callerNumber
  const requestText = structured.request ?? message.analysis?.summary ?? 'Belirtilmedi'

  const lead = await createLead({
    name,
    phone,
    requestText,
    source: 'VAPI',
    sourceMeta: body as unknown,
  })
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
```

- [ ] **Step 2: route.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
}))

vi.mock('@/lib/leads', () => ({ createLead: mocks.createLead, runQualification: mocks.runQualification }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

function makeRequest(body: unknown, token = 'correct-secret'): Request {
  return new Request(`http://localhost/api/webhooks/vapi?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/vapi', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
    process.env.VAPI_WEBHOOK_SECRET = 'correct-secret'
  })

  it('yanlış token ile 403 döner', async () => {
    const response = await POST(makeRequest({}, 'wrong-secret'))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('end-of-call-report olmayan mesajları yok sayar', async () => {
    const response = await POST(makeRequest({ message: { type: 'status-update' } }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ignored).toBe(true)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('structuredData varsa ondan lead oluşturur', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-1' })
    const response = await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { customer: { number: '+905551112233' } },
          analysis: { structuredData: { name: 'Ayşe', phone: '5551112233', request: 'QR menü istiyor' } },
        },
      })
    )
    expect(response.status).toBe(201)
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: 'Ayşe',
      phone: '5551112233',
      requestText: 'QR menü istiyor',
      source: 'VAPI',
      sourceMeta: expect.any(Object),
    })
    expect(mocks.runQualification).toHaveBeenCalledWith('lead-1')
  })

  it('structuredData eksikse call.customer.number ve analysis.summary fallback kullanılır', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-2' })
    await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { customer: { number: '+905559998877' } },
          analysis: { summary: 'Genel bilgi talebi' },
        },
      })
    )
    expect(mocks.createLead).toHaveBeenCalledWith({
      name: 'Belirtilmedi',
      phone: '+905559998877',
      requestText: 'Genel bilgi talebi',
      source: 'VAPI',
      sourceMeta: expect.any(Object),
    })
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/app/api/webhooks/vapi/route.test.ts`
Expected: 4 test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/crm/src/app/api/webhooks
git commit -m "FaydaLab CRM: Vapi end-of-call-report webhook endpoint'i"
```

---

## Task 8: Admin Panel Layout + Navigasyon + Lead Listesi Sayfası

**Files:**
- Create: `apps/crm/src/components/AdminNav.tsx`
- Create: `apps/crm/src/app/admin/(protected)/layout.tsx`
- Create: `apps/crm/src/app/admin/(protected)/leads/page.tsx`

**Interfaces:**
- Consumes: `requireSession` (Task 3, `@/lib/auth`), `prisma.lead` (Task 2).
- Produces: `/admin/leads` sayfası — Task 9'daki lead detay sayfası buraya bir "geri" linkiyle bağlanır, aynı `AdminNav`'ı paylaşır.

- [ ] **Step 1: AdminNav.tsx oluştur**

```tsx
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
      <div className="flex gap-6 text-brand-text">
        <Link href="/admin/leads">Lead&apos;ler</Link>
      </div>
      <button onClick={handleLogout} className="text-sm text-brand-muted underline">
        Çıkış Yap
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: protected layout.tsx oluştur**

```tsx
import { AdminNav } from '@/components/AdminNav'

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: leads/page.tsx oluştur**

Durum ve kaynak filtreleri URL query param'ları ile çalışır (`?status=YENI&source=WEBSITE`), böylece sayfa server component olarak kalabilir (client-side state gerekmez).

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import type { LeadStatus, LeadSource } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<LeadStatus, string> = {
  YENI: 'Yeni',
  DEGERLENDIRILDI: 'Değerlendirildi',
  ILETISIMDE: 'İletişimde',
  KAZANILDI: 'Kazanıldı',
  KAYBEDILDI: 'Kaybedildi',
}

const URGENCY_COLORS: Record<string, string> = {
  DUSUK: 'text-green-400',
  ORTA: 'text-yellow-400',
  YUKSEK: 'text-red-400',
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>
}) {
  const userId = await requireSession()
  if (!userId) {
    redirect('/admin/login')
  }

  const { status, source } = await searchParams
  const leads = await prisma.lead.findMany({
    where: {
      status: status ? (status as LeadStatus) : undefined,
      source: source ? (source as LeadSource) : undefined,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">Lead&apos;ler</h1>
      <div className="mb-4 flex gap-4 text-sm">
        <a href="/admin/leads" className="text-brand-gold underline">
          Tüm Durumlar
        </a>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <a key={value} href={`/admin/leads?status=${value}`} className="text-brand-muted underline">
            {label}
          </a>
        ))}
      </div>
      <div className="mb-6 flex gap-4 text-sm">
        <a href="/admin/leads?source=WEBSITE" className="text-brand-muted underline">
          Web Sitesi
        </a>
        <a href="/admin/leads?source=VAPI" className="text-brand-muted underline">
          Vapi
        </a>
      </div>
      {leads.length === 0 && <p className="text-brand-muted">Kayıt bulunamadı.</p>}
      <div className="flex flex-col gap-3">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/admin/leads/${lead.id}`}
            className="rounded border border-brand-border p-4 hover:border-brand-gold/50"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-brand-text">
                {lead.name} — {lead.source === 'WEBSITE' ? 'Web Sitesi' : 'Vapi'}
              </p>
              <span className="text-xs text-brand-muted">{STATUS_LABELS[lead.status]}</span>
            </div>
            {lead.aiSummary ? (
              <p className="mt-1 text-sm text-brand-muted">
                {lead.aiSummary}{' '}
                {lead.aiUrgency && (
                  <span className={URGENCY_COLORS[lead.aiUrgency]}>({lead.aiUrgency})</span>
                )}
                {lead.aiScore && <span> — Skor: {lead.aiScore}/5</span>}
              </p>
            ) : lead.aiError ? (
              <p className="mt-1 text-sm text-red-400">AI değerlendirmesi başarısız</p>
            ) : (
              <p className="mt-1 text-sm text-brand-muted">AI değerlendirmesi bekleniyor...</p>
            )}
            <p className="mt-2 text-xs text-brand-muted">{lead.createdAt.toLocaleString('tr-TR')}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: typecheck ve build ile doğrula**

Run: `npm run typecheck && npm run build`
Expected: Hatasız tamamlanır. (Bu görevde otomatik test yazılmaz — Global Constraints'e göre admin UI bileşenleri test kapsamı dışı.)

- [ ] **Step 5: Commit**

```bash
git add apps/crm/src/components apps/crm/src/app/admin
git commit -m "FaydaLab CRM: admin panel layout, navigasyon ve lead listesi sayfası"
```

---

## Task 9: Lead Detay Sayfası + PATCH /api/admin/leads/[id]

**Files:**
- Create: `apps/crm/src/app/admin/(protected)/leads/[id]/page.tsx`
- Create: `apps/crm/src/components/LeadStatusForm.tsx`
- Create: `apps/crm/src/app/api/admin/leads/[id]/route.ts`
- Create: `apps/crm/src/app/api/admin/leads/[id]/route.test.ts`

**Interfaces:**
- Consumes: `requireSession` (Task 3), `prisma.lead` (Task 2).
- Produces: `/admin/leads/[id]` sayfası, `PATCH /api/admin/leads/[id]` endpoint'i.

- [ ] **Step 1: PATCH route.ts oluştur**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['YENI', 'DEGERLENDIRILDI', 'ILETISIMDE', 'KAZANILDI', 'KAYBEDILDI']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const lead = await prisma.lead.update({ where: { id }, data: { status: parsed.data.status } })
    return NextResponse.json(lead)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 })
    }
    throw error
  }
}
```

- [ ] **Step 2: route.test.ts oluştur**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { lead: { update: mocks.update } } }))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue('user-1') }))

import { PATCH } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/leads/lead-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/leads/[id]', () => {
  beforeEach(() => {
    mocks.update.mockReset()
  })

  it('geçersiz status için 400 döner', async () => {
    const response = await PATCH(makeRequest({ status: 'GECERSIZ' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('geçerli status ile günceller', async () => {
    mocks.update.mockResolvedValue({ id: 'lead-1', status: 'ILETISIMDE' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { status: 'ILETISIMDE' } })
  })

  it('bulunamayan lead için 404 döner', async () => {
    mocks.update.mockRejectedValue({ code: 'P2025' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 3: Testleri çalıştır ve geçtiğini doğrula**

Run: `npx vitest run src/app/api/admin/leads/[id]/route.test.ts`
Expected: 3 test PASS.

- [ ] **Step 4: LeadStatusForm.tsx oluştur**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LeadStatus } from '@prisma/client'

const STATUS_LABELS: Record<LeadStatus, string> = {
  YENI: 'Yeni',
  DEGERLENDIRILDI: 'Değerlendirildi',
  ILETISIMDE: 'İletişimde',
  KAZANILDI: 'Kazanıldı',
  KAYBEDILDI: 'Kaybedildi',
}

export function LeadStatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: LeadStatus }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value }),
    })
    setSaving(false)
    if (!res.ok) {
      setError('Durum güncellenemedi')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={saving}
        className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value} className="bg-brand-bg">
            {label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: leads/[id]/page.tsx oluştur**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { LeadStatusForm } from '@/components/LeadStatusForm'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireSession()
  if (!userId) {
    redirect('/admin/login')
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) {
    notFound()
  }

  return (
    <div>
      <Link href="/admin/leads" className="text-sm text-brand-muted underline">
        ← Lead&apos;ler
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-semibold text-brand-text">{lead.name}</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {lead.source === 'WEBSITE' ? 'Web Sitesi' : 'Vapi'} — {lead.createdAt.toLocaleString('tr-TR')}
      </p>

      <div className="mb-6 flex flex-col gap-1 text-sm text-brand-text">
        {lead.phone && <p>Telefon: {lead.phone}</p>}
        {lead.email && <p>E-posta: {lead.email}</p>}
      </div>

      <div className="mb-6 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Talep</p>
        <p className="text-sm text-brand-muted">{lead.requestText}</p>
      </div>

      <div className="mb-6 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">AI Değerlendirmesi</p>
        {lead.aiSummary ? (
          <div className="flex flex-col gap-1 text-sm text-brand-muted">
            <p>Özet: {lead.aiSummary}</p>
            <p>Kategori: {lead.aiCategory}</p>
            <p>Aciliyet: {lead.aiUrgency}</p>
            <p>Skor: {lead.aiScore}/5</p>
          </div>
        ) : lead.aiError ? (
          <p className="text-sm text-red-400">Başarısız: {lead.aiError}</p>
        ) : (
          <p className="text-sm text-brand-muted">Bekleniyor...</p>
        )}
      </div>

      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold text-brand-text">Durum</p>
        <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
      </div>

      <details className="text-xs text-brand-muted">
        <summary className="cursor-pointer">Ham kaynak verisi (debug)</summary>
        <pre className="mt-2 overflow-x-auto rounded border border-brand-border p-3">
          {JSON.stringify(lead.sourceMeta, null, 2)}
        </pre>
      </details>
    </div>
  )
}
```

- [ ] **Step 6: typecheck ve build ile doğrula**

Run: `npm run typecheck && npm run build`
Expected: Hatasız tamamlanır.

- [ ] **Step 7: Tüm testleri çalıştır**

Run: `npm test`
Expected: Tüm testler PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/crm/src/app/admin apps/crm/src/components/LeadStatusForm.tsx apps/crm/src/app/api/admin
git commit -m "FaydaLab CRM: lead detay sayfası ve durum güncelleme endpoint'i"
```

---

## Task 10: apps/website Entegrasyonu

**Files:**
- Modify: `apps/website/src/app/api/contact/route.ts`
- Modify: `apps/website/src/app/api/contact/route.test.ts`
- Modify: `apps/website/.env.example`

**Interfaces:**
- Consumes: `apps/crm`'in `POST /api/leads` endpoint'i (Task 6) — CRM'in canlı URL'i `CRM_API_URL` env var'ı olarak website'e eklenir.

- [ ] **Step 1: Mevcut apps/website/src/app/api/contact/route.ts dosyasını oku ve mevcut testleri incele**

Bu adım kod yazmaz — mevcut dosyanın (`apps/website/src/app/api/contact/route.ts`) tam içeriğini ve `apps/website/src/app/api/contact/route.test.ts`'i oku, mevcut `contactSchema`/`sendAlert` çağrısını bul.

- [ ] **Step 2: forwardToCrm best-effort yardımcı fonksiyonunu route.ts'e ekle ve POST handler'ında çağır**

`apps/website/src/app/api/contact/route.ts` dosyasının en altına (mevcut `POST` fonksiyonundan önce) şu fonksiyonu ekle:

```ts
// CRM'e lead iletimi best-effort'tur: CRM_API_URL tanımlı değilse veya istek
// başarısız olursa website'in kendi contact akışı ASLA bundan etkilenmemeli.
async function forwardToCrm(data: { name: string; email: string; message: string }): Promise<void> {
  const crmUrl = process.env.CRM_API_URL
  if (!crmUrl) return

  try {
    await fetch(`${crmUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        requestText: data.message,
        source: 'WEBSITE',
        sourceMeta: { email: data.email },
      }),
    })
  } catch (error) {
    console.error('CRM lead iletimi başarısız:', error)
  }
}
```

Sonra mevcut `POST` fonksiyonundaki şu satırı:

```ts
  const saved = await prisma.contactMessage.create({ data: parsed.data })
  await sendAlert(`Yeni iletişim mesajı:\n${parsed.data.name} (${parsed.data.email})\n${parsed.data.message}`)
```

şu şekilde değiştir (yeni satır eklenir, mevcut iki satır aynı kalır):

```ts
  const saved = await prisma.contactMessage.create({ data: parsed.data })
  await sendAlert(`Yeni iletişim mesajı:\n${parsed.data.name} (${parsed.data.email})\n${parsed.data.message}`)
  await forwardToCrm(parsed.data)
```

- [ ] **Step 3: Mevcut route.test.ts'e yeni test senaryoları ekle**

`apps/website/src/app/api/contact/route.test.ts` dosyasındaki mevcut `vi.mock`'lara dokunma, sadece dosyanın en altına yeni bir `describe` bloğu ekle:

```ts
describe('forwardToCrm entegrasyonu', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRM_API_URL
  })

  it('CRM_API_URL tanımlıysa CRM /api/leads endpoint\'ine POST atar', async () => {
    process.env.CRM_API_URL = 'https://crm.example.com'
    await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }))
    expect(fetch).toHaveBeenCalledWith(
      'https://crm.example.com/api/leads',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('CRM_API_URL tanımlı değilse fetch çağırmaz', async () => {
    delete process.env.CRM_API_URL
    await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('CRM isteği başarısız olsa da contact akışı 201 döner', async () => {
    process.env.CRM_API_URL = 'https://crm.example.com'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ hatası')))
    const response = await POST(makeRequest({ name: 'Ali', email: 'ali@example.com', message: 'Merhaba' }))
    expect(response.status).toBe(201)
  })
})
```

Not: Bu dosyada zaten bir `makeRequest` yardımcı fonksiyonu tanımlıysa onu kullan; tanımlı değilse mevcut testlerin nasıl `POST` çağırdığına bakıp aynı deseni kullan (`new Request('http://localhost/api/contact', { method: 'POST', ... })`).

- [ ] **Step 4: .env.example'a CRM_API_URL ekle**

`apps/website/.env.example` dosyasının sonuna şu satırı ekle:

```
CRM_API_URL=""
```

- [ ] **Step 5: Testleri çalıştır ve geçtiğini doğrula**

Run: `cd apps/website && npx vitest run src/app/api/contact/route.test.ts`
Expected: Mevcut testler + yeni 3 test, hepsi PASS.

- [ ] **Step 6: typecheck ve build ile doğrula**

Run: `npm run typecheck && npm run build`
Expected: Hatasız tamamlanır.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/app/api/contact apps/website/.env.example
git commit -m "apps/website: iletişim formu lead'lerini CRM'e best-effort ilet"
```

---

## Görev Sonrası Manuel Adımlar (Controller, subagent kapsamı dışı)

Bu adımlar gerçek kimlik bilgileri/altyapı gerektirdiği için subagent'lara değil, controller'a (insan onaylı oturum) aittir — website projesinde de aynı desen izlendi:

1. Vercel'de yeni `crm` projesi oluştur (`apps/crm` root directory), Neon Postgres + gerekli env var'ları bağla (`DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VAPI_WEBHOOK_SECRET`, `CRM_INGEST_SECRET`).
2. `prisma migrate dev` ile ilk migration'ı gerçek DB'ye karşı oluştur ve uygula, `db:seed` ile ilk `AdminUser`'ı oluştur. Oluşan `apps/crm/prisma/migrations/` klasörünü commit'le — Vercel build'i migration'ları bu klasör olmadan uygulayamaz.
3. `apps/website`'in Vercel env var'larına `CRM_API_URL` ve `CRM_INGEST_SECRET` (Adım 1'de üretilenle aynı değer) ekle.
4. Telegram bot token'ını BotFather üzerinden yenile (rotate); yeni token'ı hem `apps/crm` hem gerekiyorsa diğer paylaşan projelerin env'ine yaz.
5. Yeni bir `VAPI_WEBHOOK_SECRET` üret, `apps/crm` env'ine yaz; `vapi-telesekreter/assistant.json`'daki `server.url`'i `https://<crm-domain>/api/webhooks/vapi?token=<yeni-secret>` olarak güncelle (ayrı repo, bu depo dışı bir işlem).
6. Canlıda uçtan uca doğrula: web sitesinden bir test mesajı gönder → CRM'de lead görünüyor mu, Telegram bildirimi geldi mi kontrol et.
