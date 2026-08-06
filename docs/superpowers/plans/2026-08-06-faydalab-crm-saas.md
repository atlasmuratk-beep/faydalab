# FaydaLab CRM SaaS (Faz 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/crm`'i (Faz 3a'da inşa edilen tek-kiracılı lead yönetim uygulaması) çok-kiracılı (multi-tenant), self-servis abonelik ürününe ("FaydaLab CRM") dönüştürmek.

**Architecture:** Tek uygulama + paylaşımlı Postgres DB, her satır bir `Tenant`'a bağlı. Kimlik doğrulama e-posta tabanlı, session cookie artık `tenantId` de taşıyor. Lead alımı (webhook'lar) artık global env-var secret yerine veritabanında saklanan, tenant'a özel `ingestSecret` ile çalışıyor. Stripe Checkout ile self-servis abonelik, plan limitleri AI kalifikasyon davranışını kısıtlıyor.

**Tech Stack:** Next.js (App Router) + TypeScript + Prisma + Postgres (Neon) + Vitest, `bcryptjs`, `@anthropic-ai/sdk`, yeni: `stripe` (server-side SDK).

## Global Constraints

- Ürün adı: **FaydaLab CRM**.
- Session cookie adı `faydalab_crm_session` korunur; HMAC-SHA256 imzalı, 30 gün geçerli.
- Ücretlendirme: Başlangıç ₺499/ay (50 lead/ay sınırı, kısaltılmış AI kalifikasyonu — sadece kategori+aciliyet), Pro ₺1.499/ay (sınırsız lead, tam AI kalifikasyonu — özet+kategori+aciliyet+skor).
- Deneme süresi: kayıt olduktan sonra 14 gün, `subscriptionStatus = TRIALING`.
- `apps/crm` hiçbir zaman gerçek bir veritabanına bağlanmadı (`prisma/migrations/` klasörü yok, `.vercel` yok, `.env.local` yok) — bu planda korunacak gerçek production verisi **yok**. `schema.prisma` doğrudan final çok-kiracılı haline yazılır, additive/backfill/enforce göçü gerekmez.
- Yerel/test ortamında gerçek DB bağlantısı olmadığından, hiçbir görev `prisma migrate dev`'i gerçek bir Postgres'e karşı çalıştırmaz. Şema değişikliklerinden sonra sadece `npm run db:generate` (yani `prisma generate` — DB bağlantısı gerektirmez, sadece TypeScript client'ını şemadan yeniden üretir) çalıştırılır. Gerçek migration, bu SaaS kodu tamamlandıktan sonraki production-kurulum adımında (ayrı, bu plan dışı bir iş) ilk kez uygulanacak.
- Lead alım anahtarı (`Tenant.ingestSecret`) doğrulaması **`secureCompare`/`timingSafeEqual` ile değil**, Prisma'nın `@unique` indeksli `findUnique({ where: { ingestSecret } })` sorgusuyla yapılır — bu, Stripe/GitHub gibi servislerin de API anahtarı doğrulamasında kullandığı standart desendir. `secureCompare`'in savunduğu bellek-içi bayt-bayt karşılaştırma zamanlama saldırısı, indeksli bir DB eşleşmesinde geçerli bir tehdit modeli değil. Bu nedenle bu planda mevcut `secure-compare.ts` dosyası **kullanılmayan kod haline gelip silinir** (Görev 2).
- Tüm yeni/değişen `lib/*.ts` ve `app/api/**/route.ts` dosyaları mevcut projedeki gibi `*.test.ts` ile birlikte gelir (mock'lanmış Prisma client deseni — bkz. mevcut `leads.test.ts`, `route.test.ts` dosyaları). Admin UI `page.tsx`/component dosyaları için mevcut projede otomatik test yok — bu kalıp korunur.
- Rate limiting: mevcut `isRateLimited(key, maxAttempts, windowMs)` (bellek-içi, `apps/crm/src/lib/rate-limit.ts`) aynen kullanılmaya devam eder; tenant-bazlı ek sınırlama bu planın kapsamı dışında.
- `next/server`'ın `after()` fonksiyonu (arka planda AI kalifikasyonunu tetiklemek için) korunur.

---

### Task 1: Tenant veri modeli + e-posta tabanlı, tenant-farkındalı auth

**Files:**
- Modify: `apps/crm/prisma/schema.prisma`
- Modify: `apps/crm/prisma/seed.ts`
- Modify: `apps/crm/src/lib/session.ts`
- Test: `apps/crm/src/lib/session.test.ts`
- Modify: `apps/crm/src/lib/auth.ts`
- Modify: `apps/crm/src/middleware.ts`
- Test: `apps/crm/src/middleware.test.ts`
- Modify: `apps/crm/src/app/api/auth/login/route.ts`
- Test: `apps/crm/src/app/api/auth/login/route.test.ts`
- Modify: `apps/crm/src/app/admin/(public)/login/page.tsx`
- Modify: `apps/crm/.env.example`

**Interfaces:**
- Produces: `Tenant` Prisma modeli (`id, name, slug, plan: Plan, subscriptionStatus: SubscriptionStatus, trialEndsAt, stripeCustomerId, stripeSubscriptionId, ingestSecret, monthlyLeadCount, monthlyLeadCountResetAt`); `Plan` enum (`BASLANGIC`/`PRO`); `SubscriptionStatus` enum (`TRIALING`/`ACTIVE`/`PAST_DUE`/`CANCELED`); `AdminUser.email` (username yerine), `AdminUser.tenantId`; `Lead.tenantId`. `export interface SessionData { userId: string; tenantId: string }` (`session.ts`). `signSession(userId: string, tenantId: string): string`. `verifySession(token): SessionData | null`. `requireSession(): Promise<SessionData | null>` (`auth.ts`).
- Consumes: Yok (bu ilk görev).

- [ ] **Step 1: `schema.prisma`'yı final çok-kiracılı şemaya güncelle**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  BASLANGIC
  PRO
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
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

model Tenant {
  id                      String             @id @default(cuid())
  name                    String
  slug                    String             @unique
  plan                    Plan               @default(BASLANGIC)
  subscriptionStatus      SubscriptionStatus @default(TRIALING)
  trialEndsAt             DateTime?
  stripeCustomerId        String?            @unique
  stripeSubscriptionId    String?            @unique
  ingestSecret            String             @unique
  monthlyLeadCount        Int                @default(0)
  monthlyLeadCountResetAt DateTime           @default(now())
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  users AdminUser[]
  leads Lead[]
}

model Lead {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id])
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

  @@index([tenantId, status])
  @@index([tenantId, source])
}

model AdminUser {
  id           String @id @default(cuid())
  tenantId     String
  tenant       Tenant @relation(fields: [tenantId], references: [id])
  email        String @unique
  passwordHash String
}
```

- [ ] **Step 2: Prisma client'ı yeniden üret**

Run: `cd apps/crm && npm run db:generate`
Expected: `Generated Prisma Client` mesajı, hata yok (gerçek DB bağlantısı gerekmez, sadece şemadan client üretir).

- [ ] **Step 3: `session.ts`'i tenant-farkındalı yap**

```ts
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_crm_session'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface SessionData {
  userId: string
  tenantId: string
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string, tenantId: string): string {
  const payload = `${userId}.${tenantId}.${Date.now()}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySession(token: string | undefined | null): SessionData | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [userId, tenantId, issuedAtStr, sig] = parts
  const payload = `${userId}.${tenantId}.${issuedAtStr}`
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null
  return { userId, tenantId }
}
```

- [ ] **Step 4: `session.test.ts`'i güncelle**

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
    const token = signSession('user-1', 'tenant-1')
    expect(verifySession(token)).toEqual({ userId: 'user-1', tenantId: 'tenant-1' })
  })

  it('değiştirilmiş (tamper edilmiş) token reddedilir', () => {
    const token = signSession('user-1', 'tenant-1')
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
    const token = signSession('user-1', 'tenant-1')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(verifySession(token)).toBeNull()
  })

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1', 'tenant-1')).toThrow('ADMIN_SESSION_SECRET')
  })

  it('3 parçalı (eski formatlı) token reddedilir', () => {
    expect(verifySession('user-1.1234567890.deadbeef')).toBeNull()
  })
})
```

- [ ] **Step 5: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/session.test.ts`
Expected: 6/6 PASS

