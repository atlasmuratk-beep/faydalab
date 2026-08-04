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
