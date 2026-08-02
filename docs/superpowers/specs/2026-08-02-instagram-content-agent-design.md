# FaydaLab Faz 1 — Instagram İçerik Otomasyon Ajanı: Tasarım

**Tarih:** 2026-08-02
**Durum:** Onaylandı, implementasyon planı bekleniyor
**İlgili:** [00-vision.md](../../00-vision.md), [01-brand-identity.md](../../01-brand-identity.md), [10-roadmap.md](../../10-roadmap.md)

## Amaç

FaydaLab'ın vizyonundaki 17 AI ajanından ilkini inşa etmek: Instagram için içerik üretimi, onay ve yayınlamayı otomatikleştiren bir sistem. Bu ajan hem FaydaLab'ın kendi Instagram hesabını besler hem de gelecekte müşterilere satılabilecek bir otomasyon ürününün canlı prototipidir.

## Kapsam (MVP)

- Statik görsel + metin postları (haftada 5)
- Şablon tabanlı motion video reels (haftada 2)
- İki öncelikli içerik sütunu: AI/Otomasyon ve Web/QR vaka çalışmaları, dönüşümlü
- Telegram üzerinden onaylı yayın (tam otonom değil)
- Gerçek Instagram Graph API entegrasyonu (taslak modla başlar, Meta onayı sonrası canlıya alınır)

**Kapsam dışı (bilinçli olarak ertelendi):** Tam AI text-to-video üretimi, WhatsApp/DM otomasyonu, çoklu sosyal platform desteği, veri odaklı otomatik ağırlık optimizasyonu (ilk sürümde manuel ağırlıklandırma), tam görsel marka kimliği (logo/detaylı tasarım sistemi — sadece minimal bir prompt stil rehberi kullanılır).

## Mimari

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  n8n Cloud   │────▶│  FaydaLab Content │────▶│   Telegram Bot   │
│ (zamanlayıcı,│     │   API (Next.js/   │     │  (önizleme +     │
│  orkestrasyon)│◀────│   Vercel)         │◀────│   onay/red)      │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                      │
       │                      ▼
       │             ┌─────────────────┐
       │             │  Neon Postgres   │
       │             │  (Prisma) —      │
       │             │  içerik geçmişi, │
       │             │  durum, token'lar│
       │             └─────────────────┘
       ▼
