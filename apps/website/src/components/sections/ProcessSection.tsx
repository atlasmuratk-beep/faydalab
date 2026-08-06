import type { ProcessContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function ProcessSection({ content }: { content: ProcessContent }) {
  return (
    <section id="surec" className="scroll-mt-20 border-t border-brand-border px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-brand-gold" />
              <span className="font-subheading text-xs uppercase tracking-[0.3em] text-brand-muted">
                Nasıl Çalışıyoruz
              </span>
            </div>
            <h2 className="max-w-lg font-heading text-4xl uppercase leading-tight text-brand-text md:text-5xl">
              {content.title}
            </h2>
          </div>
          <p className="max-w-xs text-sm text-brand-muted">{content.subtitle}</p>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.steps.map((step, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="group relative flex h-full flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface p-6 transition-colors hover:border-brand-gold/40">
                <span className="font-heading text-3xl text-brand-gold/50 transition-colors duration-300 group-hover:text-brand-gold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-subheading text-lg text-brand-text">{step.title}</h3>
                <p className="text-sm leading-relaxed text-brand-muted">{step.description}</p>
                {i < content.steps.length - 1 && (
                  <span className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-brand-border lg:block">
                    →
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
