'use client'

import { useState } from 'react'

export function ImageUploadField({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const body = await res.json()
      if (res.ok) onChange(body.url)
      else alert(body.error ?? 'Yükleme başarısız')
    } catch {
      alert('Yükleme başarısız, lütfen tekrar deneyin')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Yüklenen görsel" className="mb-2 h-24 w-40 rounded object-cover" />
      )}
      <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <p className="text-sm text-brand-muted">Yükleniyor...</p>}
    </div>
  )
}
