'use client'

import { motion } from 'framer-motion'

export function TrustMarquee({ names }: { names: string[] }) {
  if (names.length === 0) return null
  const track = [...names, ...names, ...names, ...names]

  return (
    <div className="relative overflow-hidden border-y border-brand-border bg-brand-surface/40 py-5">
      <motion.div
        className="flex w-max items-center gap-10 whitespace-nowrap"
        animate={{ x: ['0%', '-25%'] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        {track.map((name, i) => (
          <span key={i} className="flex items-center gap-10 font-subheading text-sm uppercase tracking-[0.25em] text-brand-muted/70">
            {name}
            <span className="text-brand-gold/50">✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}
