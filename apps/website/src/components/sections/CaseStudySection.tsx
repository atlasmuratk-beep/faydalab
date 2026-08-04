import Image from 'next/image'
import type { CaseStudyContent } from '@/lib/sections'

export function CaseStudySection({ content }: { content: CaseStudyContent }) {
  return (
    <section className="border-t border-brand-border px-6 py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-lg">
          <Image src={content.imageUrl} alt={content.projectName} fill className="object-cover" />
        </div>
        <div>
          <h3 className="mb-4 font-heading text-3xl uppercase text-brand-text">{content.projectName}</h3>
          <p className="mb-2 text-brand-muted">
            <span className="font-subheading text-brand-gold">İhtiyaç: </span>
            {content.needText}
          </p>
          <p className="mb-2 text-brand-muted">
            <span className="font-subheading text-brand-gold">Çözüm: </span>
            {content.solutionText}
          </p>
          <p className="mb-4 text-brand-muted">
            <span className="font-subheading text-brand-gold">Sonuç: </span>
            {content.resultText}
          </p>
          <a
            href={content.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-subheading text-brand-gold underline"
          >
            Canlı siteyi görüntüle →
          </a>
        </div>
      </div>
    </section>
  )
}
