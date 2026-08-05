'use client'

import { motion } from 'framer-motion'
import type { HeroContent } from '@/lib/sections'
import { DashboardMockup } from '@/components/motion/DashboardMockup'

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
}

export function HeroSection({
  content,
  stats,
}: {
  content: HeroContent
  stats: { caseStudyCount: number; serviceCount: number }
}) {
  const isSafeCtaLink =
    content.ctaLink.startsWith('#') ||
    content.ctaLink.startsWith('/') ||
    content.ctaLink.startsWith('http://') ||
    content.ctaLink.startsWith('https://')

  return (
    <section className="relative overflow-hidden bg-brand-radial px-6 pb-24 pt-28 md:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(245,245,245,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(245,245,245,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_20%,black,transparent)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-120px] top-1/4 h-[420px] w-[420px] rounded-full bg-brand-gold/10 blur-[110px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-[1.1fr_1fr]">
        <motion.div variants={container} initial="hidden" animate="visible">
          <motion.span
            variants={item}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/5 px-4 py-1.5 font-subheading text-xs uppercase tracking-[0.2em] text-brand-gold"
          >
            Teknoloji &amp; Yapay Zeka Stüdyosu
          </motion.span>
          <motion.h1
            variants={item}
            className="font-heading text-6xl uppercase leading-[0.95] tracking-wide text-brand-text md:text-7xl lg:text-8xl"
          >
            {content.title}
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-lg font-subheading text-lg text-brand-muted">
            {content.subtitle}
          </motion.p>
          <motion.div variants={item} className="mt-9 flex items-center gap-4">
            <motion.a
              href={isSafeCtaLink ? content.ctaLink : '#'}
              whileHover={{ y: -3, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] transition-shadow hover:shadow-[0_0_55px_-8px_rgba(212,175,55,0.8)]"
            >
              {content.ctaText}
            </motion.a>
            <a href="#hizmetler" className="font-subheading text-sm text-brand-muted transition hover:text-brand-text">
              Hizmetleri incele ↓
            </a>
          </motion.div>
        </motion.div>
        <div className="hidden justify-self-end md:flex">
          <DashboardMockup stats={stats} />
        </div>
      </div>
    </section>
  )
}
