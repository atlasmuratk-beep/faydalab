import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { LeadStatusForm } from '@/components/LeadStatusForm'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireSession()
  if (!userId) {
    redirect('/admin/login')
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) {
    notFound()
  }

  return (
    <div>
      <Link href="/admin/leads" className="text-sm text-brand-muted underline">
        ← Lead&apos;ler
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-semibold text-brand-text">{lead.name}</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {lead.source === 'WEBSITE' ? 'Web Sitesi' : 'Vapi'} — {lead.createdAt.toLocaleString('tr-TR')}
      </p>

      <div className="mb-6 flex flex-col gap-1 text-sm text-brand-text">
        {lead.phone && <p>Telefon: {lead.phone}</p>}
        {lead.email && <p>E-posta: {lead.email}</p>}
      </div>

      <div className="mb-6 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Talep</p>
        <p className="text-sm text-brand-muted">{lead.requestText}</p>
      </div>

      <div className="mb-6 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">AI Değerlendirmesi</p>
        {lead.aiSummary ? (
          <div className="flex flex-col gap-1 text-sm text-brand-muted">
            <p>Özet: {lead.aiSummary}</p>
            <p>Kategori: {lead.aiCategory}</p>
            <p>Aciliyet: {lead.aiUrgency}</p>
            <p>Skor: {lead.aiScore}/5</p>
          </div>
        ) : lead.aiError ? (
          <p className="text-sm text-red-400">Başarısız: {lead.aiError}</p>
        ) : (
          <p className="text-sm text-brand-muted">Bekleniyor...</p>
        )}
      </div>

      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold text-brand-text">Durum</p>
        <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
      </div>

      <details className="text-xs text-brand-muted">
        <summary className="cursor-pointer">Ham kaynak verisi (debug)</summary>
        <pre className="mt-2 overflow-x-auto rounded border border-brand-border p-3">
          {JSON.stringify(lead.sourceMeta, null, 2)}
        </pre>
      </details>
    </div>
  )
}
