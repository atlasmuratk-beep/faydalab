# FaydaLab Faz 2 — Kurumsal Web Sitesi: Tasarım

**Tarih:** 2026-08-04
**Durum:** Onaylandı, implementasyon planı bekleniyor
**İlgili:** [00-vision.md](../../00-vision.md), [01-brand-identity.md](../../01-brand-identity.md), [03-website.md](../../03-website.md), [10-roadmap.md](../../10-roadmap.md)

## Amaç

Faz 2'nin iki bağımsız parçasından ilki: FaydaLab'ın kendi kurumsal web sitesini yayınlamak. Ajansın önceden teslim ettiği üç projeyi (gazi-usta, Gelecek Rehberlik, Atlas Murat Koçer) vaka çalışması olarak sergileyen, hem otorite/portföy vitrini hem de lead üretimi işlevi gören, tamamen panelden yönetilebilir bir site. Şablon/hızlı teslimat pipeline'ı (Faz 2'nin ikinci parçası) kapsam dışı — ayrı bir spec olarak ele alınacak.

## Kapsam (MVP)

- Tek sayfa (single-page), scroll ile ilerleyen, esnek **section** sistemi
- Panelden section ekleme/silme/sıralama/gizleme — sabit bir sayfa yapısı değil
- 5 section tipi: Hero, Hizmetler, Vaka Çalışması, Metin Bloğu, İletişim
- Tek admin hesabı ile panel üzerinden tüm içerik (section'lar + site geneli ayarlar) düzenlenebilir
- İletişim formu → veritabanı kaydı + Telegram bildirimi
- Geçici `*.vercel.app` domain ile yayın (özel domain sonra bağlanır)

**Kapsam dışı (bilinçli olarak ertelendi):**
- Şablon/hızlı teslimat pipeline'ı (Faz 2'nin ikinci parçası, ayrı spec)
- Tam serbest sayfa oluşturucu (drag-and-drop, zengin metin editörü) — kullanıcı sabit section tipleri + ekle/sil/sırala yaklaşımını yeterli buldu
- Çoklu admin kullanıcı/rol sistemi (gazi-usta'daki gibi tek admin yeterli)
- Çok dilli site (Türkçe öncelikli, marka sesi ilkesi zaten böyle)
- Blog/makale sistemi (ayrı bir ihtiyaç çıkarsa ileride değerlendirilir)

## Mimari

```
┌─────────────────┐     ┌──────────────────┐
│   Ziyaretçi       │────▶│  apps/website     │
│   (public site)   │◀────│  (Next.js/Vercel) │
└─────────────────┘     └──────────────────┘
                                  │  ▲
                    ┌─────────────┘  └─────────────┐
                    ▼                              ▼
          ┌──────────────────┐           ┌──────────────────┐
          │  Neon Postgres     │           │   Vercel Blob      │
          │  (Section,          │           │  (vaka çalışması    │
          │  SiteSettings,      │           │   görselleri,        │
          │  ContactMessage,    │           │   favicon/logo)      │
          │  AdminUser)         │           └──────────────────┘
          └──────────────────┘
                    ▲
                    │ (credentials auth, bcrypt)
          ┌──────────────────┐
          │   Admin Panel      │
          │   (/admin, aynı     │
          │   Next.js app'in     │
          │   içinde)            │
          └──────────────────┘
                    │
                    ▼ (yeni ileti bildirim)
          ┌──────────────────┐
          │   Telegram Bot     │
          │   (mevcut bot,      │
          │   content-agent'la   │
          │   paylaşılan)        │
          └──────────────────┘
```

**Yeni bileşen — `apps/website`:** Mevcut monorepo'ya (`apps/content-agent`, `apps/reel-renderer` ile aynı yapı) sibling bir Next.js 15 (App Router) + TypeScript + Tailwind uygulaması. Kendi Prisma şeması, kendi Vercel projesi, kendi Neon Postgres + Vercel Blob provizyonu.

**Neden yeni bir app, mevcut content-agent'a eklenti değil:** content-agent'ın sorumluluğu Instagram içerik otomasyonu; kurumsal site tamamen farklı bir okuma/yazma deseni (çoğunlukla public, yüksek trafik, düşük yazma sıklığı) ve farklı bir dağıtım yaşam döngüsüne sahip. Ayrı app, gazi-usta'da da izlenen "her proje kendi Vercel projesi + kendi veritabanı" desenini korur.

## İçerik Modeli

### `Section`

Sayfanın sırayla dizilmiş, panelden yönetilen yapı taşı. Tip-bazlı `content` JSON alanı, tipe göre farklı şekil taşır.

```prisma
enum SectionType {
  HERO
  SERVICES
  CASE_STUDY
  TEXT_BLOCK
  CONTACT
}

model Section {
  id        String      @id @default(cuid())
  type      SectionType
  order     Int
  visible   Boolean     @default(true)
  content   Json
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}
```

Tipe göre `content` şekli (uygulama katmanında Zod şemasıyla doğrulanır, veritabanı seviyesinde zorunlu değil):

- **HERO:** `{ title, subtitle, ctaText, ctaLink }`
- **SERVICES:** `{ title, items: [{ icon, name, description }] }`
- **CASE_STUDY:** `{ projectName, needText, solutionText, resultText, imageUrl, liveUrl }`
- **TEXT_BLOCK:** `{ title, bodyMarkdown }`
- **CONTACT:** `{ title, subtitle }` (form alanları sabit: isim/e-posta/mesaj, ayrıca yapılandırılmaz)

Public sayfa, `order`'a göre sıralı ve `visible=true` olan section'ları render eder; her section tipi kendi React bileşenine sahiptir (`HeroSection`, `ServicesSection`, `CaseStudySection`, `TextBlockSection`, `ContactSection`).

### `SiteSettings`

Tekil satır (singleton — uygulama her zaman `id=1` ile okur/yazar), site geneli ayarlar.

```prisma
model SiteSettings {
  id                 Int      @id @default(1)
  siteTitle          String
  metaDescription    String
  faviconUrl         String?
  logoUrl            String?
  instagramUrl       String?
  contactEmail       String?
  updatedAt          DateTime @updatedAt
}
```

### `ContactMessage`

İletişim formundan gelen mesajlar.

```prisma
model ContactMessage {
  id        String   @id @default(cuid())
  name      String
  email     String
  message   String
  createdAt DateTime @default(now())
}
```

### `AdminUser`

Gazi-usta'daki panelle birebir aynı desen: tek admin hesabı, bcrypt hash.

```prisma
model AdminUser {
  id           String @id @default(cuid())
  username     String @unique
  passwordHash String
}
```

## Admin Panel

`/admin` altında, credentials auth (bcrypt) ile korunur — gazi-usta'daki panelle aynı session mekanizması ve giriş akışı yeniden kullanılır (yeni bir auth kütüphanesi/deseni icat edilmez).

Panel ekranları:
1. **Section Yönetimi** (`/admin/sections`): mevcut section'ların sıralı listesi (tip + kısa özet), her biri için Düzenle/Sil/Yukarı-Aşağı/Gizle-Göster aksiyonları; "Yeni Section Ekle" → tip seçimi → tipe özel form
2. **Site Ayarları** (`/admin/settings`): `SiteSettings` tekil kaydını düzenleyen form (favicon/logo için Vercel Blob'a yükleme)
3. **Gelen Mesajlar** (`/admin/messages`): `ContactMessage` kayıtlarının salt-okunur listesi (en yeni üstte)

## İletişim Formu Akışı

1. Ziyaretçi formu doldurur → `POST /api/contact`
2. Sunucu, `ContactMessage` kaydı oluşturur
3. content-agent'taki `sendAlert` deseniyle aynı şekilde Telegram bot'a bildirim gönderilir (yeni bot kurulmaz, mevcut `TELEGRAM_BOT_TOKEN`/chat ID paylaşılır) — mesaj metni: isim, e-posta, mesaj özeti
4. Telegram gönderimi başarısız olsa bile form gönderimi kullanıcıya başarılı döner (mesaj zaten veritabanında kalıcı; panel üzerinden her zaman görülebilir) — Telegram sadece anlık bildirim, tek doğruluk kaynağı değil

## İlk İçerik (Seed)

Site ilk yayınlandığında boş olmayacak — aşağıdaki section'lar seed script ile oluşturulur, kullanıcı panelden düzenler:

1. HERO — marka konumlandırma cümlesi ("Teknolojiyi ve yapay zekayı anlaşılır, uygulanabilir ve güvenilir kılan teknoloji otorite markası")
2. SERVICES — mevcut fiilen sunulan hizmetler (Instagram içerik otomasyonu, web sitesi/QR menü)
3. CASE_STUDY × 3 — gazi-usta, Gelecek Rehberlik, Atlas Murat Koçer için "İhtiyaç → Çözüm → Sonuç" taslak metinleri (implementasyon sırasında mevcut kod tabanları/canlı sitelerden yola çıkarak yazılır, marka sesi ilkelerine uygun — abartısız, somut)
4. TEXT_BLOCK — kısa "Hakkımızda"
5. CONTACT — iletişim bölümü

## Görsel Kimlik

`01-brand-identity.md`'de zaten kararlaştırılmış sistem doğrudan uygulanır: koyu tema (`#0B0B0D` arka plan, `#F5F5F5` ana metin, `#D4AF37` altın vurgu, `#B8BDC7` ikincil metin, `#2A2A2F` kart/ayraç), Bebas Neue/Anton başlık, Sora SemiBold alt başlık, Inter Regular gövde. Yeni bir tasarım kararı gerekmez — mevcut sistemin uygulanmasıdır.

## Hata Yönetimi

- Public sayfa: section render hatası tüm sayfayı düşürmemeli — tek bir bozuk section (örn. eksik zorunlu alan) o section'ı atlar, konsola loglar, sayfanın geri kalanı çalışmaya devam eder
- Admin panel: form doğrulama hataları (Zod) kullanıcıya alan bazlı gösterilir
- İletişim formu: Telegram bildirimi başarısız olursa sessizce loglanır, kullanıcıya hata gösterilmez (mesaj veritabanında güvende)
- Gazi-usta'da bulunan bilinen tuzaklar baştan önlenir: public sayfalarda `export const dynamic = "force-dynamic"` (statik prerender ile panel değişikliklerinin yansımaması riski), Vercel Deployment Protection'ın kapalı olduğunun doğrulanması, mobilde hamburger menü/responsive test, dark-mode CSS'in `create-next-app` varsayılanlarıyla çakışmadığının kontrolü

## Test Yaklaşımı

Vitest, mevcut apps'lerdeki gibi:
- Section CRUD (ekleme/silme/sıralama/gizleme) API route testleri
- Tip-bazlı `content` Zod şema doğrulama testleri (her 5 section tipi için geçerli/geçersiz veri)
- İletişim formu: `ContactMessage` kaydı + Telegram bildirim çağrısı (mock'lanmış) testleri
- Admin auth: giriş/çıkış, yetkisiz erişim reddi

## Dağıtım

Gazi-usta'da izlenen akış: `vercel link` ile yeni proje, `vercel integration add neon` ile Postgres provizyonu, `vercel blob create-store` ile Blob storage, `prisma migrate deploy` + seed script, geçici `*.vercel.app` domain. Özel domain (`faydalab.com` veya benzeri) satın alındığında ayrıca bağlanır — bu spec'in kapsamında değil.

## Açık Kararlar (İmplementasyon Planında Netleşecek)

- Section bileşenlerinin tam React/CSS kodu (layout, responsive kırılım noktaları)
- Vaka çalışması taslak metinlerinin tam içeriği (implementasyon sırasında ilgili proje kod tabanları/canlı siteleri incelenerek yazılacak)
- Admin panelin section sıralama arayüzü (yukarı/aşağı butonları mı, sürükle-bırak mı — YAGNI gereği başlangıç için buton yeterli görünüyor, plan aşamasında netleşecek)
- Vercel proje adı ve takım scope'u

## Kabul Kriterleri

- [ ] Public site, panelden eklenen/sıralanan/gizlenen section'ları doğru sırada ve görünürlükte render ediyor
- [ ] Admin panelden yeni section eklenebiliyor, düzenlenebiliyor, silinebiliyor, sırası değiştirilebiliyor
- [ ] Site ayarları (başlık, meta açıklama, favicon, Instagram linki) panelden düzenlenebiliyor
- [ ] İletişim formu gönderimi veritabanına kaydediliyor ve Telegram bildirimi tetikliyor
- [ ] 3 vaka çalışması seed içeriğiyle yayında, panelden düzenlenebilir durumda
- [ ] Site `*.vercel.app` üzerinde canlı, mobilde ve masaüstünde test edildi (gazi-usta'daki mobil menü hatası gibi sorunlar önden kontrol edildi)
