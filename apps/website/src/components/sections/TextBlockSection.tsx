import type { TextBlockContent } from '@/lib/sections'

export function TextBlockSection({ content }: { content: TextBlockContent }) {
  const paragraphs = content.bodyMarkdown.split('\n\n').filter(Boolean)
  return (
    <section className="border-t border-brand-border px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 font-heading text-3xl uppercase text-brand-text">{content.title}</h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 text-brand-muted">
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}