- [ ] **Step 6: `auth.ts`'i güncelle**

```ts
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE, type SessionData } from './session'

export async function requireSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifySession(token)
}
```

- [ ] **Step 7: `middleware.ts`'i güncelle**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = verifySession(token)
  if (!session) {
    if (req.nextUrl.pathname === '/admin/login') {
      return NextResponse.next()
    }
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

(Not: `/admin/signup` public yolu Görev 4'te eklenecek — bu görev sadece dönüş tipini `SessionData | null`'a taşıyor, davranış aynı kalıyor.)

- [ ] **Step 8: `middleware.test.ts`'i güncelle**

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
    vi.mocked(verifySession).mockReturnValue({ userId: 'user-1', tenantId: 'tenant-1' })
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

  it('/admin/login isteğini middleware\'den geçirir (session olmasa bile)', () => {
    vi.mocked(verifySession).mockReturnValue(null)
    const req = new NextRequest('http://localhost/admin/login')
    const res = middleware(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 9: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/middleware.test.ts`
Expected: 4/4 PASS

- [ ] **Step 10: `login/route.ts`'i e-posta tabanlı yap**

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signSession, SESSION_COOKIE } from '@/lib/session'
import { isRateLimited } from '@/lib/rate-limit'

// Zamanlama yan kanalı koruması: kullanıcı yoksa da bcrypt.compare çağrılacak
const DUMMY_HASH = '$2b$10$RhHop1MRdgOrzn.wsoB68OdJb0cQIupfd4j1r8VVYtPHH1EPA1Mm.'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) {
    return NextResponse.json({ error: 'Geçersiz e-posta veya şifre' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(user.id, user.tenantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
```

- [ ] **Step 11: `login/route.test.ts`'i e-posta alanına göre güncelle**

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
    const response = await POST(makeRequest({ email: 'admin@faydalab.app' }))
    expect(response.status).toBe(400)
  })

  it('kullanıcı bulunamazsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const response = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('şifre yanlışsa 401 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', email: 'admin@faydalab.app', tenantId: 'tenant-1', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(false)
    const response = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }))
    expect(response.status).toBe(401)
  })

  it('geçerli girişte 200 döner ve session cookie set eder', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1', email: 'admin@faydalab.app', tenantId: 'tenant-1', passwordHash: 'hash' })
    mocks.compare.mockResolvedValue(true)
    const response = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'correct' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('faydalab_crm_session=')
  })

  it('aynı IP dakikada 10 denemeden fazla yaparsa 429 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const ip = 'login-rate-limit-ip'
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }, ip))
      expect(response.status).toBe(401)
    }
    const eleventh = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }, ip))
    expect(eleventh.status).toBe(429)
  })

  it('x-forwarded-for zincirinin ilk halkası sahte olsa da son halkaya göre rate limitlenir', async () => {
    mocks.findUnique.mockResolvedValue(null)
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }, `${i}.${i}.${i}.${i}, spoof-resist-ip`))
      expect(response.status).toBe(401)
    }
    const eleventh = await POST(makeRequest({ email: 'admin@faydalab.app', password: 'wrong' }, '99.99.99.99, spoof-resist-ip'))
    expect(eleventh.status).toBe(429)
  })
})
```

- [ ] **Step 12: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/auth/login/route.test.ts`
Expected: 6/6 PASS

- [ ] **Step 13: Login sayfasındaki kullanıcı adı alanını e-postaya çevir**

`apps/crm/src/app/admin/(public)/login/page.tsx` içinde `name="username"` input'unu şununla değiştir:

```tsx
<input
  name="email"
  type="email"
  placeholder="E-posta"
  required
  className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
/>
```

Ve `handleSubmit` içindeki body'yi güncelle:

```ts
body: JSON.stringify({
  email: form.get('email'),
  password: form.get('password'),
}),
```

- [ ] **Step 14: Seed script'ini tenant-farkındalı yap**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL ve ADMIN_PASSWORD .env dosyasında tanımlı olmalı')
  }

  const ingestSecret = process.env.CRM_INGEST_SECRET ?? randomBytes(32).toString('hex')

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'faydalab' },
    create: {
      name: 'FaydaLab',
      slug: 'faydalab',
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      ingestSecret,
    },
    update: {},
  })

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, tenantId: tenant.id },
    update: { passwordHash },
  })

  console.log(`Seed tamamlandı. Tenant ingestSecret: ${tenant.ingestSecret}`)
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 15: `.env.example`'da `ADMIN_USERNAME`'i `ADMIN_EMAIL` ile değiştir**

```
DATABASE_URL=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_SESSION_SECRET=""
ANTHROPIC_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
VAPI_WEBHOOK_SECRET=""
CRM_INGEST_SECRET=""
```

