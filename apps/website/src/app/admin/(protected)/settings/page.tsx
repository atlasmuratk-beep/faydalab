'use client'

import { useEffect, useState } from 'react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'

type Settings = {
  siteTitle: string
  metaDescription: string
  faviconUrl: string
  logoUrl: string
  instagramUrl: string
  contactEmail: string
}

const EMPTY: Settings = {
  siteTitle: '',
  metaDescription: '',
  faviconUrl: '',
  logoUrl: '',
  instagramUrl: '',
  contactEmail: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings({ ...EMPTY, ...data })
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const body = await res.json()
      const fieldErrors = body.details?.fieldErrors as Record<string, string[]> | undefined
      const fieldMsgs = fieldErrors
        ? Object.entries(fieldErrors)
            .filter(([, msgs]) => msgs?.length)
            .map(([field, msgs]) => `${field}: ${msgs![0]}`)
            .join('\n')
        : ''
      alert(
        fieldMsgs ||
          (body.error === 'invalid_body'
            ? 'Bazı alanlar eksik veya geçersiz (Site Başlığı ve Meta Açıklama zorunlu).'
            : (body.error ?? 'Kaydetme başarısız'))
      )
      return
    }
    setSaved(true)
  }

  function field(key: keyof Settings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Site Ayarları</h1>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Site Başlığı
          <input
            value={settings.siteTitle}
            onChange={(e) => field('siteTitle', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Meta Açıklama
          <textarea
            value={settings.metaDescription}
            onChange={(e) => field('metaDescription', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Favicon
          <ImageUploadField value={settings.faviconUrl} onChange={(url) => field('faviconUrl', url)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Logo
          <ImageUploadField value={settings.logoUrl} onChange={(url) => field('logoUrl', url)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          Instagram Linki
          <input
            value={settings.instagramUrl}
            onChange={(e) => field('instagramUrl', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-muted">
          İletişim E-postası
          <input
            value={settings.contactEmail}
            onChange={(e) => field('contactEmail', e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        </label>
        {saved && <p className="text-brand-gold">Kaydedildi.</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold px-6 py-3 font-subheading font-semibold text-brand-bg hover:opacity-90"
        >
          Kaydet
        </button>
      </form>
    </div>
  )
}
