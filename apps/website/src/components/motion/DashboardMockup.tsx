'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { BrowserFrame } from './BrowserFrame'

const incomingLead = { name: 'Yeni Talep', message: '"QR menü ve online sipariş sistemi istiyoruz, ne kadar sürede kurulur?"' }
const aiTags = [
  { label: 'Kategori', value: 'Web / QR Sistem' },
  { label: 'Aciliyet', value: 'Yüksek' },
  { label: 'Skor', value: '5/5' },
]

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
          <div className="rounded-lg border border-brand-border bg-brand-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-brand-muted">{incomingLead.name}</p>
              <span className="flex items-center gap-1.5 text-[11px] text-brand-gold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold" />
                AI kalifikasyonu
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-brand-text/80">{incomingLead.message}</p>
            <div className="flex flex-wrap gap-2">
              {aiTags.map((tag, i) => (
                <motion.span
                  key={tag.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 + i * 0.12 }}
                  className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[11px] text-brand-gold"
                >
                  {tag.label}: {tag.value}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </BrowserFrame>
    </motion.div>
  )
}