(`VAPI_WEBHOOK_SECRET`/`CRM_INGEST_SECRET` Görev 2'de kaldırılacak — bu görevde henüz dokunma.)

- [ ] **Step 16: Tüm proje testlerini ve typecheck'i çalıştır**

Run: `cd apps/crm && npm run typecheck && npx vitest run`
Expected: typecheck hatasız; `leads.test.ts`, `qualify.test.ts`, `route.test.ts` dosyaları bu görevde henüz güncellenmediği için burada derleme hatası **olmamalı** (henüz `createLead`/`prisma.lead` çağrıları `tenantId` almıyor — o değişiklik Görev 2/3'te) ama şema değişikliği nedeniyle bazı mock'lanmış testler (örn. `admin/leads/[id]/route.test.ts`'in `requireSession` mock'u `'user-1'` string döndürüyor, artık `SessionData` objesi bekleniyor ama route kodu henüz değişmediği için bu testler halen `mockResolvedValue('user-1')` ile PASS olur — route kodu string'i obje gibi kullanmıyor). Eğer beklenmedik bir FAIL çıkarsa, hangi dosyanın Görev 2/3'ün kapsamına girdiğini kontrol et ve o testleri bu görevde değiştirme.

- [ ] **Step 17: Commit**

```bash
git add apps/crm/prisma/schema.prisma apps/crm/prisma/seed.ts apps/crm/src/lib/session.ts apps/crm/src/lib/session.test.ts apps/crm/src/lib/auth.ts apps/crm/src/middleware.ts apps/crm/src/middleware.test.ts apps/crm/src/app/api/auth/login/route.ts apps/crm/src/app/api/auth/login/route.test.ts "apps/crm/src/app/admin/(public)/login/page.tsx" apps/crm/.env.example
git commit -m "feat(crm): Tenant veri modeli ve e-posta tabanlı tenant-farkındalı auth"
```

---

### Task 2: Per-tenant lead alımı (ingestion)

**Files:**
- Modify: `apps/crm/src/lib/leads.ts`
- Test: `apps/crm/src/lib/leads.test.ts`
- New: `apps/crm/src/lib/tenant-ingest.ts`
- Test: `apps/crm/src/lib/tenant-ingest.test.ts`
- Modify: `apps/crm/src/app/api/leads/route.ts`
- Test: `apps/crm/src/app/api/leads/route.test.ts`
- Modify: `apps/crm/src/app/api/webhooks/vapi/route.ts`
- Test: `apps/crm/src/app/api/webhooks/vapi/route.test.ts`
- Delete: `apps/crm/src/lib/secure-compare.ts`
- Delete: `apps/crm/src/lib/secure-compare.test.ts`
- Modify: `apps/crm/.env.example`

**Interfaces:**
- Consumes: `SessionData`, `Tenant` modeli (Görev 1).
- Produces: `resolveTenantBySecret(secret: string | null): Promise<Tenant | null>` (`tenant-ingest.ts`). `createLead(input: CreateLeadInput, tenantId: string)` (yeni imza — Görev 3/5 bunu kullanacak).

- [ ] **Step 1: `tenant-ingest.ts` oluştur**

```ts
import { prisma } from './db'
import type { Tenant } from '@prisma/client'

export async function resolveTenantBySecret(secret: string | null): Promise<Tenant | null> {
  if (!secret) return null
  return prisma.tenant.findUnique({ where: { ingestSecret: secret } })
}
```

- [ ] **Step 2: `tenant-ingest.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUnique: mocks.findUnique } } }))

import { resolveTenantBySecret } from './tenant-ingest'

describe('resolveTenantBySecret', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
  })

  it('secret null ise sorgu yapmadan null döner', async () => {
    const result = await resolveTenantBySecret(null)
    expect(result).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('eşleşen tenant varsa döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'tenant-1', ingestSecret: 'abc' })
    const result = await resolveTenantBySecret('abc')
    expect(result).toEqual({ id: 'tenant-1', ingestSecret: 'abc' })
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { ingestSecret: 'abc' } })
  })

  it('eşleşme yoksa null döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const result = await resolveTenantBySecret('yanlış')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/tenant-ingest.test.ts`
Expected: 3/3 PASS

- [ ] **Step 4: `leads.ts`'te `createLead`'e `tenantId` parametresi ekle**

`createLead` fonksiyonunu şu şekilde değiştir (dosyanın geri kalanı, `runQualification` dahil, bu görevde **değişmez** — Görev 5'te değişecek):

```ts
export async function createLead(input: CreateLeadInput, tenantId: string) {
  return prisma.lead.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      requestText: input.requestText,
      source: input.source as LeadSource,
      sourceMeta: input.sourceMeta as Prisma.InputJsonValue,
    },
  })
}
```

- [ ] **Step 5: `leads.test.ts`'teki `createLead` testini güncelle**

`describe('createLead', ...)` bloğundaki testi şununla değiştir:

```ts
describe('createLead', () => {
  beforeEach(() => {
    mocks.create.mockReset()
  })

  it('geçerli veriyle prisma.lead.create çağırır', async () => {
    mocks.create.mockResolvedValue({ id: 'lead-1' })
    await createLead(
      {
        name: 'Ali',
        phone: '5551234567',
        requestText: 'Web sitesi istiyorum',
        source: 'WEBSITE',
        sourceMeta: { foo: 'bar' },
      },
      'tenant-1'
    )
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
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
```

- [ ] **Step 6: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/leads.test.ts`
Expected: `createLead` testi PASS. `runQualification` testleri bu görevde dokunulmadığı için değişmeden geçmeye devam eder.

- [ ] **Step 7: `/api/leads/route.ts`'i tenant-lookup kullanacak şekilde güncelle**

```ts
import { NextResponse, after } from 'next/server'
import { createLeadSchema, createLead, runQualification } from '@/lib/leads'
import { isRateLimited } from '@/lib/rate-limit'
import { resolveTenantBySecret } from '@/lib/tenant-ingest'

export async function POST(req: Request) {
  const secret = req.headers.get('x-crm-ingest-secret')
  const tenant = await resolveTenantBySecret(secret)
  if (!tenant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(ip, 20, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead(parsed.data, tenant.id)
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
```

- [ ] **Step 8: `/api/leads/route.test.ts`'i tenant-lookup mock'una göre güncelle**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
  resolveTenantBySecret: vi.fn(),
}))

vi.mock('@/lib/leads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...actual, createLead: mocks.createLead, runQualification: mocks.runQualification }
})
vi.mock('@/lib/tenant-ingest', () => ({ resolveTenantBySecret: mocks.resolveTenantBySecret }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

const VALID_SECRET = 'correct-ingest-secret'
const TENANT = { id: 'tenant-1', ingestSecret: VALID_SECRET }

function makeRequest(
  body: unknown,
  { ip = 'test-ip', secret = VALID_SECRET }: { ip?: string; secret?: string | null } = {}
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-forwarded-for': ip }
  if (secret !== null) headers['x-crm-ingest-secret'] = secret
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    mocks.createLead.mockReset()
    mocks.runQualification.mockReset().mockResolvedValue(undefined)
    mocks.resolveTenantBySecret.mockReset()
    mocks.resolveTenantBySecret.mockImplementation(async (secret: string | null) =>
      secret === VALID_SECRET ? TENANT : null
    )
  })

  it('secret header eksikse 403 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }, { secret: null }))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('yanlış secret header ile 403 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }, { secret: 'wrong-secret' }))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçersiz body için 400 döner', async () => {
    const response = await POST(makeRequest({ name: 'Ali' }))
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('bozuk JSON gövdesi için 400 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': 'test-ip',
          'x-crm-ingest-secret': VALID_SECRET,
        },
        body: '{invalid-json',
      })
    )
    expect(response.status).toBe(400)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('geçerli body ve doğru secret ile lead oluşturur ve 201 döner', async () => {
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
    expect(mocks.createLead).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ali' }), 'tenant-1')
    expect(mocks.runQualification).toHaveBeenCalledWith('lead-1')
  })
})
```

- [ ] **Step 9: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/leads/route.test.ts`
Expected: 5/5 PASS

- [ ] **Step 10: `/api/webhooks/vapi/route.ts`'i tenant-lookup kullanacak şekilde güncelle**

```ts
import { NextResponse, after } from 'next/server'
import { createLeadSchema, createLead, runQualification } from '@/lib/leads'
import { resolveTenantBySecret } from '@/lib/tenant-ingest'

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
  // Header tercih edilir (URL'ler sunucu erişim loglarında düz metin olarak kalabilir);
  // query param, Vapi'nin şu anki webhook yapılandırmasıyla geriye dönük uyumluluk için korunur.
  const secret = req.headers.get('x-vapi-webhook-secret') ?? url.searchParams.get('token')
  const tenant = await resolveTenantBySecret(secret)
  if (!tenant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: VapiEndOfCallBody
  try {
    body = (await req.json()) as VapiEndOfCallBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const message = body.message

  if (message?.type !== 'end-of-call-report') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const structured = message.analysis?.structuredData ?? {}
  const callerNumber = message.call?.customer?.number ?? 'Bilinmiyor'
  const name = structured.name ?? 'Belirtilmedi'
  const phone = structured.phone ?? callerNumber
  const requestText = structured.request ?? message.analysis?.summary ?? 'Belirtilmedi'

  const parsed = createLeadSchema.safeParse({
    name,
    phone,
    requestText,
    source: 'VAPI',
    sourceMeta: body as unknown,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead_data', details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead(parsed.data, tenant.id)
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
```

- [ ] **Step 11: `/api/webhooks/vapi/route.test.ts`'i tenant-lookup mock'una göre güncelle**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  runQualification: vi.fn(),
  resolveTenantBySecret: vi.fn(),
}))

vi.mock('@/lib/leads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...actual, createLead: mocks.createLead, runQualification: mocks.runQualification }
})
vi.mock('@/lib/tenant-ingest', () => ({ resolveTenantBySecret: mocks.resolveTenantBySecret }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => fn() }
})

import { POST } from './route'

const VALID_SECRET = 'correct-secret'
const TENANT = { id: 'tenant-1', ingestSecret: VALID_SECRET }

function makeRequest(body: unknown, token = VALID_SECRET): Request {
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
    mocks.resolveTenantBySecret.mockReset()
    mocks.resolveTenantBySecret.mockImplementation(async (secret: string | null) =>
      secret === VALID_SECRET ? TENANT : null
    )
  })

  it('yanlış token ile 403 döner', async () => {
    const response = await POST(makeRequest({}, 'wrong-secret'))
    expect(response.status).toBe(403)
    expect(mocks.createLead).not.toHaveBeenCalled()
  })

  it('x-vapi-webhook-secret header ile doğru secret gönderilirse kabul eder', async () => {
    mocks.createLead.mockResolvedValue({ id: 'lead-1' })
    const response = await POST(
      new Request('http://localhost/api/webhooks/vapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vapi-webhook-secret': VALID_SECRET },
        body: JSON.stringify({ message: { type: 'status-update' } }),
      })
    )
    expect(response.status).toBe(200)
  })

  it('header yanlışsa query param doğru olsa bile 403 döner (header önceliklidir)', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/vapi?token=correct-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vapi-webhook-secret': 'wrong-secret' },
        body: JSON.stringify({ message: { type: 'status-update' } }),
      })
    )
    expect(response.status).toBe(403)
  })

  it('bozuk JSON gövdesi için 400 döner', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/vapi?token=correct-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      })
    )
    expect(response.status).toBe(400)
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
    expect(mocks.createLead).toHaveBeenCalledWith(
      {
        name: 'Ayşe',
        phone: '5551112233',
        requestText: 'QR menü istiyor',
        source: 'VAPI',
        sourceMeta: expect.any(Object),
      },
      'tenant-1'
    )
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
    expect(mocks.createLead).toHaveBeenCalledWith(
      {
        name: 'Belirtilmedi',
        phone: '+905559998877',
        requestText: 'Genel bilgi talebi',
        source: 'VAPI',
        sourceMeta: expect.any(Object),
      },
      'tenant-1'
    )
  })
})
```

- [ ] **Step 12: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/webhooks/vapi/route.test.ts`
Expected: 7/7 PASS

- [ ] **Step 13: Kullanılmayan `secure-compare.ts` dosyalarını sil**

```bash
rm apps/crm/src/lib/secure-compare.ts apps/crm/src/lib/secure-compare.test.ts
```

(Global Constraints'te açıklandığı gibi: bu iki route artık `resolveTenantBySecret`'in indeksli DB sorgusunu kullanıyor, `secureCompare` hiçbir yerden import edilmiyor.)

- [ ] **Step 14: `.env.example`'dan artık kullanılmayan global secret'ları kaldır**

```
DATABASE_URL=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_SESSION_SECRET=""
ANTHROPIC_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

- [ ] **Step 15: Tüm proje testlerini ve typecheck'i çalıştır**

Run: `cd apps/crm && npm run typecheck && npx vitest run`
Expected: typecheck hatasız. `qualify.test.ts` ve `admin/leads/[id]/route.test.ts` bu görevde dokunulmadı, değişmeden PASS olmalı.

- [ ] **Step 16: Commit**

```bash
git add apps/crm/src/lib/leads.ts apps/crm/src/lib/leads.test.ts apps/crm/src/lib/tenant-ingest.ts apps/crm/src/lib/tenant-ingest.test.ts apps/crm/src/app/api/leads/route.ts apps/crm/src/app/api/leads/route.test.ts apps/crm/src/app/api/webhooks/vapi/route.ts apps/crm/src/app/api/webhooks/vapi/route.test.ts apps/crm/.env.example
git rm apps/crm/src/lib/secure-compare.ts apps/crm/src/lib/secure-compare.test.ts
git commit -m "feat(crm): per-tenant lead alım anahtarları (ingestSecret DB lookup)"
```

---

### Task 3: Admin panel tenant izolasyonu

**Files:**
- Modify: `apps/crm/src/app/admin/(protected)/leads/page.tsx`
- Modify: `apps/crm/src/app/admin/(protected)/leads/[id]/page.tsx`
- Modify: `apps/crm/src/app/api/admin/leads/[id]/route.ts`
- Test: `apps/crm/src/app/api/admin/leads/[id]/route.test.ts`

**Interfaces:**
- Consumes: `requireSession(): Promise<SessionData | null>` (Görev 1).
- Produces: Yok (bu görev sonrası tüm Lead sorguları `tenantId` ile filtreleniyor — sonraki görevler bunu varsayım olarak alabilir).

- [ ] **Step 1: `leads/page.tsx`'i tenant-scoped yap**

`requireSession()` çağrısının döndürdüğü değeri `session` olarak yakala, `prisma.lead.findMany`'ye `tenantId` filtresi ekle:

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
  const session = await requireSession()
  if (!session) {
    redirect('/admin/login')
  }

  const { status, source } = await searchParams
  const validStatus = status && status in STATUS_LABELS ? (status as LeadStatus) : undefined
  const validSource = source === 'WEBSITE' || source === 'VAPI' ? (source as LeadSource) : undefined
  const leads = await prisma.lead.findMany({
    where: {
      tenantId: session.tenantId,
      status: validStatus,
      source: validSource,
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

- [ ] **Step 2: `leads/[id]/page.tsx`'i tenant-scoped yap**

`prisma.lead.findUnique({ where: { id } })` çağrısını, tek başına `id` üzerinden aramanın başka bir tenant'ın lead'ini sızdırmasını önlemek için `findFirst({ where: { id, tenantId } })` ile değiştir:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { LeadStatusForm } from '@/components/LeadStatusForm'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  if (!session) {
    redirect('/admin/login')
  }

  const { id } = await params
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: session.tenantId } })
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

- [ ] **Step 3: `/api/admin/leads/[id]/route.ts`'i tenant-scoped yap**

`prisma.lead.update` tek başına `id` ile eşleşir; bunu `tenantId`'yi de içeren bir `updateMany` ile değiştiriyoruz ki bir kiracı başka bir kiracının lead'ini güncelleyemesin. `updateMany` eşleşme bulamazsa hata fırlatmaz (`count: 0` döner), bu da "bulunamadı" ile "başka tenant'a ait" durumlarını doğal olarak aynı 404 yanıtına indirger (varlık sızıntısı yok):

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['YENI', 'DEGERLENDIRILDI', 'ILETISIMDE', 'KAZANILDI', 'KAYBEDILDI']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await prisma.lead.updateMany({
    where: { id, tenantId: session.tenantId },
    data: { status: parsed.data.status },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Lead bulunamadı' }, { status: 404 })
  }

  const lead = await prisma.lead.findUnique({ where: { id } })
  return NextResponse.json(lead)
}
```

- [ ] **Step 4: `/api/admin/leads/[id]/route.test.ts`'i güncelle**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { lead: { updateMany: mocks.updateMany, findUnique: mocks.findUnique } } }))
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' }) }))

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
    mocks.updateMany.mockReset()
    mocks.findUnique.mockReset()
  })

  it('geçersiz status için 400 döner', async () => {
    const response = await PATCH(makeRequest({ status: 'GECERSIZ' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(400)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('geçerli status ile günceller', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', status: 'ILETISIMDE' })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-1' },
      data: { status: 'ILETISIMDE' },
    })
  })

  it('bulunamayan veya başka tenanta ait lead için 404 döner', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    const response = await PATCH(makeRequest({ status: 'ILETISIMDE' }), { params: Promise.resolve({ id: 'lead-1' }) })
    expect(response.status).toBe(404)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/admin/leads/`
Expected: 3/3 PASS

- [ ] **Step 6: Typecheck + tüm testler**

Run: `cd apps/crm && npm run typecheck && npx vitest run`
Expected: Tamamı yeşil.

- [ ] **Step 7: Commit**

```bash
git add "apps/crm/src/app/admin/(protected)/leads/page.tsx" "apps/crm/src/app/admin/(protected)/leads/[id]/page.tsx" "apps/crm/src/app/api/admin/leads/[id]/route.ts" "apps/crm/src/app/api/admin/leads/[id]/route.test.ts"
git commit -m "feat(crm): admin panelde lead sorgularını tenant'a göre izole et"
```

---

### Task 4: Kayıt (signup) akışı

**Files:**
- New: `apps/crm/src/lib/tenant.ts`
- Test: `apps/crm/src/lib/tenant.test.ts`
- New: `apps/crm/src/app/api/auth/signup/route.ts`
- Test: `apps/crm/src/app/api/auth/signup/route.test.ts`
- New: `apps/crm/src/app/admin/(public)/signup/page.tsx`
- Modify: `apps/crm/src/app/admin/(public)/login/page.tsx`
- Modify: `apps/crm/src/middleware.ts`
- Test: `apps/crm/src/middleware.test.ts`

**Interfaces:**
- Consumes: `signSession`, `SESSION_COOKIE` (Görev 1); `isRateLimited` (mevcut `rate-limit.ts`).
- Produces: `createTenant(name: string): Promise<Tenant>` (`tenant.ts`) — bu görevdeki signup route'u tarafından çağrılır; yeni tenant oluşturmanın tek yolu budur.

- [ ] **Step 1: `tenant.ts` oluştur (slug + ingestSecret üretimi)**

```ts
import { randomBytes } from 'crypto'
import { prisma } from './db'
import type { Tenant } from '@prisma/client'

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  return base || 'isletme'
}

export async function createTenant(name: string): Promise<Tenant> {
  const base = slugify(name)
  let slug = base
  let attempt = 0
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${attempt}`
  }

  return prisma.tenant.create({
    data: {
      name,
      slug,
      ingestSecret: randomBytes(32).toString('hex'),
      trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
    },
  })
}
```

- [ ] **Step 2: `tenant.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUnique: mocks.findUnique, create: mocks.create } } }))

import { createTenant } from './tenant'

describe('createTenant', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.create.mockReset()
  })

  it('işletme adından slug üretir', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'tenant-1', slug: 'gazi-usta-kebap' })
    await createTenant('Gazi-Usta Kebap')
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'gazi-usta-kebap', name: 'Gazi-Usta Kebap' }) })
    )
  })

  it('slug çakışırsa sayı ekleyerek benzersizleştirir', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null)
    mocks.create.mockResolvedValue({ id: 'tenant-2', slug: 'kafe-1' })
    await createTenant('Kafe')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: 'kafe-1' }) }))
  })

  it('deneme bitiş tarihini 14 gün sonrasına ayarlar', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'tenant-1' })
    const before = Date.now()
    await createTenant('Test')
    const call = mocks.create.mock.calls[0][0]
    const trialEndsAt = call.data.trialEndsAt as Date
    expect(trialEndsAt.getTime()).toBeGreaterThan(before + 13 * 24 * 60 * 60 * 1000)
    expect(trialEndsAt.getTime()).toBeLessThan(before + 15 * 24 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 3: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/tenant.test.ts`
Expected: 3/3 PASS

- [ ] **Step 4: `/api/auth/signup/route.ts` oluştur**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createTenant } from '@/lib/tenant'
import { signSession, SESSION_COOKIE } from '@/lib/session'
import { isRateLimited } from '@/lib/rate-limit'

const signupSchema = z.object({
  businessName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json({ error: 'Bu e-posta ile zaten bir hesap var' }, { status: 409 })
  }

  const tenant = await createTenant(parsed.data.businessName)
  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  const user = await prisma.adminUser.create({
    data: { email: parsed.data.email, passwordHash, tenantId: tenant.id },
  })

  const res = NextResponse.json({ ok: true }, { status: 201 })
  res.cookies.set(SESSION_COOKIE, signSession(user.id, tenant.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
```

- [ ] **Step 5: `/api/auth/signup/route.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  createTenant: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { adminUser: { findUnique: mocks.findUnique, create: mocks.create } } }))
vi.mock('@/lib/tenant', () => ({ createTenant: mocks.createTenant }))

import { POST } from './route'

function makeRequest(body: unknown, ip = 'test-ip'): Request {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.create.mockReset()
    mocks.createTenant.mockReset()
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('eksik alanlarda 400 döner', async () => {
    const response = await POST(makeRequest({ email: 'a@b.com' }))
    expect(response.status).toBe(400)
  })

  it('8 karakterden kısa şifre reddedilir', async () => {
    const response = await POST(makeRequest({ businessName: 'Test', email: 'a@b.com', password: '1234567' }))
    expect(response.status).toBe(400)
  })

  it('e-posta zaten kayıtlıysa 409 döner', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'existing' })
    const response = await POST(makeRequest({ businessName: 'Test', email: 'a@b.com', password: 'sifre1234' }))
    expect(response.status).toBe(409)
    expect(mocks.createTenant).not.toHaveBeenCalled()
  })

  it('geçerli veriyle tenant ve kullanıcı oluşturur, session cookie set eder', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.createTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'user-1' })
    const response = await POST(makeRequest({ businessName: 'Test İşletme', email: 'a@b.com', password: 'sifre1234' }))
    expect(response.status).toBe(201)
    expect(mocks.createTenant).toHaveBeenCalledWith('Test İşletme')
    expect(response.headers.get('set-cookie')).toContain('faydalab_crm_session=')
  })

  it('aynı IP dakikada 5 denemeden fazla yaparsa 429 döner', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.createTenant.mockResolvedValue({ id: 'tenant-1' })
    mocks.create.mockResolvedValue({ id: 'user-1' })
    const ip = 'signup-rate-limit-ip'
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ businessName: 'Test', email: `a${i}@b.com`, password: 'sifre1234' }, ip))
    }
    const sixth = await POST(makeRequest({ businessName: 'Test', email: 'final@b.com', password: 'sifre1234' }, ip))
    expect(sixth.status).toBe(429)
  })
})
```

- [ ] **Step 6: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/auth/signup/route.test.ts`
Expected: 5/5 PASS

- [ ] **Step 7: `/admin/(public)/signup/page.tsx` oluştur**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: form.get('businessName'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Kayıt başarısız')
      return
    }
    router.push('/admin/leads')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">FaydaLab CRM&apos;e Kaydol</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          name="businessName"
          placeholder="İşletme adı"
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
        <input
          name="password"
          type="password"
          placeholder="Şifre (en az 8 karakter)"
          required
          minLength={8}
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold py-3 font-semibold text-brand-bg hover:opacity-90"
        >
          14 Gün Ücretsiz Dene
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-brand-muted">
        Zaten hesabın var mı?{' '}
        <Link href="/admin/login" className="text-brand-gold underline">
          Giriş yap
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 8: Login sayfasına kayıt linki ekle**

`apps/crm/src/app/admin/(public)/login/page.tsx`'in en üstüne `import Link from 'next/link'` ekle, formun altına şunu ekle:

```tsx
<p className="mt-4 text-center text-sm text-brand-muted">
  Hesabın yok mu?{' '}
  <Link href="/admin/signup" className="text-brand-gold underline">
    Kayıt ol
  </Link>
</p>
```

- [ ] **Step 9: `middleware.ts`'e `/admin/signup`'ı genel (public) yol olarak ekle**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/signup'])

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = verifySession(token)
  if (!session) {
    if (PUBLIC_ADMIN_PATHS.has(req.nextUrl.pathname)) {
      return NextResponse.next()
    }
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/((?!login|signup).*)', '/api/admin/:path*'],
}
```

- [ ] **Step 10: `middleware.test.ts`'e signup testi ekle**

Mevcut testlerin altına ekle:

```ts
it('/admin/signup isteğini middleware\'den geçirir (session olmasa bile)', () => {
  vi.mocked(verifySession).mockReturnValue(null)
  const req = new NextRequest('http://localhost/admin/signup')
  const res = middleware(req)
  expect(res.status).toBe(200)
})
```

- [ ] **Step 11: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/middleware.test.ts`
Expected: 5/5 PASS

- [ ] **Step 12: Typecheck + build**

Run: `cd apps/crm && npm run typecheck && npm run build`
Expected: İkisi de hatasız (gerçek DB bağlantısı gerekmez — `dynamic = 'force-dynamic'` sayfalar build sırasında sorgu çalıştırmaz, sadece derlenir).

- [ ] **Step 13: Commit**

```bash
git add apps/crm/src/lib/tenant.ts apps/crm/src/lib/tenant.test.ts apps/crm/src/app/api/auth/signup "apps/crm/src/app/admin/(public)/signup" "apps/crm/src/app/admin/(public)/login/page.tsx" apps/crm/src/middleware.ts apps/crm/src/middleware.test.ts
git commit -m "feat(crm): self-servis kayıt (signup) akışı"
```

---

### Task 5: Plan limitleri + AI kalifikasyon dallanması

**Files:**
- Modify: `apps/crm/src/lib/qualify.ts`
- Test: `apps/crm/src/lib/qualify.test.ts`
- New: `apps/crm/src/lib/tenant-usage.ts`
- Test: `apps/crm/src/lib/tenant-usage.test.ts`
- Modify: `apps/crm/src/lib/leads.ts`
- Test: `apps/crm/src/lib/leads.test.ts`

**Interfaces:**
- Consumes: `Tenant.plan`, `Tenant.monthlyLeadCount`, `Tenant.monthlyLeadCountResetAt` (Görev 1).
- Produces: `qualifyLead(requestText: string, plan: Plan): Promise<Qualification>` (yeni imza — `Qualification.summary`/`score` artık `string | null` / `number | null`). `recordLeadForTenant(tenantId: string): Promise<{ plan: Plan; overLimit: boolean }>` (`tenant-usage.ts`).

- [ ] **Step 1: `qualify.ts`'i plan-dallanmalı yap**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Plan } from '@prisma/client'

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
  summary: z.string().nullable(),
  category: z.string(),
  urgency: z.enum(['DUSUK', 'ORTA', 'YUKSEK']),
  score: z.number().int().min(1).max(5).nullable(),
})

export type Qualification = z.infer<typeof qualificationSchema>

const FULL_INSTRUCTIONS =
  'Sen FaydaLab Digital ajansı için gelen müşteri taleplerini değerlendiren bir satış asistanısın. ' +
  'Talebi oku, kısa bir özet çıkar, hizmet kategorisini belirle (ör. "Web Sitesi", "QR Menü", ' +
  '"Instagram Otomasyonu", "Genel"), aciliyetini DUSUK/ORTA/YUKSEK olarak sınıflandır ve 1-5 arası ' +
  'bir öncelik skoru ver (5 en yüksek öncelik). Yanıtı sadece şu JSON formatında ver, başka hiçbir ' +
  'metin ekleme: {"summary": string, "category": string, "urgency": "DUSUK"|"ORTA"|"YUKSEK", "score": number}'

const BASIC_INSTRUCTIONS =
  'Sen gelen müşteri taleplerini değerlendiren bir satış asistanısın. Talebi oku, hizmet kategorisini ' +
  'belirle (ör. "Web Sitesi", "QR Menü", "Instagram Otomasyonu", "Genel") ve aciliyetini DUSUK/ORTA/YUKSEK ' +
  'olarak sınıflandır. Yanıtı sadece şu JSON formatında ver, başka hiçbir metin ekleme: ' +
  '{"category": string, "urgency": "DUSUK"|"ORTA"|"YUKSEK"}'

export async function qualifyLead(requestText: string, plan: Plan): Promise<Qualification> {
  const system = plan === 'PRO' ? FULL_INSTRUCTIONS : BASIC_INSTRUCTIONS

  const message = await anthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: `Müşteri talebi: "${requestText}"` }],
  })

  const textBlock = message.content.find((block: { type: string }) => block.type === 'text') as
    | { type: 'text'; text: string }
    | undefined

  if (!textBlock) {
    throw new Error('Claude yanıtında metin bloğu bulunamadı')
  }

  const parsed = JSON.parse(textBlock.text) as Record<string, unknown>
  return qualificationSchema.parse({
    summary: plan === 'PRO' ? (parsed.summary ?? null) : null,
    category: parsed.category,
    urgency: parsed.urgency,
    score: plan === 'PRO' ? (parsed.score ?? null) : null,
  })
}
```

(Not: `plan === 'PRO'` kontrolü deterministik bir kapı — model BASIC_INSTRUCTIONS'a rağmen summary/score döndürse bile BASLANGIC planında bunlar her zaman `null`'a zorlanır, sadece prompt'un itaatine güvenilmez.)

- [ ] **Step 2: `qualify.test.ts`'i güncelle**

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

  it('PRO planda geçerli JSON yanıtını doğrulayıp döner', async () => {
    mocks.create.mockResolvedValue(
      textResponse({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    )
    const result = await qualifyLead('Acil bir web sitesine ihtiyacım var', 'PRO')
    expect(result).toEqual({ summary: 'Web sitesi istiyor', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
  })

  it('BASLANGIC planda summary ve score olmadan da geçerli sayılır', async () => {
    mocks.create.mockResolvedValue(textResponse({ category: 'Web Sitesi', urgency: 'ORTA' }))
    const result = await qualifyLead('Web sitesi istiyorum', 'BASLANGIC')
    expect(result).toEqual({ summary: null, category: 'Web Sitesi', urgency: 'ORTA', score: null })
  })

  it('metin bloğu yoksa hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [] })
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow('metin bloğu bulunamadı')
  })

  it('şemaya uymayan JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue(textResponse({ summary: 'eksik alanlar' }))
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow()
  })

  it('geçersiz JSON hata fırlatır', async () => {
    mocks.create.mockResolvedValue({ content: [{ type: 'text', text: 'JSON değil' }] })
    await expect(qualifyLead('talep', 'PRO')).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/qualify.test.ts`
Expected: 5/5 PASS

- [ ] **Step 4: `tenant-usage.ts` oluştur**

```ts
import { prisma } from './db'
import type { Plan } from '@prisma/client'

const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000
const BASLANGIC_MONTHLY_LIMIT = 50

export async function recordLeadForTenant(tenantId: string): Promise<{ plan: Plan; overLimit: boolean }> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

  const shouldReset = Date.now() - tenant.monthlyLeadCountResetAt.getTime() > RESET_INTERVAL_MS

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: shouldReset
      ? { monthlyLeadCount: 1, monthlyLeadCountResetAt: new Date() }
      : { monthlyLeadCount: { increment: 1 } },
  })

  return {
    plan: updated.plan,
    overLimit: updated.plan === 'BASLANGIC' && updated.monthlyLeadCount > BASLANGIC_MONTHLY_LIMIT,
  }
}
```

- [ ] **Step 5: `tenant-usage.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma: { tenant: { findUniqueOrThrow: mocks.findUniqueOrThrow, update: mocks.update } } }))

