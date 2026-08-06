'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FaqContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

export function FaqSection({ content }: { content: FaqContent }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="sss" className="scroll-mt-20 border-t border-brand-border px-6 py-28">
      <Reveal className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-8 bg-brand-gold" />
          <span className="font-subheading text-xs uppercase tracking-[0.3em] text-brand-muted">
            Sık Sorulan Sorular
          </span>
        </div>
        <h2 className="mb-10 font-heading text-3xl uppercase text-brand-text">{content.title}</h2>
        <div className="divide-y divide-brand-border border-y border-brand-border">
          {content.items.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-subheading text-lg text-brand-text">{item.question}</span>
                  <span
                    className={`shrink-0 font-heading text-xl text-brand-gold transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 text-sm leading-relaxed text-brand-muted">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </Reveal>
    </section>
  )
}
