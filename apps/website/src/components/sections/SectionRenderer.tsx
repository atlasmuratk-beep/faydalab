import type { Section } from '@prisma/client'
import { HeroSection } from './HeroSection'
import { ServicesSection } from './ServicesSection'
import { CaseStudySection } from './CaseStudySection'
import { TextBlockSection } from './TextBlockSection'
import { ContactSection } from './ContactSection'
import { ProcessSection } from './ProcessSection'
import { FaqSection } from './FaqSection'
import type {
  HeroContent,
  ServicesContent,
  CaseStudyContent,
  TextBlockContent,
  ContactContent,
  ProcessContent,
  FaqContent,
} from '@/lib/sections'

export function SectionRenderer({
  section,
  stats,
}: {
  section: Section
  stats: { caseStudyCount: number; serviceCount: number; caseStudyNames: string[] }
}) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection content={section.content as unknown as HeroContent} stats={stats} />
    case 'SERVICES':
      return <ServicesSection content={section.content as unknown as ServicesContent} />
    case 'CASE_STUDY':
      return <CaseStudySection content={section.content as unknown as CaseStudyContent} />
    case 'TEXT_BLOCK':
      return <TextBlockSection content={section.content as unknown as TextBlockContent} />
    case 'CONTACT':
      return <ContactSection content={section.content as unknown as ContactContent} />
    case 'PROCESS':
      return <ProcessSection content={section.content as unknown as ProcessContent} />
    case 'FAQ':
      return <FaqSection content={section.content as unknown as FaqContent} />
    default:
      return null
  }
}
