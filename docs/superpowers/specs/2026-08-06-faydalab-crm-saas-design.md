# FaydaLab CRM SaaS (Faz 4) — Tasarım

## Bağlam

Roadmap (`docs/10-roadmap.md`), Faz 4'ü "Academy, EU, SaaS ürünleşme" olarak tanımlıyor. Academy (eğitim içeriği) ve EU (Erasmus+/hibe danışmanlığı) için kurucunun kişisel birikimi/ağı olmadığı netleşti — bu ikisi tamamen sıfırdan, teknik olmayan bir yatırım gerektiriyor. SaaS ürünleşme ise mevcut, çalışan koda (apps/crm) dayandığı için netlik ve teknik risk açısından en mantıklı öncelik olarak seçildi.

**Önemli not:** Roadmap'in kendi ilkesi Faz 4'ün "önceki fazlardan gelen içerik otoritesi, kanıtlanmış vaka çalışmaları ve tekrarlayan gelir olmadan başlatılmaması" yönünde. Faz 3'ün geri kalanı (CRM production kurulumu, WhatsApp otomasyonu) henüz bitmedi. Bu bilinçli bir sıralama sapması — kullanıcı bu tasarım/planlama işini şimdi yapıp, uygulamaya geçmeden önce Faz 3'e dönmeyi tercih etti.

**Kapsam kararı:** İki potansiyel SaaS adayı var — `apps/content-agent` (Instagram otomasyonu) ve `apps/crm` (lead yönetimi + AI kalifikasyonu). İkisini aynı anda tam detaylı tasarlamak yerine, **önce CRM SaaS'ı tam tasarla → planla → uygula → gerçek müşteriyle doğrula**, content-agent SaaS'ı bu kanıtlanana kadar ertelendi (bkz. "Kapsam Dışı").

## Ürün Adı

