# Faz 1a Ön Koşul Checklist'i

Kod yazmaya başlamadan önce aşağıdaki hesaplar/anahtarlar hazır olmalı (hepsi olmadan da geliştirme sürdürülebilir — testler mock kullanır — ama gerçek entegrasyon testi için gereklidir):

- [ ] Neon Postgres veritabanı oluşturuldu, `DATABASE_URL` alındı
- [ ] Anthropic API anahtarı alındı (`ANTHROPIC_API_KEY`)
- [ ] OpenAI API anahtarı alındı (`OPENAI_API_KEY`)
- [ ] Telegram'da BotFather ile bot oluşturuldu, `TELEGRAM_BOT_TOKEN` alındı
- [ ] Kişisel Telegram `chat_id` öğrenildi (bota bir mesaj atıp `getUpdates` ile bulunur), `TELEGRAM_CHAT_ID` olarak not edildi
- [ ] Instagram hesabı iş hesabına çevrildi, bağlı Facebook Sayfası oluşturuldu
- [ ] Meta Developer'da uygulama oluşturuldu, Instagram Graph API için App Review başvurusu yapıldı (bu adım günler sürebilir, bloklamaz — sistem draft modda geliştirilmeye devam eder)
- [ ] Minimal gizlilik politikası + iletişim sayfası yayınlandı (Meta App Review için gereken URL)
- [ ] Vercel projesi oluşturuldu, `apps/content-agent` root directory olarak ayarlandı

Bu adımların hiçbiri Task 2-12'yi bloklamaz (tüm dış servisler testlerde mock'lanır). Task 15 (uçtan uca doğrulama) için gereklidir.
