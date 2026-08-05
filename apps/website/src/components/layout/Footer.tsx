export function Footer({ instagramUrl }: { instagramUrl: string | null }) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-brand-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-brand-muted sm:flex-row">
        <p>© {year} FaydaLab. Tüm hakları saklıdır.</p>
        <div className="flex items-center gap-6">
          <a href="#hizmetler" className="transition hover:text-brand-text">
            Hizmetler
          </a>
          <a href="#iletisim" className="transition hover:text-brand-text">
            İletişim
          </a>
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold transition hover:opacity-80"
            >
              Instagram
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}
