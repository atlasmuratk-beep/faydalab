export const STYLE_GUIDE = `Görsel ve metin üretiminde FaydaLab Digital marka kimliğine uy: premium, minimal, modern, güven veren, insan-odaklı bir ton. Emoji kullanımı ölçülü olsun. Vaat edilemeyecek sonuçlar asla vaat edilmesin.

imagePrompt yazarken şu görsel kimliğe MUTLAKA uy: arka plan neredeyse siyah (#0B0B0D), ana metin/vurgu rengi kırık beyaz (#F5F5F5), tek vurgu rengi altın sarısı (#D4AF37), ikincil detaylar açık gri (#B8BDC7). Apple/Stripe/Notion/Linear tarzı minimalist, bol boşluklu, güçlü tipografili, premium bir kompozisyon tarif et. Asla şunları isteme: aşırı parlama/neon efekt, sahte hologram, rastgele gradyan, aşırı 3D, görsel karmaşa, "yapay zeka üretimi" hissi veren abartılı unsurlar. Fotoğraf gerekiyorsa gerçekçi ve profesyonel iş ortamları tarif et, sahte/gerçekçi olmayan yüzlerden kaçın.`

// generateImage()'a her zaman eklenir: Claude'un imagePrompt ifadesi farklılık gösterse
// bile, gönderilen nihai prompt'ta marka renk kodları hep açıkça geçsin diye bir güvence.
export const BRAND_VISUAL_DIRECTIVE = `Marka görsel kimliği: arka plan #0B0B0D, ana metin #F5F5F5, vurgu rengi #D4AF37 (altın sarısı), ikincil detaylar #B8BDC7. Apple/Stripe/Notion tarzı minimalist, bol boşluklu, premium kompozisyon. Neon, hologram, rastgele gradyan, aşırı 3D veya görsel karmaşa kullanma.`