**FaydaLab CRM** — ana marka şemsiyesi altında kalır (bkz. `00-vision.md`'deki "tek otorite markası" ilkesi), ayrı bir marka inşa edilmiyor.

## Hedef

`apps/crm`'i (Faz 3a'da inşa edilen, FaydaLab'ın kendi lead yönetimi için kullandığı tek-kiracılı uygulama) **çok-kiracılı (multi-tenant), self-servis abonelik ürününe** dönüştürmek. FaydaLab'ın kendi hesabı yeni sistemde 1. kiracı (tenant) olur — dogfooding.

## Hedef Kitle ve Konumlandırma

Net bir dikey (örn. sadece restoranlar) belirlenmedi — ilk sürüm geniş bir küçük işletme kitlesine açılacak, hedef kitle gerçek kullanıcı geri bildirimiyle netleştirilecek. Bu spesifik bir pazarlama/positioning kararı değil, ürünün kimseyi dışlamayan genel bir "küçük işletmeler için AI destekli lead yönetimi" çerçevesinde sunulacağı anlamına geliyor.

## Mimari

### Veri Modeli Değişiklikleri (`apps/crm/prisma/schema.prisma`)

Yeni model:

```prisma
model Tenant {
  id                   String    @id @default(cuid())
  name                 String
  slug                 String    @unique
  plan                 Plan      @default(BASLANGIC)
  subscriptionStatus   SubscriptionStatus @default(TRIALING)
  trialEndsAt          DateTime?
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?   @unique
  ingestSecret         String    // bu tenant'a özel lead alım anahtarı (secureCompare ile karşılaştırılır)
  monthlyLeadCount     Int       @default(0)
  monthlyLeadCountResetAt DateTime @default(now())
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  users AdminUser[]
  leads Lead[]
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
```

Mevcut modellerde değişiklik:
- `AdminUser`: `username` yerine **`email`** (global unique — giriş kimliği), `tenantId` (FK, zorunlu).
- `Lead`: `tenantId` (FK, zorunlu). Tüm sorgular (`prisma.lead.findMany` vb.) `where: { tenantId }` ile filtrelenir — bu proje genelinde **tek en kritik güvenlik kuralı**: hiçbir admin route/API, session'dan gelen `tenantId` dışında bir tenant'ın verisine erişememeli.

### Kimlik Doğrulama ve Session

- `session.ts`'deki mevcut HMAC-imzalı cookie deseni korunur, payload'a `tenantId` eklenir (`userId.tenantId.issuedAt.sig`).
- `requireSession()` artık `{ userId, tenantId }` döndürür; her admin route bu `tenantId`'yi Prisma sorgularında kullanmak **zorunda**.
- Giriş formu: e-posta + şifre (kullanıcı adı yerine — farklı kiracılarda aynı kullanıcı adı çakışmasın diye).

### Kayıt (Signup) Akışı

- Yeni public `/signup` sayfası: işletme adı, e-posta, şifre.
- Sunucu tarafında: `Tenant` oluşturulur (benzersiz `slug` üretilir, benzersiz `ingestSecret` üretilir), `AdminUser` oluşturulur (bcrypt hash), session cookie set edilir, kullanıcı doğrudan panele yönlendirilir.
- `trialEndsAt = now + 14 gün`, `subscriptionStatus = TRIALING`.
- V1'de tenant başına **tek admin kullanıcısı** var — takım/çoklu kullanıcı desteği kapsam dışı (YAGNI, istenirse ayrı bir sonraki iterasyon).

### Lead Alımı (Per-Tenant Ingestion)

Bugün `CRM_INGEST_SECRET` ve `VAPI_WEBHOOK_SECRET` global ortam değişkenleri. SaaS'ta her tenant'ın kendi gizli anahtarı olmalı:

- `/api/leads` artık `x-crm-ingest-secret` header'ının hangi tenant'a ait olduğunu bulmak için `Tenant.ingestSecret` alanına göre **veritabanında** arama yapar (env var karşılaştırması değil). Bulunan tenant `secureCompare` ile doğrulanır, sonra o tenant'a lead yazılır.
- Panelde ("Ayarlar" sayfası) tenant kendi webhook URL'ini ve gizli anahtarını görüp kopyalayabilir; kendi web sitesine veya Vapi asistanına bu bilgiyi girer.
- Rate limiting artık tenant bazlı da olabilir (mevcut IP bazlı sınırlamaya ek); ama bu v1 için opsiyonel — mevcut IP-bazlı sınırlama yeterli başlangıç koruması.

### Plan Sınırları

| | Başlangıç | Pro |
|---|---|---|
| Fiyat | ₺499/ay | ₺1.499/ay |
| Aylık lead sınırı | 50 | Sınırsız |
| AI kalifikasyonu | Kategori + aciliyet | Tam (özet + kategori + aciliyet + skor) |
| Kullanıcı | 1 | 1 |
| Destek | E-posta | Öncelikli |

- `Tenant.monthlyLeadCount` her yeni lead'de artırılır; `monthlyLeadCountResetAt` geçtiyse (bir ay dolduysa) sıfırlanır.
- Başlangıç planında sınıra ulaşıldığında yeni lead'ler **reddedilmez** (kaybetmek istemiyoruz) ama AI kalifikasyonu çalışmaz / sınırlı çalışır — kullanıcı panelde "Pro'ya geç" uyarısı görür.
- `qualifyLead()` çağrısı plan'a göre dallanır: BASLANGIC → sadece kategori+aciliyet isteyen kısaltılmış prompt; PRO → mevcut tam prompt.

### Ücretlendirme (Stripe)

- **Stripe Checkout** (barındırılan ödeme sayfası) — kendi ödeme formu yazılmıyor.
- Deneme bitiminde veya kullanıcı "Plan seç" dediğinde Checkout session oluşturulur, başarılı ödemeden sonra Stripe webhook (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) `Tenant.plan`/`subscriptionStatus`/`stripeSubscriptionId` alanlarını günceller.
- Webhook doğrulaması Stripe'ın imza doğrulama mekanizmasıyla yapılır (bu projede ilk kez kullanılan bir dış webhook deseni — CRM_INGEST_SECRET/VAPI_WEBHOOK_SECRET'tan farklı, Stripe SDK'sının kendi `constructEvent` fonksiyonu kullanılır).

### Geçiş (Mevcut Production CRM'i Bozmadan)

Faz 3a'da production'a hazırlanan CRM, bu değişiklikle kırılmamalı:

1. **Additive migration:** `Tenant` tablosu eklenir; `Lead.tenantId` ve `AdminUser.tenantId` **nullable** olarak eklenir (henüz NOT NULL değil).
2. **Backfill script:** Tek seferlik script "FaydaLab" adlı ilk `Tenant` kaydını oluşturur (mevcut `CRM_INGEST_SECRET`/`VAPI_WEBHOOK_SECRET` değerleri bu tenant'ın `ingestSecret`'ı olur), tüm mevcut `Lead` ve `AdminUser` kayıtlarını bu tenant'a bağlar.
3. **Enforce migration:** `tenantId` kolonları NOT NULL yapılır, `AdminUser.username` kaldırılıp `email` zorunlu hale gelir.
4. Bu sıralama, her adımdan sonra mevcut testlerin ve production'ın çalışır durumda kalmasını sağlar — SDD görev sırası buna göre kurulacak.

## Kapsam Dışı (Bilinçli Olarak Ertelendi)

- **content-agent SaaS**: CRM SaaS gerçek müşteri kazanıp ticari olarak kanıtlanana kadar ele alınmayacak. Ortak bir "platform" soyutlaması (paylaşılan tenant/billing kütüphanesi) şimdiden kurulmuyor — bu projede zaten yerleşik pratik olan "her app kendi auth/session desenini kopyalar" yaklaşımı (bkz. `apps/website`, `apps/crm` arasındaki mevcut kopyalanmış `session.ts`/`auth.ts` deseni) burada da izlenecek; content-agent SaaS'a geçildiğinde CRM SaaS'tan öğrenilenler kopyalanıp uyarlanacak, soyut bir ortak paket olarak çıkarılmayacak.
- **Takım/çoklu kullanıcı per tenant**: v1'de tenant başına tek admin. İstenirse ayrı bir iterasyonda eklenir.
- **White-label / ajanslara satış**: Hedef kitle netleşmedi, bu senaryo şimdilik tasarlanmıyor.
- **Tenant-bazlı rate limiting**: Mevcut IP-bazlı sınırlama yeterli kabul edildi, tenant-bazlı ek sınırlama sonraya bırakıldı.
- **Self-servis plan değiştirme/iptal UI'ı**: v1'de Stripe'ın kendi müşteri portalı (Customer Portal) kullanılabilir — özel bir "plan yönetimi" ekranı yazılmayacak.

## Test Stratejisi

Mevcut kalıp korunur (her `route.ts` için `route.test.ts`, `secureCompare`/`session` gibi lib fonksiyonları için birim testleri). Yeni kritik test alanları:
- **Tenant izolasyonu**: Bir tenant'ın API isteğiyle başka bir tenant'ın lead'ine erişemediğini doğrulayan testler (en kritik güvenlik testi).
- Backfill script'inin idempotent olduğunu (iki kez çalıştırılsa da veri bozulmadığını) doğrulayan test.
- Plan limiti mantığı (`monthlyLeadCount` artışı/sıfırlanması, BASLANGIC'ta kısıtlı AI kalifikasyonu).
- Stripe webhook imza doğrulama ve durum güncelleme testleri (Stripe SDK mock'lanarak).
