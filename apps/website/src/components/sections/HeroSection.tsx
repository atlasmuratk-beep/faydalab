'use client'

import { motion } from 'framer-motion'
import type { HeroContent } from '@/lib/sections'

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
}

export function HeroSection({ content }: { content: HeroContent }) {
  const isSafeCtaLink =
    content.ctaLink.startsWith('#') ||
    content.ctaLink.startsWith('/') ||
    content.ctaLink.startsWith('http://') ||
    content.ctaLink.startsWith('https://')

  return (
    <section className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden bg-brand-radial px-6 py-24 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(245,245,245,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(245,245,245,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/10 blur-[100px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div variants={container} initial="hidden" animate="visible" className="relative flex flex-col items-center">
        <motion.span
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/5 px-4 py-1.5 font-subheading text-xs uppercase tracking-[0.2em] text-brand-gold"
        >
          Teknoloji &amp; Yapay Zeka Stüdyosu
        </motion.span>
        <motion.h1
          variants={item}
          className="font-heading text-6xl uppercase leading-[0.95] tracking-wide text-brand-text md:text-8xl"
        >
          {content.title}
        </motion.h1>
        <motion.p variants={item} className="mt-6 max-w-2xl font-subheading text-lg text-brand-muted">
          {content.subtitle}
        </motion.p>
        <motion.a
          variants={item}
          href={isSafeCtaLink ? content.ctaLink : '#'}
          whileHover={{ y: -3, scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="mt-9 rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] transition-shadow hover:shadow-[0_0_55px_-8px_rgba(212,175,55,0.8)]"
        >
          {content.ctaText}
        </motion.a>
      </motion.div>
    </section>
  )
}
