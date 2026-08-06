'use client'

import { useState } from 'react'

export function UpgradeButton({ plan, label }: { plan: 'BASLANGIC' | 'PRO'; label: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      const body = await res.json()
      window.location.href = body.url
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-bg hover:opacity-90 disabled:opacity-50"
    >
      {loading ? 'Yönlendiriliyor...' : label}
    </button>
  )
}
