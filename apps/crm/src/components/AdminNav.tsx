'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function AdminNav() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <nav className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-6 py-4">
      <div className="flex gap-6 text-brand-text">
        <Link href="/admin/leads">Lead&apos;ler</Link>
      </div>
      <button onClick={handleLogout} className="text-sm text-brand-muted underline">
        Çıkış Yap
      </button>
    </nav>
  )
}
