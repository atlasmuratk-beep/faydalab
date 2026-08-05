import type { ServicesContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function ServicesSection({ content }: { content: ServicesContent }) {
  return (
    <section id="hizmetler" className="scroll-mt-20 border-t border-brand-border px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-3 font-subheading text-xs uppercase tracking-[0.3em] text-brand-gold">Hizmetler</p>
            <h2 className="max-w-lg font-heading text-4xl uppercase leading-tight text-brand-text md:text-5xl">
              {content.title}
            </h2>
          </div>
          <p className="max-w-xs text-sm text-brand-muted">
            Fikirden panelden yönetilen canlı ürüne — uçtan uca teknoloji ve yapay zeka çözümleri.
          </p>
        </Reveal>
        <div className="divide-y divide-brand-border border-y border-brand-border">
          {content.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div className="group grid grid-cols-[auto_1fr] items-center gap-6 py-7 transition-colors sm:grid-cols-[80px_auto_1fr]">
                <span className="hidden font-heading text-3xl text-brand-border transition-colors duration-300 group-hover:text-brand-gold/40 sm:block">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-gold/15">
                  {item.icon}
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                  <h3 className="font-subheading text-xl text-brand-text transition-transform duration-300 group-hover:translate-x-1">
                    {item.name}
                  </h3>
                  <p className="max-w-md text-sm leading-relaxed text-brand-muted">{item.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
