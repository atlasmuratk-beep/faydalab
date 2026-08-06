'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LeadStatus } from '@prisma/client'

const STATUS_LABELS: Record<LeadStatus, string> = {
  YENI: 'Yeni',
  DEGERLENDIRILDI: 'Değerlendirildi',
  ILETISIMDE: 'İletişimde',
  KAZANILDI: 'Kazanıldı',
  KAYBEDILDI: 'Kaybedildi',
}

export function LeadStatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: LeadStatus }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value }),
    })
    setSaving(false)
    if (!res.ok) {
      setError('Durum güncellenemedi')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={saving}
        className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value} className="bg-brand-bg">
            {label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}
