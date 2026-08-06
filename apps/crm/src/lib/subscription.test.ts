import { describe, it, expect } from 'vitest'
import { hasActiveSubscription } from './subscription'

describe('hasActiveSubscription', () => {
  it('ACTIVE durumunda true döner', () => {
    expect(hasActiveSubscription({ subscriptionStatus: 'ACTIVE', trialEndsAt: null })).toBe(true)
  })

  it('süresi dolmamış TRIALING durumunda true döner', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    expect(hasActiveSubscription({ subscriptionStatus: 'TRIALING', trialEndsAt: future })).toBe(true)
  })

  it('süresi dolmuş TRIALING durumunda false döner', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(hasActiveSubscription({ subscriptionStatus: 'TRIALING', trialEndsAt: past })).toBe(false)
  })

  it('CANCELED durumunda false döner', () => {
    expect(hasActiveSubscription({ subscriptionStatus: 'CANCELED', trialEndsAt: null })).toBe(false)
  })

  it('PAST_DUE durumunda false döner', () => {
    expect(hasActiveSubscription({ subscriptionStatus: 'PAST_DUE', trialEndsAt: null })).toBe(false)
  })
})
