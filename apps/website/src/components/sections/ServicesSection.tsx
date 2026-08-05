import type { ServicesContent } from '@/lib/sections'

export function ServicesSection({ content }: { content: ServicesContent }) {
  return (
    <section id="hizmetler" className="scroll-mt-20 border-t border-brand-border px-6 py-24">
      <h2 className="mb-12 text-center font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item, i) => (
          <div
            key={i}
            className="group rounded-xl border border-brand-border bg-brand-surface p-6 transition hover:-translate-y-1 hover:border-brand-gold/50 hover:shadow-[0_8px_30px_-12px_rgba(212,175,55,0.25)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gold/10 text-2xl">
              {item.icon}
            </div>
            <h3 className="mb-2 font-subheading text-xl text-brand-text">{item.name}</h3>
            <p className="text-sm leading-relaxed text-brand-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
