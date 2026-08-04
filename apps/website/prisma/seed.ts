import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const existingCount = await prisma.section.count()
  if (existingCount === 0) {
    const sections: { type: "HERO" | "SERVICES" | "CASE_STUDY" | "TEXT_BLOCK" | "CONTACT"; content: Record<string, unknown> }[] = [
      {
        type: "HERO",
        content: {
          title: "FaydaLab",
          subtitle: "Teknolojiyi ve yapay zekayı anlaşılır, uygulanabilir ve güvenilir kılan teknoloji otorite markası.",
          ctaText: "İletişime Geç",
          ctaLink: "#iletisim",
        },
      },
      {
        type: "SERVICES",
        content: {
          title: "Yaptıklarımız",
          items: [
            {
              icon: "🤖",
              name: "Instagram İçerik Otomasyonu",
              description: "Yapay zeka destekli, onaylı yayın akışıyla haftalık sosyal medya içeriği üretimi.",
            },
            {
              icon: "🌐",
              name: "Web Sitesi ve QR Menü",
              description: "İşletmeler için hızlı teslim edilen, panelden yönetilebilir web sitesi ve QR menü sistemleri.",
            },
            {
              icon: "🧾",
              name: "QR Tabanlı Adisyon Sistemleri",
              description: "Restoran ve kafeler için QR ile entegre sipariş/adisyon çözümleri.",
            },
            {
              icon: "📄",
              name: "Çoklu Belge Oluşturucu ve Gönderici",
              description: "Eğitim ve sertifika veren kurumlar için katılım belgelerini toplu oluşturup gönderen sistemler.",
            },
            {
              icon: "💌",
              name: "Yapay Zeka Destekli Davetiye",
              description: "Kişiselleştirilmiş, online davetiye ve benzeri dijital ürünler.",
            },
          ],
        },
      },
      {
        type: "CASE_STUDY",
        content: {
          projectName: "Gazi-Usta Aile Kebap Salonu",
          needText: "1985'ten beri Kütahya'da hizmet veren işletmenin dijitalde varlığı yoktu; menü güncellemeleri kağıt bastırmaya bağımlıydı.",
          solutionText: "Panelden yönetilebilen tanıtım sitesi ve dijital menü sistemi kuruldu; menü, fiyat, galeri ve duyurular tek admin panelinden anlık güncellenebiliyor.",
          resultText: "İşletme artık menü ve kampanyalarını dakikalar içinde güncelleyebiliyor, dijital bir vitrine kavuştu.",
          imageUrl: "https://gazi-usta.vercel.app/on-cephe.jpg",
          liveUrl: "https://gazi-usta.vercel.app",
        },
      },
      {
        type: "CASE_STUDY",
        content: {
          projectName: "Gelecek Rehberlik",
          needText: "Gönüllü mentörlük hizmetinin online bir tanıtım ve başvuru yüzeyi yoktu.",
          solutionText: "Next.js/Prisma tabanlı bir mentörlük platformu geliştirildi: rehber başvurusu, onay akışı, blog ve admin paneli.",
          resultText: "Hizmet artık profesyonel bir dijital yüzeyle tanıtılıyor ve başvurular otomatik yönetiliyor.",
          imageUrl: "https://placehold.co/800x450/0B0B0D/D4AF37?text=Gelecek+Rehberlik",
          liveUrl: "https://gelecegerehberlik.com",
        },
      },
      {
        type: "CASE_STUDY",
        content: {
          projectName: "Atlas Murat Koçer — Kişisel Site",
          needText: "Çok yönlü bir profesyonel profili (girişimcilik, STK, yazılım) tek bir yüzeyde toplayacak bir portföy sitesi ihtiyacı.",
          solutionText: "Next.js ve Framer Motion ile modern, hareketli bir kişisel tanıtım/portföy sitesi tasarlandı.",
          resultText: "Profesyonel bir portföy/tanıtım sitesi canlıya alındı.",
          imageUrl: "https://placehold.co/800x450/0B0B0D/D4AF37?text=Atlas+Murat+Kocer",
          liveUrl: "https://atlas-murat-kocer.vercel.app",
        },
      },
      {
        type: "TEXT_BLOCK",
        content: {
          title: "Hakkımızda",
          bodyMarkdown:
            "FaydaLab, teknolojiyi ve yapay zekayı anlaşılır, uygulanabilir ve güvenilir kılan bir teknoloji otorite markasıdır.\n\nKüçük işletmelerden eğitim kurumlarına kadar farklı ihtiyaçlara somut, abartısız çözümler üretiyoruz — vaat değil, sonuç.",
        },
      },
      {
        type: "CONTACT",
        content: {
          title: "İletişime Geçin",
          subtitle: "Projenizi anlatın, size en uygun çözümü birlikte bulalım.",
        },
      },
    ]

    for (const [index, section] of sections.entries()) {
      await prisma.section.create({
        data: { type: section.type, content: section.content as any, order: index, visible: true },
      })
    }
  } else {
    console.log(`Section tablosunda zaten ${existingCount} kayıt var, seed atlandı.`)
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      siteTitle: "FaydaLab — Teknoloji ve Yapay Zeka Otorite Markası",
      metaDescription: "FaydaLab; Instagram içerik otomasyonu, web sitesi/QR menü, adisyon sistemleri ve daha fazlası için teknoloji ve yapay zeka çözümleri sunar.",
      instagramUrl: "https://www.instagram.com/faydalab",
    },
    update: {},
  })

  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME ve ADMIN_PASSWORD .env dosyasında tanımlı olmalı")
  }
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { username },
    create: { username, passwordHash },
    update: { passwordHash },
  })

  console.log("Seed tamamlandı.")
}

main().finally(() => prisma.$disconnect())
