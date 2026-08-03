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
