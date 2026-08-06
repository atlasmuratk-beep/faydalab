import { z } from 'zod'

export const safeUrl = z.string().url().refine(
  (u) => {
    try {
      const protocol = new URL(u).protocol
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'Sadece http/https URL kabul edilir' }
)

const safeCtaLink = z.string().min(1).refine(
  (v) => {
    if (v.startsWith('#') || v.startsWith('/')) return true
    try {
      const protocol = new URL(v).protocol
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'Sadece http/https URL, / ile başlayan yol veya # ile başlayan anchor kabul edilir' }
)

export const heroContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(2000),
  ctaText: z.string().min(1).max(200),
  ctaLink: safeCtaLink,
})

export const serviceItemSchema = z.object({
  icon: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
})

export const servicesContentSchema = z.object({
  title: z.string().min(1).max(200),
  items: z.array(serviceItemSchema).min(1),
})

export const caseStudyContentSchema = z.object({
  projectName: z.string().min(1).max(200),
  needText: z.string().min(1).max(2000),
  solutionText: z.string().min(1).max(2000),
  resultText: z.string().min(1).max(2000),
  imageUrl: safeUrl,
  liveUrl: safeUrl,
})

export const textBlockContentSchema = z.object({
  title: z.string().min(1).max(200),
  bodyMarkdown: z.string().min(1).max(2000),
})

export const contactContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(2000),
})

export const processStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
})

export const processContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(2000),
  steps: z.array(processStepSchema).min(1),
})

export const faqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
})

export const faqContentSchema = z.object({
  title: z.string().min(1).max(200),
  items: z.array(faqItemSchema).min(1),
})

export const SECTION_TYPES = ['HERO', 'SERVICES', 'CASE_STUDY', 'TEXT_BLOCK', 'CONTACT', 'PROCESS', 'FAQ'] as const
export type SectionType = (typeof SECTION_TYPES)[number]

const contentSchemaByType = {
  HERO: heroContentSchema,
  SERVICES: servicesContentSchema,
  CASE_STUDY: caseStudyContentSchema,
  TEXT_BLOCK: textBlockContentSchema,
  CONTACT: contactContentSchema,
  PROCESS: processContentSchema,
  FAQ: faqContentSchema,
} as const

export function validateSectionContent(type: SectionType, content: unknown) {
  return contentSchemaByType[type].safeParse(content)
}

export type HeroContent = z.infer<typeof heroContentSchema>
export type ServicesContent = z.infer<typeof servicesContentSchema>
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>
export type TextBlockContent = z.infer<typeof textBlockContentSchema>
export type ContactContent = z.infer<typeof contactContentSchema>
export type ProcessContent = z.infer<typeof processContentSchema>
export type FaqContent = z.infer<typeof faqContentSchema>
