import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const userId = await requireSession()
  if (!userId) {
    redirect('/admin/login')
  }
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Gelen Mesajlar</h1>
      {messages.length === 0 && <p className="text-brand-muted">Henüz mesaj yok.</p>}
      <div className="flex flex-col gap-4">
        {messages.map((m) => (
          <div key={m.id} className="rounded border border-brand-border p-4">
            <p className="font-subheading text-brand-text">
              {m.name} — {m.email}
            </p>
            <p className="mt-1 text-brand-muted">{m.message}</p>
            <p className="mt-2 text-xs text-brand-muted">{m.createdAt.toLocaleString('tr-TR')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
