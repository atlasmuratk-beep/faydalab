import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import type { LeadStatus, LeadSource } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<LeadStatus, string> = {
  YENI: 'Yeni',
  DEGERLENDIRILDI: 'Değerlendirildi',
  ILETISIMDE: 'İletişimde',
  KAZANILDI: 'Kazanıldı',
  KAYBEDILDI: 'Kaybedildi',
}

const URGENCY_COLORS: Record<string, string> = {
  DUSUK: 'text-green-400',
  ORTA: 'text-yellow-400',
  YUKSEK: 'text-red-400',
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>
}) {
  const userId = await requireSession()
  if (!userId) {
    redirect('/admin/login')
  }

  const { status, source } = await searchParams
  const validStatus = status && status in STATUS_LABELS ? (status as LeadStatus) : undefined
  const validSource = source === 'WEBSITE' || source === 'VAPI' ? (source as LeadSource) : undefined
  const leads = await prisma.lead.findMany({
    where: {
      status: validStatus,
      source: validSource,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">Lead&apos;ler</h1>
      <div className="mb-4 flex gap-4 text-sm">
        <a href="/admin/leads" className="text-brand-gold underline">
          Tüm Durumlar
        </a>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <a key={value} href={`/admin/leads?status=${value}`} className="text-brand-muted underline">
            {label}
          </a>
        ))}
      </div>
      <div className="mb-6 flex gap-4 text-sm">
        <a href="/admin/leads?source=WEBSITE" className="text-brand-muted underline">
          Web Sitesi
        </a>
        <a href="/admin/leads?source=VAPI" className="text-brand-muted underline">
          Vapi
        </a>
      </div>
      {leads.length === 0 && <p className="text-brand-muted">Kayıt bulunamadı.</p>}
      <div className="flex flex-col gap-3">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/admin/leads/${lead.id}`}
            className="rounded border border-brand-border p-4 hover:border-brand-gold/50"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-brand-text">
                {lead.name} — {lead.source === 'WEBSITE' ? 'Web Sitesi' : 'Vapi'}
              </p>
              <span className="text-xs text-brand-muted">{STATUS_LABELS[lead.status]}</span>
            </div>
            {lead.aiSummary ? (
              <p className="mt-1 text-sm text-brand-muted">
                {lead.aiSummary}{' '}
                {lead.aiUrgency && (
                  <span className={URGENCY_COLORS[lead.aiUrgency]}>({lead.aiUrgency})</span>
                )}
                {lead.aiScore && <span> — Skor: {lead.aiScore}/5</span>}
              </p>
            ) : lead.aiError ? (
              <p className="mt-1 text-sm text-red-400">AI değerlendirmesi başarısız</p>
            ) : (
              <p className="mt-1 text-sm text-brand-muted">AI değerlendirmesi bekleniyor...</p>
            )}
            <p className="mt-2 text-xs text-brand-muted">{lead.createdAt.toLocaleString('tr-TR')}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