┌──────────────────┐        ┌─────────────────────┐
│ Instagram Graph   │        │  Remotion Lambda     │
│ API (yayın)       │        │  (reel render, AWS)  │
└──────────────────┘        └─────────────────────┘
```

**Bileşenler:**
- **n8n Cloud**: Haftalık planlama tetikleyicisi, günlük üretim tetikleyicisi, zamanlanmış yayın (cron), token yenileme job'ı
- **Content API** (Next.js, Vercel): Claude ile metin/prompt üretimi, görsel AI çağrısı, Remotion render orkestrasyonu
- **Neon Postgres + Prisma**: İçerik öğeleri, durumları, rotasyon/dedup geçmişi, Instagram access token + son yenileme zamanı
- **Telegram Bot**: Önizleme gönderimi, inline Onayla/Reddet butonları, hata/uyarı bildirimleri
- **Instagram Graph API**: Yayın
- **Remotion Lambda**: Reel render (yönetilen AWS servisi, kendi sunucu yönetimi yok)

## İçerik Üretim Hattı

**Statik postlar:** Claude, aktif içerik sütununu (AI/Otomasyon ↔ Web/QR vaka çalışması, dönüşümlü) ve geçmiş konuları (dedup için) göz önüne alarak konu + caption + hashtag üretir → AI görsel API'si (sağlayıcı seçimi implementasyon planında netleşecek: OpenAI gpt-image veya Google Imagen) prompt stil rehberine uygun görsel üretir.

**Reels:** Claude kısa bir senaryo/metin akışı üretir → Remotion şablonu bu metni + AI üretilen görselleri "kinetic typography" tarzı hareketli videoya dönüştürür → Remotion Lambda'da render edilir.

**Prompt stil rehberi (minimal görsel tutarlılık):** Tam görsel kimlik oturumunu beklemeden, görsel üretim prompt'larına eklenecek sabit bir stil tanımı (renk paleti eğilimi, mood, kompozisyon kuralları — birkaç cümlelik bir referans metni). Bu, tam marka tasarım sistemi değildir; sadece haftadan haftaya tutarlılık sağlar. İmplementasyon planında somutlaştırılacak.

## Onay Akışı

1. İçerik üretilir → durum: `taslak`
2. Telegram'a önizleme (görsel/video + caption) + Onayla/Reddet/Düzenle iste butonları gönderilir → durum: `onay_bekliyor`
3. Onaylanırsa → durum: `onaylandı`, n8n zamanlanmış yayın kuyruğuna girer
4. Reddedilirse → durum: `reddedildi`, rotasyon geçmişine yazılır (konu tekrar önerilmez)
5. Zamanı geldiğinde n8n Instagram Graph API üzerinden yayınlar → durum: `yayınlandı`

Onaylanmamış içerik süresiz beklemede kalır — zaman aşımıyla otomatik yayınlanmaz. Bu, marka riskini sıfıra indiren temel güvenlik kuralı.

## Ön Koşullar (Kod Öncesi Kurulum Adımları)

1. Instagram hesabının iş hesabına çevrilmesi + bağlı Facebook Sayfası
2. Meta Developer'da uygulama oluşturulması, Instagram Graph API izinleri için App Review başvurusu
3. **Minimal gizlilik politikası + iletişim sayfası** (tek sayfa, Vercel'de hızlıca yayınlanır) — Meta App Review'ün genellikle istediği canlı bir URL için. Tam FaydaLab web sitesi (Faz 2) değil, sadece bu ön koşulu karşılayan minimal bir sayfa.
4. Telegram bot oluşturma (BotFather)
5. n8n Cloud hesabı, Neon Postgres veritabanı, AWS hesabı (Remotion Lambda için)

Meta onayı tamamlanana kadar sistem **taslak modda** çalışır: içerik üretir, Telegram'a gönderir, ama gerçek `publish` çağrısı yapmaz.

## Token Yönetimi

Instagram uzun ömürlü erişim token'ları ~60 günde sona erer. Bu, otomasyon araçlarının klasik sessiz arıza noktasıdır. n8n'de haftalık bir **token yenileme job'ı** çalışır; yenileme başarısız olursa Telegram'a uyarı gönderilir. Token ve son yenileme zamanı Postgres'te saklanır.

## Hata Yönetimi

- Görsel/video üretimi başarısız olursa: bir kez otomatik tekrar dener, yine başarısız olursa Telegram'a "üretim başarısız, manuel bakılmalı" bildirimi gider, içerik `hata` durumunda kalır
- Yayın (publish) başarısız olursa: sessizce düşmez, Telegram'a hata detayıyla bildirim gider, içerik yayın kuyruğunda `yayın_hatası` durumunda kalır
- Token yenileme başarısız olursa: Telegram'a acil uyarı gider (yayın hattının tamamen durma riski)

## Test Yaklaşımı

Gerçek Instagram hesabına yayın yapmadan önce sistem tamamen taslak modda doğrulanır: birkaç haftalık içerik üretilir, Telegram'dan gözden geçirilir, ama gerçek `publish` çağrısı yapılmaz. Meta onayı ve manuel kalite kontrolü tamamlandıktan sonra yayın açılır.

## Açık Kararlar (İmplementasyon Planında Netleşecek)

- Görsel üretim AI sağlayıcısı (OpenAI gpt-image vs Google Imagen) — fiyat/kalite karşılaştırmasıyla seçilecek
- Prompt stil rehberinin tam metni
- Remotion şablon(lar)ının tam tasarımı (kaç varyasyon, hangi geçiş/animasyon stilleri)
- Veritabanı şeması detayları (Prisma modelleri)

## Kabul Kriterleri

- [ ] Sistem taslak modda haftada 5 statik + 2 reel içerik üretebiliyor
- [ ] Telegram üzerinden önizleme + onay/red çalışıyor
- [ ] Meta App Review tamamlandı, gerçek yayın açık
- [ ] Token otomatik yenileniyor, yenileme hatası bildirimi çalışıyor
- [ ] Aynı konu/görsel kısa sürede tekrar önerilmiyor (dedup çalışıyor)
