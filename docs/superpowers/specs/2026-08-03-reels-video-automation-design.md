# FaydaLab Faz 1b — Reels/Video Otomasyonu: Tasarım

**Tarih:** 2026-08-03
**Durum:** Onaylandı, implementasyon planı bekleniyor
**İlgili:** [00-vision.md](../../00-vision.md), [01-brand-identity.md](../../01-brand-identity.md), [10-roadmap.md](../../10-roadmap.md), [2026-08-02-instagram-content-agent-design.md](2026-08-02-instagram-content-agent-design.md)

## Amaç

Faz 1a'da (statik post otomasyonu, tamamlandı ve canlıda) kapsam dışı bırakılan reels/video kısmını tamamlamak. Statik postların yanına, aynı Telegram onay akışını ve Instagram yayın altyapısını paylaşan bir reel üretim hattı eklemek.

## Kapsam (MVP)

- Yüzsüz (avatar/insan görüntüsü yok), AI seslendirmeli, bilgilendirici/ikna edici reels
- Haftada 2 reel, statik postlarla aynı iki içerik sütününden (AI/Otomasyon, Web/QR vaka çalışması) dönüşümlü
- Tek görsel şablon: marka renkli tek arka plan görseli + Ken Burns efekti + senkronize altyazılar + OpenAI TTS seslendirme
- Telegram üzerinden onaylı yayın (statik postlarla birebir aynı mantık)
- Gerçek Instagram Graph API entegrasyonu (REELS media_type)

**Kapsam dışı (bilinçli olarak ertelendi):** Gerçek/AI avatar yüzü ve dudak senkronu (HeyGen/Synthesia tarzı — önemli ek maliyet ve karmaşıklık; kullanıcı açıkça yüzsüz versiyonla başlamayı seçti, ileride istenirse ayrı bir entegrasyon olarak eklenebilir), birden fazla görsel şablonu/varyasyonu (tek şablonla başlanıyor), ElevenLabs veya başka bir TTS sağlayıcısı (OpenAI TTS ile başlanıyor, zaten kurulu hesap), otomatik altyazı zaman hizalama araçları (Whisper vb. — her cümle ayrı seslendirildiği için gerek yok).

## Mimari

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  n8n Cloud   │────▶│  FaydaLab Content │────▶│   Telegram Bot   │
│ (Workflow 4: │     │   API (Next.js/   │     │  (video önizleme │
│  haftada 2)  │◀────│   Vercel)         │◀────│   + onay/red)    │
└─────────────┘     └──────────────────┘     └─────────────────┘
                              │  ▲
                    ┌─────────┘  └─────────┐
                    ▼                      ▼
          ┌──────────────────┐   ┌──────────────────┐
          │  Instagram Graph   │   │  apps/reel-renderer│
          │  API (REELS yayın) │   │  (Remotion,        │
          └──────────────────┘   │  Railway/Fly.io)    │
                                  └──────────────────┘
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │   Vercel Blob      │
                                  │  (render edilen     │
                                  │   video dosyası)    │
                                  └──────────────────┘
