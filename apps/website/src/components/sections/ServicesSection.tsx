import type { ServicesContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function ServicesSection({ content }: { content: ServicesContent }) {
  return (
    <section id="hizmetler" className="scroll-mt-20 border-t border-brand-border px-6 py-28">
      <Reveal className="mb-14 text-center">
        <p className="mb-3 font-subheading text-xs uppercase tracking-[0.3em] text-brand-gold">Hizmetler</p>
        <h2 className="font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
      </Reveal>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className="group h-full rounded-xl border border-brand-border bg-brand-surface p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-gold/50 hover:shadow-[0_16px_40px_-16px_rgba(212,175,55,0.3)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gold/10 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-gold/15">
                {item.icon}
              </div>
              <h3 className="mb-2 font-subheading text-xl text-brand-text">{item.name}</h3>
              <p className="text-sm leading-relaxed text-brand-muted">{item.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
