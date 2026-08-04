import type { ServicesContent } from '@/lib/sections'

export function ServicesSection({ content }: { content: ServicesContent }) {
  return (
    <section className="px-6 py-20">
      <h2 className="mb-12 text-center font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-brand-border bg-brand-bg p-6">
            <div className="mb-3 text-3xl">{item.icon}</div>
            <h3 className="mb-2 font-subheading text-xl text-brand-text">{item.name}</h3>
            <p className="text-brand-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