import { recordLeadForTenant } from './tenant-usage'

describe('recordLeadForTenant', () => {
  beforeEach(() => {
    mocks.findUniqueOrThrow.mockReset()
    mocks.update.mockReset()
  })

  it('PRO planda sınır aşılmaz', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'PRO',
      monthlyLeadCount: 999,
      monthlyLeadCountResetAt: new Date(),
    })
    mocks.update.mockResolvedValue({ plan: 'PRO', monthlyLeadCount: 1000 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'PRO', overLimit: false })
  })

  it('BASLANGIC planda 50 lead altındaysa sınır aşılmaz', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 10,
      monthlyLeadCountResetAt: new Date(),
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 11 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: false })
  })

  it('BASLANGIC planda 50 lead üzerine çıkınca sınır aşılır', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 50,
      monthlyLeadCountResetAt: new Date(),
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 51 })
    const result = await recordLeadForTenant('t1')
    expect(result).toEqual({ plan: 'BASLANGIC', overLimit: true })
  })

  it('30 günden eski resetAt varsa sayaç sıfırlanıp 1den başlar', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      plan: 'BASLANGIC',
      monthlyLeadCount: 500,
      monthlyLeadCountResetAt: old,
    })
    mocks.update.mockResolvedValue({ plan: 'BASLANGIC', monthlyLeadCount: 1 })
    await recordLeadForTenant('t1')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ monthlyLeadCount: 1 }),
    })
  })
})
```

- [ ] **Step 6: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/tenant-usage.test.ts`
Expected: 4/4 PASS

