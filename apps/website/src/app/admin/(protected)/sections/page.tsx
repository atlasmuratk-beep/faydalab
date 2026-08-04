'use client'

import { useEffect, useState } from 'react'
import { SectionForm } from '@/components/admin/SectionForm'

type SectionType = 'HERO' | 'SERVICES' | 'CASE_STUDY' | 'TEXT_BLOCK' | 'CONTACT'

type SectionRecord = {
  id: string
  type: SectionType
  order: number
  visible: boolean
  content: Record<string, unknown>
}

const TYPE_LABELS: Record<SectionType, string> = {
  HERO: 'Hero',
  SERVICES: 'Hizmetler',
  CASE_STUDY: 'Vaka Çalışması',
  TEXT_BLOCK: 'Metin Bloğu',
  CONTACT: 'İletişim',
}

const DEFAULT_CONTENT: Record<SectionType, Record<string, unknown>> = {
  HERO: { title: '', subtitle: '', ctaText: '', ctaLink: '' },
  SERVICES: { title: '', items: [] },
  CASE_STUDY: { projectName: '', needText: '', solutionText: '', resultText: '', imageUrl: '', liveUrl: '' },
  TEXT_BLOCK: { title: '', bodyMarkdown: '' },
  CONTACT: { title: '', subtitle: '' },
}

export default function SectionsPage() {
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<SectionType | ''>('')

  async function load() {
    const res = await fetch('/api/admin/sections')
    setSections(await res.json())
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const res = await fetch('/api/admin/sections/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, direction }),
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error ?? 'İşlem başarısız')
      return
    }
    load()
  }

  async function handleToggleVisible(section: SectionRecord) {
    const res = await fetch(`/api/admin/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !section.visible }),
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error ?? 'İşlem başarısız')
      return
    }
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu section silinsin mi?')) return
    const res = await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error ?? 'İşlem başarısız')
      return
    }
    load()
  }

  async function handleUpdate(id: string, content: Record<string, unknown>) {
    const res = await fetch(`/api/admin/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error === 'invalid_content' ? 'Bazı alanlar eksik veya geçersiz, lütfen kontrol edin.' : (body.error ?? 'Kaydetme başarısız'))
      return
    }
    setEditingId(null)
    load()
  }

  async function handleCreate(type: SectionType, content: Record<string, unknown>) {
    const res = await fetch('/api/admin/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    })
    if (!res.ok) {
      const body = await res.json()
      alert(body.error === 'invalid_content' ? 'Bazı alanlar eksik veya geçersiz, lütfen kontrol edin.' : (body.error ?? 'Kaydetme başarısız'))
      return
    }
    setAddingType('')
    load()
  }

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Bölümler</h1>

      <div className="mb-8 flex flex-col gap-3">
        {sections.map((section, index) => (
          <div key={section.id} className="rounded border border-brand-border p-4">
            <div className="flex items-center justify-between">
              <span className="font-subheading text-brand-text">
                {TYPE_LABELS[section.type]} {!section.visible && <span className="text-brand-muted">(gizli)</span>}
              </span>
              <div className="flex gap-3 text-sm">
                <button onClick={() => handleReorder(section.id, 'up')} disabled={index === 0} className="text-brand-gold disabled:opacity-30">
                  ↑
                </button>
                <button
                  onClick={() => handleReorder(section.id, 'down')}
                  disabled={index === sections.length - 1}
                  className="text-brand-gold disabled:opacity-30"
                >
                  ↓
                </button>
                <button onClick={() => handleToggleVisible(section)} className="text-brand-gold">
                  {section.visible ? 'Gizle' : 'Göster'}
                </button>
                <button onClick={() => setEditingId(editingId === section.id ? null : section.id)} className="text-brand-gold">
                  Düzenle
                </button>
                <button onClick={() => handleDelete(section.id)} className="text-red-400">
                  Sil
                </button>
              </div>
            </div>
            {editingId === section.id && (
              <div className="mt-4">
                <SectionForm type={section.type} initialContent={section.content} onSave={(content) => handleUpdate(section.id, content)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-brand-border p-4">
        <h2 className="mb-3 font-subheading text-brand-text">Yeni Bölüm Ekle</h2>
        <select
          value={addingType}
          onChange={(e) => setAddingType(e.target.value as SectionType | '')}
          className="mb-3 rounded border border-brand-border bg-transparent p-2 text-brand-text"
        >
          <option value="">Tip seçin</option>
          {(Object.keys(TYPE_LABELS) as SectionType[]).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {addingType && (
          <SectionForm type={addingType} initialContent={DEFAULT_CONTENT[addingType]} onSave={(content) => handleCreate(addingType, content)} />
        )}
      </div>
    </div>
  )
}
