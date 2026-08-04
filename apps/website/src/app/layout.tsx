import type { Metadata } from 'next'
import { Bebas_Neue, Sora, Inter } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-heading' })
const sora = Sora({ subsets: ['latin'], variable: '--font-subheading' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'FaydaLab',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${bebasNeue.variable} ${sora.variable} ${inter.variable}`}>
      <body className="bg-brand-bg font-body text-brand-text antialiased">{children}</body>
    </html>
  )
}