- [ ] **Step 7: `leads.ts`'te `runQualification`'ı plan-limit-farkındalı yap**

`runQualification` fonksiyonunu şununla değiştir (dosyanın en üstüne `import { recordLeadForTenant } from './tenant-usage'` ekle):

```ts
export async function runQualification(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return

  try {
    const { plan, overLimit } = await recordLeadForTenant(lead.tenantId)

    if (overLimit) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          aiError: 'Aylık lead sınırına ulaşıldı — Pro plana geçerek AI kalifikasyonunu sınırsız kullanabilirsiniz.',
        },
      })
      await sendAlert(
        `Yeni lead (${lead.source}): ${lead.name}\nAylık lead sınırına ulaşıldığı için AI değerlendirmesi atlandı.`
      )
      return
    }

    const result = await qualifyLead(lead.requestText, plan)
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
        `Kategori: ${result.category} | Aciliyet: ${result.urgency}` +
        (result.summary ? `\nÖzet: ${result.summary}` : '') +
        (result.score ? ` | Skor: ${result.score}/5` : '')
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await prisma.lead.update({ where: { id: leadId }, data: { aiError: message } })
      await sendAlert(`Yeni lead (${lead.source}): ${lead.name}\nAI değerlendirmesi başarısız: ${message}`)
    } catch (secondaryError) {
      console.error('runQualification hata işleme sırasında ikincil hata:', secondaryError)
    }
  }
}
```

