# 10 — Yol Haritası

## İlke

FaydaLab vizyonu (17 AI ajanı, 5 alt marka, tam otomasyon) kapsam olarak çok büyük. Küçük bir ekip için bunun hepsini aynı anda inşa etmeye çalışmak en büyük risktir. Bu yüzden yol haritası **sıralı fazlar** halinde ilerler: her faz somut bir çıktı ve/veya gelir üretir, bir sonraki fazın temelini oluşturur.

Süre tahminleri gerçekçi aralıklar olarak verilmiştir; kesin taahhüt değildir — her faz sonunda gözden geçirilip güncellenecektir.

## Faz 0 — Marka ve Dokümantasyon Temeli

**Durum: Devam ediyor**

- FaydaLab kimliği (stratejik) ve doküman yapısı kuruldu
- `faydalab` GitHub deposu oluşturuldu
- Vizyon, marka kimliği ve yol haritası dokümanları tamamlandı

**Süre:** 1-2 hafta
**Çıktı:** Şirketin tüm gelecek kararları için tek doğruluk kaynağı (bu depo)

## Faz 1 — İlk AI Ajanı: Instagram İçerik Otomasyonu

17 ajan yerine **tek bir ajan** ile başlanır: içerik üretimi + zamanlama + yayınlama. İki amaca hizmet eder:

1. FaydaLab'ın kendi Instagram hesabını (otorite inşası, lead üretimi) besler
2. İlk satılabilir otomasyon ürününün/hizmetinin canlı prototipi olur — ileride müşterilere aynı sistemin satılması mümkün hale gelir

**Kapsam (ilk sürüm):** İçerik fikri üretimi → metin/caption → görsel/video üretimi → zamanlama → yayınlama. Detaylı mimari [04-ai-agents.md](04-ai-agents.md) dokümanında bu faza girildiğinde işlenecek.

**Süre:** 2-3 ay
**Çıktı:** Haftada en az 3-5 otomatik Instagram gönderisi, insan müdahalesi sadece onay noktalarında

**Bilinen risk:** Bu fazın önce alınması, mevcut ajans hizmetlerinin (Faz 2) ürünleştirilmesini erteliyor — yani kısa vadeli nakit akışı büyütme bir miktar gecikiyor. Kabul edilebilir, çünkü Faz 1'in çıktısı doğrudan FaydaLab'ın kendi pazarlamasını güçlendirip Faz 2 ve sonrasının satışına da hizmet ediyor.

## Faz 2 — Mevcut Ajans İşini Ürünleştirme

Zaten teslim edilmiş projeler (gazi-usta, Gelecek Rehberlik, Atlas Murat Koçer portfolyosu) tekrarlanabilir bir ürüne dönüştürülür:

- Web sitesi / QR menü için şablon sistemi
- Hızlı teslimat pipeline'ı (talep alma → şablon seçimi → özelleştirme → yayın)
- Bu üç proje, FaydaLab Digital'in ilk vaka çalışmaları (case study) olarak pazarlamada kullanılır

**Süre:** 1-2 ay
**Çıktı:** Yeni bir müşteri talebini günler içinde (haftalar değil) teslim edebilen bir üretim hattı; tekrarlayan bakım/abonelik gelirine geçiş

## Faz 3 — CRM + Lead Kalifikasyonu + WhatsApp Otomasyonu

Ajans operasyonunu uçtan uca otomatikleştiren katman: gelen lead'lerin otomatik kalifikasyonu, WhatsApp/DM üzerinden otomatik yanıt, teklif/proposal üretimi, takip (follow-up).

**Süre:** 3-6 ay
**Çıktı:** Satış sürecinin büyük kısmı insan müdahalesi olmadan işler; sadece onay noktalarında bildirim

## Faz 4 ve Sonrası — Academy, EU, SaaS Ürünleşme

Bu fazlar, önceki fazlardan gelen içerik otoritesi, kanıtlanmış vaka çalışmaları ve tekrarlayan gelir olmadan başlatılmaz — bilinçli olarak en sona bırakılmıştır:

- **FaydaLab Academy:** AI/teknoloji/girişimcilik eğitim programları
- **FaydaLab EU:** Erasmus+ ve AB hibe danışmanlığı
- **FaydaLab SaaS:** Ajans içi araçların (içerik ajanı, CRM) bağımsız abonelik ürünlerine dönüştürülmesi

**Süre:** 6 ay sonrası, ayrı ayrı değerlendirilecek

## Genel Zaman Çerçevesi

| Faz | Süre | Kümülatif |
|---|---|---|
| Faz 0 — Temel | 1-2 hafta | ~2 hafta |
| Faz 1 — AI İçerik Ajanı | 2-3 ay | ~3.5 ay |
| Faz 2 — Ürünleştirme | 1-2 ay | ~5.5 ay |
| Faz 3 — CRM/WhatsApp | 3-6 ay | ~11.5 ay |
| Faz 4+ — Academy/EU/SaaS | 6+ ay | 18-24 ay |

Bu, "her şey bugün bitecek" değil, **18-24 ayda olgun bir şirkete dönüşecek** bir yol haritasıdır. Her faz sonunda bu doküman güncellenir.
