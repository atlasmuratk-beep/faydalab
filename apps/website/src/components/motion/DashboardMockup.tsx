'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { BrowserFrame } from './BrowserFrame'

const bars = [38, 62, 45, 80, 55, 70, 90]

export function DashboardMockup({ stats }: { stats: { caseStudyCount: number; serviceCount: number } }) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 20 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 20 })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    mx.set(0)
    my.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md"
    >
      <BrowserFrame url="faydalab.app/panel">
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
              <p className="font-heading text-2xl text-brand-gold">{stats.caseStudyCount}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-brand-muted">Canlı Proje</p>
            </div>
            <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
              <p className="font-heading text-2xl text-brand-gold">{stats.serviceCount}+</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-brand-muted">Hizmet Alanı</p>
            </div>
            <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
              <p className="font-heading text-2xl text-brand-gold">%100</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-brand-muted">Panelden Kontrol</p>
            </div>
          </div>
          <div className="flex h-24 items-end gap-2 rounded-lg border border-brand-border bg-brand-bg p-4">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.8, delay: 0.6 + i * 0.07, ease: 'easeOut' }}
                className="flex-1 rounded-t bg-gradient-to-t from-brand-gold/30 to-brand-gold"
              />
            ))}
          </div>
          <div className="space-y-2.5 rounded-lg border border-brand-border bg-brand-bg p-4">
            {[100, 80, 60].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-brand-gold/15" />
                <span className="h-2 flex-1 rounded-full bg-brand-border" style={{ maxWidth: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      </BrowserFrame>
    </motion.div>
  )
}