(Not: `recordLeadForTenant` çağrısı da try bloğunun içinde — tenant bulunamazsa/silinmişse fırlatacak hata da aynı catch tarafından yakalanıp `aiError` olarak işlenir, sessizce yakalanmamış bir promise reddi olmaz.)

- [ ] **Step 8: `leads.test.ts`'teki `runQualification` bloğunu güncelle**

Dosyanın en üstündeki `mocks` ve `vi.mock` bloklarını genişlet:

```ts
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  qualifyLead: vi.fn(),
  sendAlert: vi.fn(),
  recordLeadForTenant: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { lead: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/qualify', () => ({ qualifyLead: mocks.qualifyLead }))
vi.mock('@/lib/telegram', () => ({ sendAlert: mocks.sendAlert }))
vi.mock('@/lib/tenant-usage', () => ({ recordLeadForTenant: mocks.recordLeadForTenant }))
```

`describe('runQualification', ...)` bloğunu şununla değiştir:

```ts
describe('runQualification', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
    mocks.update.mockReset()
    mocks.qualifyLead.mockReset()
    mocks.sendAlert.mockReset()
    mocks.recordLeadForTenant.mockReset().mockResolvedValue({ plan: 'PRO', overLimit: false })
  })

  it('lead bulunamazsa hiçbir şey yapmaz', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await runQualification('lead-1')
    expect(mocks.qualifyLead).not.toHaveBeenCalled()
  })

  it('başarılı kalifikasyonda Lead güncellenir ve bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockResolvedValue({ summary: 'özet', category: 'Web Sitesi', urgency: 'YUKSEK', score: 5 })
    await runQualification('lead-1')
    expect(mocks.qualifyLead).toHaveBeenCalledWith('talep', 'PRO')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { aiSummary: 'özet', aiCategory: 'Web Sitesi', aiUrgency: 'YUKSEK', aiScore: 5 },
    })
    expect(mocks.sendAlert).toHaveBeenCalledOnce()
  })

  it('kalifikasyon başarısız olursa Lead aiError ile güncellenir ve yine de bildirim gönderilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.qualifyLead.mockRejectedValue(new Error('API hatası'))
    await runQualification('lead-1')
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: { aiError: 'API hatası' } })
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.stringContaining('AI değerlendirmesi başarısız'))
  })

  it('BASLANGIC planda aylık sınır aşılmışsa AI çağrılmaz, aiError set edilir', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1', name: 'Ali', source: 'WEBSITE', requestText: 'talep' })
    mocks.recordLeadForTenant.mockResolvedValue({ plan: 'BASLANGIC', overLimit: true })
    await runQualification('lead-1')
    expect(mocks.qualifyLead).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { aiError: expect.stringContaining('Aylık lead sınırına ulaşıldı') },
    })
    expect(mocks.sendAlert).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 9: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/lib/leads.test.ts`
