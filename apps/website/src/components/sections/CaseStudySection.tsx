import Image from 'next/image'
import type { CaseStudyContent } from '@/lib/sections'

export function CaseStudySection({ content }: { content: CaseStudyContent }) {
  return (
    <section className="border-t border-brand-border px-6 py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-brand-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
          <Image src={content.imageUrl} alt={content.projectName} fill className="object-cover" />
        </div>
        <div>
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
        </div>
      </div>
    </section>
  )
}
