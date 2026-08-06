'use client'

import { useState } from 'react'

export function PortalButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    if (res.ok) {
      const body = await res.json()
      if (body.url) {
        window.location.href = body.url
        return
      }
    }
    setError('Bir hata oluştu, lütfen tekrar deneyin.')
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-bg hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Yönlendiriliyor...' : 'Faturalandırmayı Yönet'}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
