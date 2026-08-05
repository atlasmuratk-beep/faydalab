import type { ReactNode } from 'react'

export function BrowserFrame({ children, url }: { children: ReactNode; url?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-[0_30px_70px_-25px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-b border-brand-border bg-brand-bg/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        {url && (
          <span className="ml-3 truncate rounded-full bg-brand-bg px-3 py-1 font-mono text-[11px] text-brand-muted">
            {url}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