Expected: 8/8 PASS (3 `createLeadSchema` + 1 `createLead` + 4 `runQualification`)

- [ ] **Step 10: Typecheck + tüm testler**

Run: `cd apps/crm && npm run typecheck && npx vitest run`
Expected: Tamamı yeşil.

- [ ] **Step 11: Commit**

```bash
git add apps/crm/src/lib/qualify.ts apps/crm/src/lib/qualify.test.ts apps/crm/src/lib/tenant-usage.ts apps/crm/src/lib/tenant-usage.test.ts apps/crm/src/lib/leads.ts apps/crm/src/lib/leads.test.ts
git commit -m "feat(crm): plan bazlı AI kalifikasyon dallanması ve aylık lead sınırı"
```

---

### Task 6: Stripe billing (Checkout + webhook)

**Files:**
- Modify: `apps/crm/package.json`
- New: `apps/crm/src/lib/stripe.ts`
- New: `apps/crm/src/app/api/billing/checkout/route.ts`
- Test: `apps/crm/src/app/api/billing/checkout/route.test.ts`
- New: `apps/crm/src/app/api/webhooks/stripe/route.ts`
- Test: `apps/crm/src/app/api/webhooks/stripe/route.test.ts`
- Modify: `apps/crm/.env.example`

**Interfaces:**
- Consumes: `requireSession` (Görev 1), `Tenant` modeli.
- Produces: `POST /api/billing/checkout` (`{ plan: 'BASLANGIC' | 'PRO' }` → `{ url: string }`) — Görev 7'de "Ayarlar" sayfasındaki yükseltme butonu tarafından çağrılacak.

- [ ] **Step 1: `stripe` paketini kur**

Run: `cd apps/crm && npm install stripe`
Expected: `package.json`'a `stripe` dependency olarak eklenir.

- [ ] **Step 2: `stripe.ts` oluştur**

```ts
import Stripe from 'stripe'

let client: Stripe | null = null

export function stripeClient(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY tanımlı değil')
    client = new Stripe(apiKey)
  }
  return client
}

export function priceIdForPlan(plan: 'BASLANGIC' | 'PRO'): string {
  const key = plan === 'BASLANGIC' ? 'STRIPE_PRICE_BASLANGIC' : 'STRIPE_PRICE_PRO'
  const value = process.env[key]
  if (!value) throw new Error(`${key} tanımlı değil`)
  return value
}
```

- [ ] **Step 3: `/api/billing/checkout/route.ts` oluştur**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { stripeClient, priceIdForPlan } from '@/lib/stripe'

const checkoutSchema = z.object({ plan: z.enum(['BASLANGIC', 'PRO']) })

export async function POST(req: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } })
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: session.userId } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripeClient().checkout.sessions.create({
    mode: 'subscription',
    ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : { customer_email: user.email }),
    line_items: [{ price: priceIdForPlan(parsed.data.plan), quantity: 1 }],
    metadata: { tenantId: tenant.id, plan: parsed.data.plan },
    subscription_data: { metadata: { tenantId: tenant.id, plan: parsed.data.plan } },
    success_url: `${appUrl}/admin/settings?checkout=success`,
    cancel_url: `${appUrl}/admin/settings?checkout=cancelled`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

- [ ] **Step 4: `/api/billing/checkout/route.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  findUniqueOrThrowTenant: vi.fn(),
  findUniqueOrThrowUser: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireSession: mocks.requireSession }))
vi.mock('@/lib/db', () => ({
  prisma: {
    tenant: { findUniqueOrThrow: mocks.findUniqueOrThrowTenant },
    adminUser: { findUniqueOrThrow: mocks.findUniqueOrThrowUser },
  },
}))
vi.mock('@/lib/stripe', () => ({
  stripeClient: () => ({ checkout: { sessions: { create: mocks.create } } }),
  priceIdForPlan: (plan: string) => `price_${plan.toLowerCase()}`,
}))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    mocks.requireSession.mockReset()
    mocks.findUniqueOrThrowTenant.mockReset()
    mocks.findUniqueOrThrowUser.mockReset()
    mocks.create.mockReset()
  })

  it('oturum yoksa 401 döner', async () => {
    mocks.requireSession.mockResolvedValue(null)
    const response = await POST(makeRequest({ plan: 'PRO' }))
    expect(response.status).toBe(401)
  })

  it('geçersiz plan için 400 döner', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    const response = await POST(makeRequest({ plan: 'GECERSIZ' }))
    expect(response.status).toBe(400)
  })

  it('mevcut stripeCustomerId varsa customer ile checkout session oluşturur', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({ id: 'tenant-1', stripeCustomerId: 'cus_123' })
    mocks.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session-1' })
    const response = await POST(makeRequest({ plan: 'PRO' }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.url).toBe('https://checkout.stripe.com/session-1')
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_123', line_items: [{ price: 'price_pro', quantity: 1 }] })
    )
  })

  it('stripeCustomerId yoksa customer_email ile checkout session oluşturur', async () => {
    mocks.requireSession.mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1' })
    mocks.findUniqueOrThrowTenant.mockResolvedValue({ id: 'tenant-1', stripeCustomerId: null })
    mocks.findUniqueOrThrowUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' })
    mocks.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session-2' })
    const response = await POST(makeRequest({ plan: 'BASLANGIC' }))
    expect(response.status).toBe(200)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customer_email: 'a@b.com' }))
  })
})
```

- [ ] **Step 5: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/billing/checkout/route.test.ts`
Expected: 4/4 PASS

- [ ] **Step 6: `/api/webhooks/stripe/route.ts` oluştur**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripeClient } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      const tenantId = checkoutSession.metadata?.tenantId
      const plan = checkoutSession.metadata?.plan as 'BASLANGIC' | 'PRO' | undefined
      if (tenantId && plan) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan,
            subscriptionStatus: 'ACTIVE',
            stripeCustomerId: typeof checkoutSession.customer === 'string' ? checkoutSession.customer : undefined,
            stripeSubscriptionId:
              typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : undefined,
          },
        })
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const tenantId = subscription.metadata?.tenantId
      if (tenantId) {
        const status =
          subscription.status === 'active' ? 'ACTIVE' : subscription.status === 'past_due' ? 'PAST_DUE' : undefined
        if (status) {
          await prisma.tenant.update({ where: { id: tenantId }, data: { subscriptionStatus: status } })
        }
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const tenantId = subscription.metadata?.tenantId
      if (tenantId) {
        await prisma.tenant.update({ where: { id: tenantId }, data: { subscriptionStatus: 'CANCELED' } })
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 7: `/api/webhooks/stripe/route.test.ts` yaz**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { tenant: { update: mocks.update } } }))
vi.mock('@/lib/stripe', () => ({ stripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent } }) }))

import { POST } from './route'

function makeRequest(body: string, signature: string | null = 'valid-sig'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers, body })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    mocks.constructEvent.mockReset()
    mocks.update.mockReset()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('imza header eksikse 403 döner', async () => {
    const response = await POST(makeRequest('{}', null))
    expect(response.status).toBe(403)
  })

  it('geçersiz imza için 400 döner', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(400)
  })

  it('checkout.session.completed olayında tenant planı ve durumu güncellenir', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 'tenant-1', plan: 'PRO' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { plan: 'PRO', subscriptionStatus: 'ACTIVE', stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123' },
    })
  })

  it('customer.subscription.deleted olayında tenant CANCELED yapılır', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { tenantId: 'tenant-1' } } },
    })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { subscriptionStatus: 'CANCELED' } })
  })

  it('bilinmeyen olay tipinde güncelleme yapmadan 200 döner', async () => {
    mocks.constructEvent.mockReturnValue({ type: 'some.other.event', data: { object: {} } })
    const response = await POST(makeRequest('{}'))
    expect(response.status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Testleri çalıştır**

Run: `cd apps/crm && npx vitest run src/app/api/webhooks/stripe/route.test.ts`
Expected: 5/5 PASS

- [ ] **Step 9: `.env.example`'a Stripe değişkenlerini ekle**

```
DATABASE_URL=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_SESSION_SECRET=""
ANTHROPIC_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_BASLANGIC=""
STRIPE_PRICE_PRO=""
NEXT_PUBLIC_APP_URL=""
```

- [ ] **Step 10: Typecheck + tüm testler + build**

Run: `cd apps/crm && npm run typecheck && npx vitest run && npm run build`
Expected: Tamamı hatasız.

- [ ] **Step 11: Commit**

```bash
git add apps/crm/package.json apps/crm/package-lock.json apps/crm/src/lib/stripe.ts apps/crm/src/app/api/billing apps/crm/src/app/api/webhooks/stripe apps/crm/.env.example
git commit -m "feat(crm): Stripe Checkout ile self-servis abonelik"
```

---

### Task 7: Ayarlar sayfası (lead alım bilgileri + plan/deneme durumu)

**Files:**
- New: `apps/crm/src/app/admin/(protected)/settings/page.tsx`
- New: `apps/crm/src/components/UpgradeButton.tsx`
- Modify: `apps/crm/src/components/AdminNav.tsx`

**Interfaces:**
- Consumes: `requireSession` (Görev 1), `Tenant` modeli, `POST /api/billing/checkout` (Görev 6).
- Produces: Yok (bu planın son görevi).

- [ ] **Step 1: `UpgradeButton.tsx` oluştur**

```tsx
'use client'

import { useState } from 'react'

export function UpgradeButton({ plan, label }: { plan: 'BASLANGIC' | 'PRO'; label: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      const body = await res.json()
      window.location.href = body.url
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-bg hover:opacity-90 disabled:opacity-50"
    >
      {loading ? 'Yönlendiriliyor...' : label}
    </button>
  )
}
```

- [ ] **Step 2: `settings/page.tsx` oluştur**

```tsx
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { UpgradeButton } from '@/components/UpgradeButton'

const PLAN_LABELS: Record<string, string> = { BASLANGIC: 'Başlangıç (₺499/ay)', PRO: 'Pro (₺1.499/ay)' }
const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Deneme sürümü',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Ödeme gecikti',
  CANCELED: 'İptal edildi',
}

