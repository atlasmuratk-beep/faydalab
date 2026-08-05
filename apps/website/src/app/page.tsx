import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { validateSectionContent, type SectionType } from '@/lib/sections'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return {
    title: settings?.siteTitle ?? 'FaydaLab',
    description: settings?.metaDescription ?? '',
    icons: settings?.faviconUrl ? [{ url: settings.faviconUrl }] : undefined,
  }
}

export default async function HomePage() {
  const [sections, settings] = await Promise.all([
    prisma.section.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ])

  const validSections = sections.filter((section) => {
    const result = validateSectionContent(section.type as SectionType, section.content)
    if (!result.success) {
      console.error(`Geçersiz section içeriği atlandı: ${section.id} (${section.type})`, result.error.flatten())
    }
    return result.success
  })

  const caseStudyCount = validSections.filter((s) => s.type === 'CASE_STUDY').length
  const servicesSection = validSections.find((s) => s.type === 'SERVICES')
  const serviceCount = servicesSection
    ? ((servicesSection.content as { items?: unknown[] }).items?.length ?? 0)
    : 0

  return (
    <>
      <Header />
      <main>
        {validSections.map((section) => (
          <SectionRenderer key={section.id} section={section} stats={{ caseStudyCount, serviceCount }} />
        ))}
      </main>
      <Footer instagramUrl={settings?.instagramUrl ?? null} />
    </>
  )
}
