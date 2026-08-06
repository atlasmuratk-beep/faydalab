import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripeClient, planForPriceId } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      const tenantId = checkoutSession.metadata?.tenantId
      const plan = checkoutSession.metadata?.plan as 'BASLANGIC' | 'PRO' | undefined
      if (tenantId && plan) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan,
            subscriptionStatus: 'ACTIVE',
            stripeCustomerId: typeof checkoutSession.customer === 'string' ? checkoutSession.customer : undefined,
            stripeSubscriptionId:
              typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : undefined,
          },
        })
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const tenantId = subscription.metadata?.tenantId
      if (tenantId) {
        const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | undefined> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELED',
          unpaid: 'CANCELED',
          incomplete_expired: 'CANCELED',
          paused: 'CANCELED',
        }
        const status = statusMap[subscription.status]
        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId ? planForPriceId(priceId) : null
        if (status || plan) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              ...(status ? { subscriptionStatus: status } : {}),
              ...(plan ? { plan } : {}),
            },
          })
        }
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const tenantId = subscription.metadata?.tenantId
      if (tenantId) {
        await prisma.tenant.update({ where: { id: tenantId }, data: { subscriptionStatus: 'CANCELED' } })
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
