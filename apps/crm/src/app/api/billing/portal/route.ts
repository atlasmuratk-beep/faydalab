import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { stripeClient } from '@/lib/stripe'

export async function POST() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } })
  if (!tenant.stripeCustomerId) {
    return NextResponse.json({ error: 'Aktif abonelik yok' }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const portalSession = await stripeClient().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${appUrl}/admin/settings`,
  })

  return NextResponse.json({ url: portalSession.url })
}
