export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-brand-border/60 bg-brand-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="font-heading text-2xl uppercase tracking-wide text-brand-text">
          FaydaLab
        </a>
        <nav className="flex items-center gap-6 font-subheading text-sm text-brand-muted">
          <a href="#hizmetler" className="transition hover:text-brand-text">
            Hizmetler
          </a>
          <a href="#hakkimizda" className="hidden transition hover:text-brand-text sm:inline">
            Hakkımızda
          </a>
          <a
            href="#iletisim"
            className="rounded-full bg-brand-gold px-4 py-2 font-semibold text-brand-bg transition hover:opacity-90"
          >
            İletişime Geç
          </a>
        </nav>
      </div>
    </header>
  )
}
