import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { stripeClient, priceIdForPlan } from '@/lib/stripe'

const checkoutSchema = z.object({ plan: z.enum(['BASLANGIC', 'PRO']) })

export async function POST(req: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } })
  if (tenant.stripeSubscriptionId && tenant.subscriptionStatus === 'ACTIVE') {
    return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
  }
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: session.userId } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripeClient().checkout.sessions.create({
    mode: 'subscription',
    ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : { customer_email: user.email }),
    line_items: [{ price: priceIdForPlan(parsed.data.plan), quantity: 1 }],
    metadata: { tenantId: tenant.id, plan: parsed.data.plan },
    subscription_data: { metadata: { tenantId: tenant.id, plan: parsed.data.plan } },
    success_url: `${appUrl}/admin/settings?checkout=success`,
    cancel_url: `${appUrl}/admin/settings?checkout=cancelled`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
