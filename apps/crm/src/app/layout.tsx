import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FaydaLab CRM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-brand-bg text-brand-text antialiased">{children}</body>
    </html>
  )
}
