import type { TextBlockContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function TextBlockSection({ content }: { content: TextBlockContent }) {
  const paragraphs = content.bodyMarkdown.split('\n\n').filter(Boolean)
  return (
    <section id="hakkimizda" className="scroll-mt-20 border-t border-brand-border px-6 py-24">
      <Reveal className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-8 bg-brand-gold" />
          <span className="font-subheading text-xs uppercase tracking-[0.3em] text-brand-muted">Hakkımızda</span>
        </div>
        <h2 className="mb-6 font-heading text-3xl uppercase text-brand-text">{content.title}</h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 text-brand-muted">
            {p}
          </p>
        ))}
      </Reveal>
    </section>
  )
}
