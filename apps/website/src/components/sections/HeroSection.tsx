import type { HeroContent } from '@/lib/sections'

export function HeroSection({ content }: { content: HeroContent }) {
  const isSafeCtaLink =
    content.ctaLink.startsWith('#') ||
    content.ctaLink.startsWith('/') ||
    content.ctaLink.startsWith('http://') ||
    content.ctaLink.startsWith('https://')

  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-5xl uppercase tracking-wide text-brand-text md:text-7xl">
        {content.title}
      </h1>
      <p className="mt-6 max-w-2xl font-subheading text-lg text-brand-muted">{content.subtitle}</p>
      <a
        href={isSafeCtaLink ? content.ctaLink : '#'}
        className="mt-8 rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg transition hover:opacity-90"
      >
        {content.ctaText}
      </a>
    </section>
  )
}
