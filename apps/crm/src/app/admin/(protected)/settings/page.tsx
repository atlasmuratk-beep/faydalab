import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { UpgradeButton } from '@/components/UpgradeButton'
import { PortalButton } from '@/components/PortalButton'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<string, string> = { BASLANGIC: 'Başlangıç (₺499/ay)', PRO: 'Pro (₺1.499/ay)' }
const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Deneme sürümü',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Ödeme gecikti',
  CANCELED: 'İptal edildi',
}

export default async function SettingsPage() {
  const session = await requireSession()
  if (!session) {
    redirect('/admin/login')
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">Ayarlar</h1>

      <div className="mb-8 rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Plan</p>
        <p className="text-sm text-brand-muted">
          {PLAN_LABELS[tenant.plan]} — {STATUS_LABELS[tenant.subscriptionStatus]}
        </p>
        {tenant.trialEndsAt && tenant.subscriptionStatus === 'TRIALING' && (
          <p className="mt-1 text-xs text-brand-muted">
            Deneme süresi bitiş: {tenant.trialEndsAt.toLocaleDateString('tr-TR')}
          </p>
        )}
        {tenant.stripeCustomerId ? (
          <div className="mt-4">
            <PortalButton />
          </div>
        ) : (
          <div className="mt-4 flex gap-3">
            <UpgradeButton plan="BASLANGIC" label="Başlangıç'a Geç" />
            <UpgradeButton plan="PRO" label="Pro'ya Geç" />
          </div>
        )}
      </div>

      <div className="rounded border border-brand-border p-4">
        <p className="mb-2 text-sm font-semibold text-brand-text">Lead Alım Bilgileri</p>
        <p className="mb-3 text-sm text-brand-muted">
          Web sitenden veya Vapi asistanından lead almak için bu URL ve anahtarı kullan.
        </p>
        <div className="mb-2">
          <p className="text-xs uppercase text-brand-muted">Web Sitesi Webhook URL</p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">{appUrl}/api/leads</code>
        </div>
        <div className="mb-2">
          <p className="text-xs uppercase text-brand-muted">Vapi Webhook URL</p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">
            {appUrl}/api/webhooks/vapi
          </code>
        </div>
        <div>
          <p className="text-xs uppercase text-brand-muted">
            Gizli Anahtar (x-crm-ingest-secret / x-vapi-webhook-secret header)
          </p>
          <code className="block break-all rounded bg-brand-bg p-2 text-xs text-brand-text">{tenant.ingestSecret}</code>
        </div>
      </div>
    </div>
  )
}
