import type { Section } from '@prisma/client'
import { HeroSection } from './HeroSection'
import { ServicesSection } from './ServicesSection'
import { CaseStudySection } from './CaseStudySection'
import { TextBlockSection } from './TextBlockSection'
import { ContactSection } from './ContactSection'
import type {
  HeroContent,
  ServicesContent,
  CaseStudyContent,
  TextBlockContent,
  ContactContent,
} from '@/lib/sections'

export function SectionRenderer({ section }: { section: Section }) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection content={section.content as unknown as HeroContent} />
    case 'SERVICES':
      return <ServicesSection content={section.content as unknown as ServicesContent} />
    case 'CASE_STUDY':
      return <CaseStudySection content={section.content as unknown as CaseStudyContent} />
    case 'TEXT_BLOCK':
      return <TextBlockSection content={section.content as unknown as TextBlockContent} />
    case 'CONTACT':
      return <ContactSection content={section.content as unknown as ContactContent} />
    default:
      return null
  }
}
