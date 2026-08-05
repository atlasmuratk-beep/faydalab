import Image from 'next/image'
import type { CaseStudyContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function CaseStudySection({ content }: { content: CaseStudyContent }) {
  return (
    <section className="border-t border-brand-border px-6 py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <Reveal y={32}>
          <div className="group relative aspect-video overflow-hidden rounded-xl border border-brand-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
            <Image
              src={content.imageUrl}
              alt={content.projectName}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <span className="mb-3 inline-block rounded-full border border-brand-gold/30 bg-brand-gold/5 px-3 py-1 font-subheading text-xs uppercase tracking-[0.2em] text-brand-gold">
            Vaka Çalışması
          </span>
          <h3 className="mb-5 font-heading text-3xl uppercase text-brand-text">{content.projectName}</h3>
          <div className="flex flex-col gap-3 border-l-2 border-brand-gold/40 pl-4">
            <p className="text-brand-muted">
              <span className="font-subheading text-brand-gold">İhtiyaç: </span>
              {content.needText}
            </p>
            <p className="text-brand-muted">
              <span className="font-subheading text-brand-gold">Çözüm: </span>
              {content.solutionText}
            </p>
            <p className="text-brand-muted">
              <span className="font-subheading text-brand-gold">Sonuç: </span>
              {content.resultText}
            </p>
          </div>
          {(content.liveUrl.startsWith('http://') || content.liveUrl.startsWith('https://')) && (
            <a
              href={content.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block font-subheading text-brand-gold underline-offset-4 transition hover:underline"
            >
              Canlı siteyi görüntüle →
            </a>
          )}
        </Reveal>
      </div>
    </section>
  )
}
