'use client'

import { useEffect, useState } from 'react'

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300 ${
        scrolled
          ? 'border-brand-border/60 bg-brand-bg/90 py-3 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.8)]'
          : 'border-transparent bg-brand-bg/40 py-5'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2.5 font-heading text-2xl uppercase tracking-wide text-brand-text">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-brand-gold/40 bg-brand-gold/10 text-sm text-brand-gold">
            F
          </span>
          FaydaLab
        </a>
        <nav className="flex items-center gap-6 font-subheading text-sm text-brand-muted">
          <a href="#hizmetler" className="transition hover:text-brand-text">
            Hizmetler
          </a>
          <a href="#surec" className="hidden transition hover:text-brand-text sm:inline">
            Süreç
          </a>
          <a href="#hakkimizda" className="hidden transition hover:text-brand-text sm:inline">
            Hakkımızda
          </a>
          <a href="#sss" className="hidden transition hover:text-brand-text md:inline">
            SSS
          </a>
          <a
            href="#iletisim"
            className="rounded-full bg-brand-gold px-4 py-2 font-semibold text-brand-bg transition hover:-translate-y-0.5 hover:opacity-90"
          >
            İletişime Geç
          </a>
        </nav>
      </div>
    </header>
  )
}