export default async function SettingsPage() {
  const session = await requireSession()
  if (!session) {
    redirect('/admin/login')
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">Ayarlar</h1>

      <div className="mb-8 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Plan</p>
        <p className="text-sm text-brand-muted">
          {PLAN_LABELS[tenant.plan]} — {STATUS_LABELS[tenant.subscriptionStatus]}
        </p>
        {tenant.trialEndsAt && tenant.subscriptionStatus === 'TRIALING' && (
          <p className="mt-1 text-xs text-brand-muted">
            Deneme süresi bitiş: {tenant.trialEndsAt.toLocaleDateString('tr-TR')}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <UpgradeButton plan="BASLANGIC" label="Başlangıç'a Geç" />
          <UpgradeButton plan="PRO" label="Pro'ya Geç" />
        </div>
      </div>

      <div className="rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Lead Alım Bilgileri</p>
        <p className="mb-3 text-sm text-brand-muted">
          Web sitenden veya Vapi asistanından lead almak için bu URL ve anahtarı kullan.
        </p>
        <div className="mb-2">
          <p className="text-xs uppercase text-brand-muted">Web Sitesi Webhook URL</p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">{appUrl}/api/leads</code>
        </div>
        <div className="mb-2">
          <p className="text-xs uppercase text-brand-muted">Vapi Webhook URL</p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">
            {appUrl}/api/webhooks/vapi
          </code>
        </div>
        <div>
          <p className="text-xs uppercase text-brand-muted">
            Gizli Anahtar (x-crm-ingest-secret / x-vapi-webhook-secret header)
          </p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">{tenant.ingestSecret}</code>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `AdminNav.tsx`'e "Ayarlar" linki ekle**

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
        <Link href="/admin/settings">Ayarlar</Link>
      </div>
      <button onClick={handleLogout} className="text-sm text-brand-muted underline">
        Çıkış Yap
      </button>
    </nav>
  )
}
```

- [ ] **Step 4: Typecheck + tüm testler + build**

Run: `cd apps/crm && npm run typecheck && npx vitest run && npm run build`
Expected: Tamamı hatasız. (Bu görevdeki `page.tsx`/component dosyaları için, projedeki mevcut kalıba uyarak otomatik test yazılmadı.)

- [ ] **Step 5: Commit**

```bash
git add "apps/crm/src/app/admin/(protected)/settings" apps/crm/src/components/UpgradeButton.tsx apps/crm/src/components/AdminNav.tsx
git commit -m "feat(crm): ayarlar sayfası (lead alım bilgileri, plan/deneme durumu)"
```

---

## Görev Sonrası Manuel Adımlar

Bu adımlar gerçek kimlik bilgileri/altyapı gerektirdiği için subagent'lara değil, controller'a (insan onaylı oturum) aittir:

1. Stripe hesabında iki gerçek Price oluştur (Başlangıç ₺499/ay, Pro ₺1.499/ay, `recurring`/`monthly`), `STRIPE_PRICE_BASLANGIC`/`STRIPE_PRICE_PRO` değerlerini al.
2. Stripe Dashboard'da bir webhook endpoint tanımla (`https://<crm-domain>/api/webhooks/stripe`, olaylar: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`), `STRIPE_WEBHOOK_SECRET`'ı al.
3. `apps/crm` için gerçek bir Vercel projesi oluştur, Neon Postgres bağla, tüm env var'ları gir (`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASLANGIC`, `STRIPE_PRICE_PRO`, `NEXT_PUBLIC_APP_URL`).
4. `prisma migrate dev` ile ilk migration'ı (`init`) gerçek DB'ye karşı oluştur ve uygula — bu, bu uygulamanın **ilk** migration'ı olacak (bkz. Global Constraints). Oluşan `apps/crm/prisma/migrations/` klasörünü commit'le.
5. `db:seed` ile FaydaLab tenant'ını ve ilk admin kullanıcısını oluştur.
6. `apps/website`'in `/api/contact` entegrasyonunu (Faz 3a'da eklenmişti) yeni `CRM_INGEST_SECRET` yerine artık `apps/crm`'in `/admin/settings` sayfasından alınan tenant'a özel `ingestSecret` ile güncelle.
7. `vapi-telesekreter/assistant.json`'daki `server.url`'i yeni CRM'in Vapi webhook URL'ine ve tenant'a özel secret'a göre güncelle (tercihen `x-vapi-webhook-secret` header ile).
8. Canlıda uçtan uca doğrula: yeni bir işletme ile `/admin/signup`'tan kaydol, test lead'i gönder, AI kalifikasyonunun çalıştığını doğrula, Stripe test modunda bir Checkout akışını tamamla ve tenant planının güncellendiğini kontrol et.
