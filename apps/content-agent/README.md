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
