import type { HeroContent } from '@/lib/sections'

export function HeroSection({ content }: { content: HeroContent }) {
  const isSafeCtaLink =
    content.ctaLink.startsWith('#') ||
    content.ctaLink.startsWith('/') ||
    content.ctaLink.startsWith('http://') ||
    content.ctaLink.startsWith('https://')

  return (
    <section className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden bg-brand-radial px-6 py-24 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(245,245,245,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(245,245,245,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
      <h1 className="relative font-heading text-6xl uppercase tracking-wide text-brand-text md:text-8xl">
        {content.title}
      </h1>
      <p className="relative mt-6 max-w-2xl font-subheading text-lg text-brand-muted">{content.subtitle}</p>
      <a
        href={isSafeCtaLink ? content.ctaLink : '#'}
        className="relative mt-8 rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] transition hover:-translate-y-0.5 hover:opacity-90"
      >
        {content.ctaText}
      </a>
    </section>
  )
}
