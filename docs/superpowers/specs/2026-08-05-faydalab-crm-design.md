# FaydaLab Faz 3a — CRM Çekirdeği + AI Lead Kalifikasyonu: Tasarım

**Tarih:** 2026-08-05
**Durum:** Onaylandı, implementasyon planı bekleniyor
**İlgili:** [10-roadmap.md](../../10-roadmap.md)

## Amaç

Faz 3'ün ("CRM + Lead Kalifikasyonu + WhatsApp Otomasyonu") tanımladığı iş tek bir spec'e sığmayacak kadar geniş — CRM çekirdeği, AI lead kalifikasyonu, WhatsApp otomasyonu, teklif üretimi ve takip otomasyonu birbirinden bağımsız alt sistemler. Bu spec sadece **Faz 3a**'yı kapsar: tüm kaynaklardan gelen lead'lerin tek bir yerde toplandığı bir CRM çekirdeği + her lead'i otomatik değerlendirip admin'e Telegram bildirimi atan bir AI kalifikasyon katmanı. WhatsApp otomasyonu, teklif üretimi ve takip otomasyonu kapsam dışı — ayrı spec'ler olarak ele alınacak (Faz 3b, 3c, ...).

Şu anki durum: `apps/website`'in `ContactMessage` tablosu izole (sadece isim/email/mesaj, manuel okunuyor). `vapi-telesekreter` projesi giden arama yapıyor, Google Apps Script webhook'u üzerinden bir Google Sheet'e log atıyor ve doğrudan Telegram'a bildirim gönderiyor — bu iki kaynak hiçbir ortak sisteme bağlı değil.

## Kapsam (MVP)