```

**Yeni bileşen — `apps/reel-renderer`:** Remotion'ı barındıran, Railway (ya da Fly.io) üzerinde Docker konteyner olarak çalışan bağımsız bir Node.js servisi. `apps/content-agent` ile aynı monorepo içinde, ayrı bir uygulama olarak yaşar. Tek sorumluluğu: kendisine POST edilen script (cümle + ses dosyası URL'i + süre listesi) + arka plan görseli URL'inden bir video render edip Vercel Blob'a yüklemek, URL döndürmek.

**Neden AWS Lambda değil:** Kullanıcının AWS hesabı yok; Railway/Fly.io, projenin diğer yönetilen servisleriyle (Vercel, Neon, n8n Cloud) tutarlı, "sunucu yönetimi yok" hissi veren bir alternatif. Remotion'ın Docker tabanlı render CLI'ı bu platformlarda sorunsuz çalışır.

## İçerik Üretim Hattı

1. **Script üretimi:** Claude, aktif içerik sütununu ve geçmiş konuları (dedup için, statik postlarla ortak `getRecentTopics` mantığı) göz önüne alarak bir reel senaryosu üretir: açılış kancası (1 cümle) + 3-4 bilgi/fayda cümlesi + kapanış çağrısı (1 cümle). Çıktı JSON: `{ topic, hook, beats: string[], cta, hashtags }`.
2. **Seslendirme:** Her cümle (hook, her beat, cta) **ayrı ayrı** OpenAI TTS (`tts-1`) ile seslendirilir. Her ses dosyasının süresi API yanıtından/dosya meta verisinden doğrudan bilinir — cümle-bazlı bölme sayesinde otomatik zaman hizalama (Whisper vb.) gerekmez. Ses dosyaları Vercel Blob'a yüklenir.
3. **Arka plan görseli:** Mevcut `image-gen.ts` (marka renk paleti direktifiyle) kullanılarak konuya uygun **tek** bir arka plan görseli üretilir. Tek görsel + Ken Burns efekti tercih edildi çünkü hem daha ucuz (tek üretim çağrısı) hem de "premium/sade" marka kimliğine daha uygun — çok sayıda farklı görsel dağınık/amatör bir slayt gösterisi hissi verebilir.
4. **Render:** content-agent, `{ backgroundImageUrl, segments: [{ text, audioUrl, durationMs }] }` yapısını `apps/reel-renderer`'a POST eder. Remotion şablonu: arka plan görseli üzerinde yavaş yakınlaşma (Ken Burns), her segment'in süresi kadar ekranda kalan, marka tipografisiyle (Bebas Neue/Sora, `#F5F5F5` metin, `#D4AF37` vurgu) beliren altyazı, birleştirilmiş ses parçası. Render edilen video Vercel Blob'a yüklenir.
5. **Telegram önizleme:** `sendVideo` (mevcut `sendContentPreview`'a paralel yeni bir fonksiyon) ile video + caption + Onayla/Reddet gönderilir.

## Onay ve Yayın Akışı

Statik postlarla birebir aynı durum makinesi ve webhook mantığı kullanılır (`ContentStatus` enum'u değişmez): `PENDING_APPROVAL` → `APPROVED` (webhook) → `SCHEDULED` (publish'in iyimser kilidi) → `PUBLISHED`. Fark sadece Instagram'a gönderilen medya tipinde: `instagram.ts`'e `publishReel()` (ya da `publishImage`'ın `mediaType` parametresiyle genişletilmesi) eklenir — `media_type: REELS`, `video_url` ile container oluşturulur, mevcut `waitForContainerReady` polling fonksiyonu aynen kullanılır (video işleme daha uzun sürebileceği için `CONTAINER_STATUS_MAX_ATTEMPTS` reel'ler için daha yüksek bir değere çekilebilir — implementasyon planında netleşecek).

## Veri Modeli Değişiklikleri

- `ContentFormat` enum'a `REEL` eklenir (mevcut `STATIC`'in yanına)
- `ContentItem`'a nullable `videoUrl String?` alanı eklenir (`imageUrl` statik postlar için kalmaya devam eder; reels için arka plan görseli `imageUrl`'de, render edilmiş final video `videoUrl`'de tutulur)

## n8n Entegrasyonu

Yeni **Workflow 4 — Haftalık Reel Üretimi**: Schedule Trigger (haftada 2 gün, örn. Salı ve Cuma 09:00) → HTTP Request → `POST /api/generate-reel` (aynı `INTERNAL_API_SECRET` Header Auth credential'ı paylaşılır).

## Hata Yönetimi

Statik postlarla aynı desen: her üretim adımı (script, TTS, görsel, render) `withRetry` ile bir kez otomatik tekrar dener; kalıcı hata durumunda Telegram'a detaylı uyarı gider ve içerik ilgili `_FAILED` durumunda kalır. Render servisi (`apps/reel-renderer`) kendi içinde çökerse content-agent bunu bir HTTP hatası olarak görür ve aynı hata yolunu izler — sessizce düşme yok.

## Test Yaklaşımı

Statik post hattında olduğu gibi: `PUBLISH_MODE=draft` altında uçtan uca (script → TTS → görsel → render → Telegram önizleme → onay → sahte yayın) doğrulanır, gerçek Instagram yayını ancak manuel/kontrollü bir testle açılır (statik postlarda izlenen yol).

## Açık Kararlar (İmplementasyon Planında Netleşecek)

- Remotion şablonunun tam React/CSS kodu (animasyon eğrileri, tipografi boyutları)
- `apps/reel-renderer`'ın tam HTTP arayüzü (endpoint şekli, istek/yanıt şeması)
- Railway/Fly.io arasında kesin platform seçimi ve deploy detayları
- OpenAI TTS ses modeli/karakteri seçimi (`tts-1` vs `tts-1-hd`, ses tonu)
- `CONTAINER_STATUS_MAX_ATTEMPTS`'in reels için kesin değeri

## Kabul Kriterleri

- [ ] Sistem taslak modda haftada 2 reel üretebiliyor (script + TTS + görsel + render)
- [ ] Telegram üzerinden video önizleme + onay/red çalışıyor
- [ ] Gerçek Instagram REELS yayını doğrulandı (kontrollü tek test ile)
- [ ] Aynı konu kısa sürede tekrar önerilmiyor (statik postlarla ortak dedup mantığı)
- [ ] n8n Workflow 4 kuruldu ve haftalık tetikleniyor
