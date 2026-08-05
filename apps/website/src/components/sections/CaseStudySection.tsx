import Image from 'next/image'
import type { CaseStudyContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'
import { BrowserFrame } from '@/components/motion/BrowserFrame'

function displayUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function CaseStudySection({ content }: { content: CaseStudyContent }) {
  const isSafeLiveUrl = content.liveUrl.startsWith('http://') || content.liveUrl.startsWith('https://')

  return (
    <section className="border-t border-brand-border px-6 py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
        <Reveal y={32}>
          <div className="group">
            <BrowserFrame url={isSafeLiveUrl ? displayUrl(content.liveUrl) : undefined}>
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={content.imageUrl}
                  alt={content.projectName}
                  fill
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
            </BrowserFrame>
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
          {isSafeLiveUrl && (
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