- Yeni `apps/crm` uygulaması (monorepo içinde, Next.js/Prisma/Neon, diğer app'lerle aynı desen)
- İki lead kaynağı: web sitesi iletişim formu, Vapi arama webhook'u (`source` alanıyla genişletilebilir tasarım — ileride WhatsApp/başka kaynaklar kolayca eklenir)
- Her yeni lead için otomatik AI kalifikasyonu: özet, kategori, aciliyet, 1-5 skor
- Her yeni lead için Telegram bildirimi (AI özetiyle birlikte)
- Tek admin hesabıyla panel: lead listesi, durum/kaynak filtresi, manuel durum değiştirme
- Vapi entegrasyonu sırasında `apps-script.js`'teki açığa çıkmış Telegram bot token + webhook secret'ının rotasyonu

**Kapsam dışı (bilinçli olarak ertelendi):**
- WhatsApp otomasyonu (Faz 3b, ayrı spec — Meta Business API entegrasyonu gerektirir)
- Teklif/proposal otomatik üretimi (Faz 3c)
- Takip (follow-up) otomasyonu / hatırlatma sekansları (Faz 3c veya sonrası)
- Otomatik yanıt gönderimi (email/WhatsApp) — AI sadece analiz eder, yanıtı admin manuel gönderir
- Kanban/sürükle-bırak pipeline görünümü — basit liste + filtre yeterli (YAGNI)
- Çoklu admin kullanıcı/rol sistemi (tek admin yeterli, diğer app'lerle aynı desen)
- vapi-telesekreter'ın Google Sheets log'unun tamamen kaldırılması — CRM birincil kayıt haline gelir, Sheets entegrasyonuna dokunulmaz/kaldırılmaz, sadece webhook hedefi değişir

## Mimari

```
┌──────────────────┐        ┌──────────────────┐
│  apps/website      │──POST─▶│                    │
│  /api/contact       │        │    apps/crm         │
└──────────────────┘        │  (Next.js/Vercel)   │
                              │                    │
┌──────────────────┐        │  /api/leads (ingest) │
│  Vapi (arama)       │──POST─▶│  /api/webhooks/vapi │
│  end-of-call-report  │        │                    │
└──────────────────┘        └──────────────────┘
                                       │  ▲
                          ┌────────────┘  └────────────┐
                          ▼                             ▼
                ┌──────────────────┐         ┌──────────────────┐
                │  Neon Postgres     │         │   Claude API        │
                │  (Lead, AdminUser)  │         │  (AI kalifikasyon)  │
                └──────────────────┘         └──────────────────┘
                          │
                          ▼ (yeni lead bildirimi)
                ┌──────────────────┐
                │   Telegram Bot     │
                │  (rotate edilmiş,   │
                │   yeni env var'lar)  │
                └──────────────────┘
```

- `apps/website`'in `/api/contact` route'u, mevcut `ContactMessage` kaydına ek olarak `apps/crm`'in `/api/leads` endpoint'ine bir POST atar (`source: "website"`). Bu çağrı `sendAlert` deseniyle aynı şekilde **asla ana isteği bloklamaz/başarısız kılmaz** — CRM'e ulaşamazsa sessizce loglanır, iletişim formu kullanıcı için yine de başarıyla tamamlanır.
- Vapi'nin `assistant.json` içindeki `server.url`, mevcut Google Apps Script URL'i yerine `apps/crm`'in `/api/webhooks/vapi` adresine çekilir; yeni bir `WEBHOOK_SECRET` üretilip hem Vapi config'ine hem CRM env'ine yazılır (eski, açığa çıkmış secret artık geçersiz).
- `apps/crm` kendi Neon Postgres veritabanına sahip (diğer app'lerle aynı desen — paylaşımlı DB yok, izolasyon var).

## Veri Modeli (Prisma)

```prisma
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
  id          String      @id @default(cuid())
  name        String
  phone       String?
  email       String?
  requestText String                          // ham talep metni (form mesajı veya arama özeti)
  source      LeadSource
  sourceMeta  Json                             // ham kaynak verisi (ör. Vapi call id, structuredData)
  status      LeadStatus  @default(YENI)

  aiSummary   String?
  aiCategory  String?
  aiUrgency   LeadUrgency?
  aiScore     Int?                             // 1-5
  aiError     String?                          // kalifikasyon başarısız olduysa neden (admin görebilir)

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model AdminUser {
  id           String @id @default(cuid())
  username     String @unique
  passwordHash String
}
```

## Lead Alım Akışı (Ingestion)

1. `POST /api/leads` — jenerik giriş noktası. Body: `{ name, phone?, email?, requestText, source, sourceMeta }`. Zod ile doğrulanır (name/requestText zorunlu, en az phone veya email'den biri zorunlu). Geçerliyse `Lead` oluşturulur (`status: YENI`), AI kalifikasyonu **arka planda tetiklenir** (isteğe yanıt beklemeden — `await` edilmeden ateşlenir, response hemen 201 döner), 404/400 hataları standart.
2. `POST /api/webhooks/vapi` — Vapi'nin `end-of-call-report` formatını ayrıştırır (mevcut `apps-script.js`'teki mantığın birebir karşılığı: `structuredData.name/phone/request`, yoksa `analysis.summary`), sonra iç mantığı `/api/leads` ile aynı şekilde çalıştırır (`source: VAPI`, `sourceMeta`: tüm `call`+`analysis` objesi). URL query'sindeki `token` parametresi `WEBHOOK_SECRET` ile karşılaştırılır, eşleşmezse 403.
3. `apps/website`'in `/api/contact`'ı, kendi `ContactMessage` kaydını oluşturduktan sonra `fetch` ile `apps/crm`'in `/api/leads`'ine `source: WEBSITE` ile POST atar; bu çağrı `try/catch` içinde, hata olursa sadece loglanır (website'in kendi contact akışını asla bozmaz).

## AI Kalifikasyon

- Claude API (Vercel AI SDK, tool-calling/structured output — content-agent'taki entegrasyon deseniyle aynı).
- Girdi: `requestText` (+ varsa `name`, `source`).
- Çıktı şeması (zod): `{ summary: string, category: string, urgency: 'DUSUK'|'ORTA'|'YUKSEK', score: number (1-5) }`.
- Şema doğrulaması başarısız olursa veya API hatası olursa: `Lead.aiError` alanına hata mesajı yazılır, `aiSummary/aiCategory/aiUrgency/aiScore` `null` kalır, **Lead kaydı hiçbir şekilde silinmez/bozulmaz** — admin panelde "AI değerlendirmesi başarısız" olarak görünür, manuel değerlendirilebilir. Otomatik tekrar deneme yok (YAGNI — admin panelden manuel "yeniden değerlendir" butonu da kapsam dışı, ileride gerekirse eklenir).
- Kalifikasyon tamamlandığında (başarılı ya da başarısız fark etmez, lead oluştuğunda) Telegram'a `sendAlert` deseniyle bildirim: isim, kaynak, özet/kategori/aciliyet (varsa) veya "AI değerlendirmesi başarısız" notu.

## Admin Panel

- `/admin/login` — mevcut desenle aynı (credentials + bcrypt + HMAC session, `requireSession()` middleware + route-level).
- `/admin/leads` — tek liste görünümü: durum dropdown filtresi, kaynak filtresi (Web Sitesi/Vapi), her satırda isim/telefon/kaynak/AI skoru+aciliyet rengi (yeşil/sarı/kırmızı)/durum. Satıra tıklayınca detay: tam `requestText`, `aiSummary`, `sourceMeta` ham veri (debug için), durum değiştirme dropdown'ı.
- Server component + Prisma direct fetch (diğer app'lerin admin sayfalarıyla aynı desen), durum değişikliği için `PATCH /api/admin/leads/[id]`.

## Test Politikası

Proje genelindeki mevcut kuralla aynı: API route'ları ve `lib/` fonksiyonları Vitest ile test edilir (`vi.mock` ile Prisma/Telegram/Claude API mocklanır), admin UI bileşenleri için otomatik test yazılmaz. Özellikle:
- `/api/leads` ve `/api/webhooks/vapi`: geçerli/geçersiz body, webhook secret kontrolü, AI kalifikasyon başarısız olduğunda Lead'in yine de oluştuğu senaryo
- AI kalifikasyon fonksiyonu: zod şema doğrulama testleri, API hatası durumunda fallback davranışı (LLM çağrısının kendisi deterministik olmadığı için mocklanır)
- `sendAlert`: content-agent'taki testlerle aynı desen (asla throw etmediğinin doğrulanması)

## Güvenlik

- `apps-script.js` içinde düz metin commit'lenmiş `TELEGRAM_BOT_TOKEN` ve `WEBHOOK_SECRET` rotate edilir: aynı Telegram botu için BotFather üzerinden token yenilenir (eski token geçersiz kılınır, bot kimliği/chat geçmişi korunur), yeni token sadece `apps/crm` env'ine yazılır. Yeni bir `VAPI_WEBHOOK_SECRET` üretilip hem `apps/crm` env'ine hem Vapi `assistant.json`'a yazılır. Vapi trafiği artık `apps/crm`'e gittiği için Apps Script'in Telegram çağrısı fiilen devre dışı kalır (dosyaya dokunulmaz, sadece trafik kesilir).
- `apps/crm`'in kendi ortam değişkenleri (`DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ANTHROPIC_API_KEY` veya eşdeğeri, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VAPI_WEBHOOK_SECRET`) diğer app'lerle aynı `.env.example` + Vercel env deseniyle yönetilir.
