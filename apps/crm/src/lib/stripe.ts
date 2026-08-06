import Stripe from 'stripe'

let client: Stripe | null = null

export function stripeClient(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY tanımlı değil')
    client = new Stripe(apiKey)
  }
  return client
}

export function priceIdForPlan(plan: 'BASLANGIC' | 'PRO'): string {
  const key = plan === 'BASLANGIC' ? 'STRIPE_PRICE_BASLANGIC' : 'STRIPE_PRICE_PRO'
  const value = process.env[key]
  if (!value) throw new Error(`${key} tanımlı değil`)
  return value
}
