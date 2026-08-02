# FaydaLab Content Agent

FaydaLab Faz 1a — Instagram statik içerik üretim, onay ve yayın hattı. Tasarım: [../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md](../../docs/superpowers/specs/2026-08-02-instagram-content-agent-design.md)

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyala, değerleri doldur (bkz. [prerequisites checklist](../../docs/superpowers/plans/2026-08-02-prerequisites-checklist.md))
2. `npm install` (`postinstall` hook'u `prisma generate`'i otomatik çalıştırır)
3. Veritabanı şemasını uygula:
   - **Yerel geliştirme:** `npm run db:migrate` (`prisma migrate dev` — şema değişikliğinde yeni migration üretir)
   - **Production / CI / Vercel:** `npm run db:deploy` (`prisma migrate deploy` — yalnızca commit'lenmiş migration'ları uygular, şema değiştirmez)
4. `npm run dev`

## Endpoint'ler

| Endpoint | Tetikleyici | Amaç |
|---|---|---|
| `POST /api/generate` | n8n günlük tetikleyici | Yeni içerik üretir, Telegram'a önizleme gönderir |
| `POST /api/telegram/webhook` | Telegram | Onay/red callback'lerini işler (secret `X-Telegram-Bot-Api-Secret-Token` header'ında gelir) |
| `POST /api/publish` | n8n zamanlanmış cron | Onaylı ve zamanı gelen içeriği yayınlar |
| `POST /api/token/refresh` | n8n haftalık cron | Instagram access token'ını yeniler |
| `POST /api/token/seed` | Elle, tek seferlik (n8n tetiklemez) | Uzun ömürlü Instagram token'ını veritabanına ilk kez yükler |

Tüm iç endpoint'ler (`/api/generate`, `/api/publish`, `/api/token/refresh`, `/api/token/seed`) `Authorization: Bearer $INTERNAL_API_SECRET` header'ı gerektirir.

n8n workflow kurulumu ve Telegram webhook kaydı için: [docs/n8n-workflows.md](docs/n8n-workflows.md)

## Instagram Token'ının İlk Kez Yüklenmesi

Yayın hattı, `IntegrationToken` tablosunda `provider = "instagram"` kaydını bekler; bu kayıt otomatik oluşmaz. Meta App Review tamamlanıp uzun ömürlü (long-lived) bir Instagram access token alındıktan sonra bu endpoint bir kez elle çağrılır:

```bash
curl "https://<vercel-domain>/api/token/seed" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"<long-lived-token>","expiresInSeconds":5184000}'
```

Bundan sonra `/api/token/refresh`'in haftalık cron'u token'ı süresi dolmadan güncel tutar. Aynı çağrı, token'ın elle değiştirilmesi gerektiğinde tekrar edilebilir (upsert'tir).

## PUBLISH_MODE (draft / live)

`PUBLISH_MODE` ortam değişkeni yayın davranışını belirler:

- **`draft`** (varsayılan): Instagram'a gerçek gönderi oluşturulmaz. Yayın akışı uçtan uca çalışır ancak Graph API çağrısı taklit edilir; `IntegrationToken` kaydı aranmaz, dolayısıyla Meta App Review tamamlanmadan da tüm hat (üretim → Telegram onayı → zamanlama → yayın) test edilebilir.
- **`live`**: Gerçek yayın yapılır. `/api/publish` önce `IntegrationToken` kaydını okur; kayıt yoksa Telegram'a uyarı gönderip hiçbir içeriği işlemeden döner (bkz. yukarıdaki token yükleme adımı).

Meta App Review onayı ve token yüklemesi tamamlanana kadar `PUBLISH_MODE="draft"` kalmalıdır.

## Vercel Deploy

Vercel projesinde Root Directory `apps/content-agent` olarak ayarlanmalı. `.env.example`'daki tüm değişkenler Vercel Environment Variables'a eklenmeli.

Üretilen görseller Vercel Blob'a yüklenir (OpenAI görsel URL'leri ~60 dakikada sona erdiği ve yayın ertesi güne zamanlandığı için kalıcı depolama zorunludur). Vercel projesine bir Blob store bağlandığında `BLOB_READ_WRITE_TOKEN` otomatik olarak ortam değişkenlerine eklenir.

Migration'lar production'da `npm run db:deploy` ile uygulanır (build komutuna eklenebilir veya deploy öncesi elle çalıştırılır).

## Test

- `npm test` — tüm birim ve route testlerini çalıştırır (dış servisler mock'lanır, gerçek API çağrısı yapılmaz).
- `npm run typecheck` — TypeScript tip denetimi (`tsc --noEmit`).
