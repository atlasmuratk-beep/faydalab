import { z } from 'zod'

const safeUrl = z.string().url().refine(
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

export const heroContentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  ctaText: z.string().min(1),
  ctaLink: z.string().min(1),
})

export const serviceItemSchema = z.object({
  icon: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
})

export const servicesContentSchema = z.object({
  title: z.string().min(1),
  items: z.array(serviceItemSchema).min(1),
})

export const caseStudyContentSchema = z.object({
  projectName: z.string().min(1),
  needText: z.string().min(1),
  solutionText: z.string().min(1),
  resultText: z.string().min(1),
  imageUrl: safeUrl,
  liveUrl: safeUrl,
})

export const textBlockContentSchema = z.object({
  title: z.string().min(1),
  bodyMarkdown: z.string().min(1),
})

export const contactContentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
})

export const SECTION_TYPES = ['HERO', 'SERVICES', 'CASE_STUDY', 'TEXT_BLOCK', 'CONTACT'] as const
export type SectionType = (typeof SECTION_TYPES)[number]

const contentSchemaByType = {
  HERO: heroContentSchema,
  SERVICES: servicesContentSchema,
  CASE_STUDY: caseStudyContentSchema,
  TEXT_BLOCK: textBlockContentSchema,
  CONTACT: contactContentSchema,
} as const

export function validateSectionContent(type: SectionType, content: unknown) {
  return contentSchemaByType[type].safeParse(content)
}

export type HeroContent = z.infer<typeof heroContentSchema>
export type ServicesContent = z.infer<typeof servicesContentSchema>
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>
export type TextBlockContent = z.infer<typeof textBlockContentSchema>
export type ContactContent = z.infer<typeof contactContentSchema>
