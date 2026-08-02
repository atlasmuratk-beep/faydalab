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

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<vercel-domain>/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

`secret_token`, `setWebhook` çağrısında Telegram'a kaydedilir; Telegram bundan sonra her webhook teslimatında bunu `X-Telegram-Bot-Api-Secret-Token` header'ı olarak gönderir. Endpoint secret'ı bu header'dan okur — böylece secret URL tabanlı erişim loglarına düşmez (query string'de taşınmaz).

## Instagram Token'ının İlk Kez Yüklenmesi (n8n dışı, tek seferlik)

Meta App Review tamamlanıp uzun ömürlü (long-lived) Instagram access token alındıktan sonra, token'ı veritabanına bir kerelik yüklemek için:

```bash
curl "https://<vercel-domain>/api/token/seed" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"<long-lived-token>","expiresInSeconds":5184000}'
```

Bundan sonra Workflow 3 (haftalık token yenileme) token'ı güncel tutar.
