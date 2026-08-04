'use client'

import { useState } from 'react'
import { ImageUploadField } from './ImageUploadField'

type SectionType = 'HERO' | 'SERVICES' | 'CASE_STUDY' | 'TEXT_BLOCK' | 'CONTACT'
type ServiceItem = { icon: string; name: string; description: string }

export function SectionForm({
  type,
  initialContent,
  onSave,
}: {
  type: SectionType
  initialContent: Record<string, unknown>
  onSave: (content: Record<string, unknown>) => Promise<void>
}) {
  const [content, setContent] = useState<Record<string, unknown>>(initialContent)
  const [saving, setSaving] = useState(false)

  function setField(key: string, value: unknown) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  function textField(key: string, label: string, multiline = false) {
    const value = (content[key] as string) ?? ''
    return (
      <label key={key} className="flex flex-col gap-1 text-sm text-brand-muted">
        {label}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            rows={4}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
          />
        )}
      </label>
    )
  }

  function serviceItemsField() {
    const items = (content.items as ServiceItem[]) ?? []

    function updateItem(index: number, key: keyof ServiceItem, value: string) {
      const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
      setField('items', next)
    }

    function addItem() {
      setField('items', [...items, { icon: '', name: '', description: '' }])
    }

    function removeItem(index: number) {
      setField('items', items.filter((_, i) => i !== index))
    }

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-brand-muted">Hizmet Kartları</p>
        {items.map((item, index) => (
          <div key={index} className="flex flex-col gap-2 rounded border border-brand-border p-3">
            <input
              placeholder="İkon (emoji)"
              value={item.icon}
              onChange={(e) => updateItem(index, 'icon', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <input
              placeholder="Ad"
              value={item.name}
              onChange={(e) => updateItem(index, 'name', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <textarea
              placeholder="Açıklama"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              className="rounded border border-brand-border bg-transparent p-2 text-brand-text"
            />
            <button type="button" onClick={() => removeItem(index)} className="self-start text-sm text-red-400">
              Kartı Sil
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="self-start text-sm text-brand-gold">
          + Kart Ekle
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(content)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {type === 'HERO' && (
        <>
          {textField('title', 'Başlık')}
          {textField('subtitle', 'Alt Başlık', true)}
          {textField('ctaText', 'Buton Metni')}
          {textField('ctaLink', 'Buton Linki')}
        </>
      )}
      {type === 'SERVICES' && (
        <>
          {textField('title', 'Bölüm Başlığı')}
          {serviceItemsField()}
        </>
      )}
      {type === 'CASE_STUDY' && (
        <>
          {textField('projectName', 'Proje Adı')}
          {textField('needText', 'İhtiyaç', true)}
          {textField('solutionText', 'Çözüm', true)}
          {textField('resultText', 'Sonuç', true)}
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            Görsel
            <ImageUploadField value={(content.imageUrl as string) ?? ''} onChange={(url) => setField('imageUrl', url)} />
          </label>
          {textField('liveUrl', 'Canlı Site Linki')}
        </>
      )}
      {type === 'TEXT_BLOCK' && (
        <>
          {textField('title', 'Başlık')}
          {textField('bodyMarkdown', 'Metin', true)}
        </>
      )}
      {type === 'CONTACT' && (
        <>
          {textField('title', 'Başlık')}
          {textField('subtitle', 'Alt Başlık', true)}
        </>
      )}
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-brand-gold px-6 py-2 font-subheading font-semibold text-brand-bg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </form>
  )
}
